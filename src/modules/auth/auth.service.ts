import crypto from "node:crypto";
import { BillingStatus, Prisma, Role } from "@prisma/client";
import { prisma } from "../../config/database";
import { comparePassword, hashPassword } from "../../utils/password";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../../utils/jwt";
import { slugify } from "../../utils/slugify";

function authTokens(user: { id: string; email: string; fullName: string }) {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken({ sub: user.id });
  return { accessToken, refreshToken };
}

export async function registerUser(input: {
  fullName: string;
  email: string;
  password: string;
  companyName: string;
}) {
  const exists = await prisma.user.findUnique({ where: { email: input.email } });
  if (exists) throw new Error("CONFLICT:Email already registered");

  const passwordHash = await hashPassword(input.password);
  const emailVerifyToken = crypto.randomBytes(24).toString("hex");
  const slugBase = slugify(input.companyName);

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        fullName: input.fullName,
        email: input.email,
        passwordHash,
        emailVerifyToken,
      },
      select: { id: true, email: true, fullName: true, emailVerified: true },
    });

    let slug = slugBase || `workspace-${Date.now()}`;
    let suffix = 1;
    while (await tx.workspace.findUnique({ where: { slug } })) {
      slug = `${slugBase}-${suffix++}`;
    }

    const workspace = await tx.workspace.create({
      data: { name: input.companyName, slug },
      select: { id: true, name: true, slug: true },
    });

    await tx.workspaceMember.create({
      data: { role: Role.OWNER, userId: user.id, workspaceId: workspace.id },
    });

    await tx.billing.create({
      data: {
        workspaceId: workspace.id,
        status: BillingStatus.TRIALING,
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });

    return { user, workspace };
  });

  const tokens = authTokens(result.user);
  await prisma.refreshToken.create({
    data: {
      token: tokens.refreshToken,
      userId: result.user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  return { ...result, tokens };
}

export async function loginUser(input: { email: string; password: string; workspaceSlug?: string }) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: {
      id: true,
      email: true,
      fullName: true,
      passwordHash: true,
      emailVerified: true,
      workspaceMembers: {
        select: { workspace: { select: { id: true, name: true, slug: true } } },
      },
    },
  });
  if (!user) throw new Error("INVALID_CREDENTIALS");
  const valid = await comparePassword(input.password, user.passwordHash);
  if (!valid) throw new Error("INVALID_CREDENTIALS");

  const workspaces = user.workspaceMembers.map((m) => m.workspace);
  const activeWorkspace =
    (input.workspaceSlug && workspaces.find((w) => w.slug === input.workspaceSlug)) || workspaces[0] || null;

  const tokens = authTokens({ id: user.id, email: user.email, fullName: user.fullName });
  await prisma.$transaction([
    prisma.refreshToken.create({
      data: {
        token: tokens.refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    }),
    prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
  ]);

  return {
    user: { id: user.id, email: user.email, fullName: user.fullName, emailVerified: user.emailVerified },
    workspaces,
    activeWorkspace,
    tokens,
  };
}

export async function refreshAuthToken(refreshToken: string) {
  const payload = verifyRefreshToken<{ sub: string }>(refreshToken);
  const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
  if (!stored) throw new Error("UNAUTHORIZED");
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, fullName: true },
  });
  if (!user) throw new Error("UNAUTHORIZED");

  const tokens = authTokens(user);
  await prisma.$transaction([
    prisma.refreshToken.delete({ where: { token: refreshToken } }),
    prisma.refreshToken.create({
      data: {
        token: tokens.refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    }),
  ]);
  return tokens;
}

export async function logoutByRefreshToken(token: string) {
  await prisma.refreshToken.deleteMany({ where: { token } });
}

export async function logoutAll(userId: string) {
  await prisma.refreshToken.deleteMany({ where: { userId } });
}

export async function me(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      fullName: true,
      emailVerified: true,
      workspaceMembers: { select: { workspace: { select: { id: true, name: true, slug: true } }, role: true } },
    },
  });
}

export type TxClient = Prisma.TransactionClient;
