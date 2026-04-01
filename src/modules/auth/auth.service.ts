import crypto from "node:crypto";
import { BillingStatus, Prisma, Role } from "@prisma/client";
import { prisma } from "../../config/database";
import { comparePassword, hashPassword } from "../../utils/password";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../../utils/jwt";
import { slugify } from "../../utils/slugify";
import { sendSystemEmail } from "../../services/email.service";
import { env } from "../../config/env";

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
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true, emailVerified: true },
  });
  if (existing?.emailVerified) throw new Error("CONFLICT:Email already registered");

  const passwordHash = await hashPassword(input.password);
  const emailVerifyToken = crypto.randomBytes(24).toString("hex");
  const otp = String(crypto.randomInt(100000, 1000000));
  const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
  const slugBase = slugify(input.companyName);

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        fullName: input.fullName,
        passwordHash,
        emailVerifyToken,
        resetToken: otp,
        resetTokenExpiry: otpExpiry,
      },
    });
  } else {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          fullName: input.fullName,
          email: input.email,
          passwordHash,
          emailVerifyToken,
          resetToken: otp,
          resetTokenExpiry: otpExpiry,
        },
        select: { id: true },
      });

      let slug = slugBase || `workspace-${Date.now()}`;
      let suffix = 1;
      while (await tx.workspace.findUnique({ where: { slug } })) {
        slug = `${slugBase}-${suffix++}`;
      }

      const workspace = await tx.workspace.create({
        data: { name: input.companyName, slug },
        select: { id: true },
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
    });
  }

  await sendSystemEmail(input.email, "otp", {
    code: otp,
    timestamp: new Date().toISOString(),
    deviceInfo: "Registration",
    location: "Unknown",
  });
  await sendSystemEmail(input.email, "verify-email", {
    verifyUrl: verifyEmailUrl(emailVerifyToken),
    expiryDate: "in 24 hours",
  }).catch(() => null);

  return {
    status: "OTP_REQUIRED" as const,
    message: "A 6-digit verification code was sent to your email.",
    email: input.email,
  };
}

export async function verifyRegisterOtp(input: { email: string; otp: string }) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: {
      id: true,
      email: true,
      fullName: true,
      emailVerified: true,
      resetToken: true,
      resetTokenExpiry: true,
      workspaceMembers: { select: { workspace: { select: { id: true, name: true, slug: true } } } },
    },
  });
  if (!user) throw new Error("OTP_INVALID");
  if (user.emailVerified) throw new Error("CONFLICT:Email already registered");
  if (!user.resetToken || user.resetToken !== input.otp) throw new Error("OTP_INVALID");
  if (!user.resetTokenExpiry || user.resetTokenExpiry.getTime() < Date.now()) throw new Error("OTP_EXPIRED");

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      emailVerifyToken: null,
      resetToken: null,
      resetTokenExpiry: null,
    },
  });

  const tokens = authTokens({ id: user.id, email: user.email, fullName: user.fullName });
  await prisma.refreshToken.create({
    data: {
      token: tokens.refreshToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  const workspaces = user.workspaceMembers.map((m) => m.workspace);
  const activeWorkspace = workspaces[0] ?? null;

  await sendSystemEmail(user.email, "welcome", {
    firstName: user.fullName.split(" ")[0] ?? user.fullName,
    email: user.email,
    workspaceName: activeWorkspace?.name ?? "Dockmail Workspace",
  }).catch(() => null);

  return {
    user: { id: user.id, email: user.email, fullName: user.fullName, emailVerified: true },
    workspaces,
    activeWorkspace,
    tokens,
  };
}

function verifyEmailUrl(token: string) {
  const base = (env.CLIENT_URL || "https://dockmail.app").replace(/\/$/, "");
  return `${base}/auth/verify-email?token=${token}`;
}

function resetPasswordUrl(token: string) {
  const base = (env.CLIENT_URL || "https://dockmail.app").replace(/\/$/, "");
  return `${base}/auth/reset-password?token=${token}`;
}

export async function verifyEmailToken(token: string) {
  const user = await prisma.user.findFirst({
    where: { emailVerifyToken: token },
    select: { id: true, email: true, fullName: true, emailVerified: true },
  });
  if (!user) throw new Error("TOKEN_INVALID");
  if (user.emailVerified) return { verified: true };

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerified: true, emailVerifyToken: null },
  });
  return { verified: true };
}

export async function resendVerifyEmail(email: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, emailVerified: true },
  });
  if (!user || user.emailVerified) return;

  const token = crypto.randomBytes(24).toString("hex");
  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerifyToken: token },
  });

  await sendSystemEmail(user.email, "verify-email", {
    verifyUrl: verifyEmailUrl(token),
    expiryDate: "in 24 hours",
  }).catch(() => null);
}

export async function forgotPassword(email: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, fullName: true, emailVerified: true },
  });
  if (!user) return;

  const token = crypto.randomBytes(24).toString("hex");
  const expiry = new Date(Date.now() + 60 * 60 * 1000);
  await prisma.user.update({
    where: { id: user.id },
    data: { resetToken: token, resetTokenExpiry: expiry },
  });

  await sendSystemEmail(user.email, "reset-password", {
    resetUrl: resetPasswordUrl(token),
    timestamp: new Date().toISOString(),
    expiryTime: expiry.toISOString(),
  }).catch(() => null);
}

export async function resetPassword(input: { token: string; password: string }) {
  const user = await prisma.user.findFirst({
    where: { resetToken: input.token },
    select: { id: true, email: true, fullName: true, resetTokenExpiry: true },
  });
  if (!user) throw new Error("TOKEN_INVALID");
  if (!user.resetTokenExpiry || user.resetTokenExpiry.getTime() < Date.now()) throw new Error("TOKEN_EXPIRED");

  const passwordHash = await hashPassword(input.password);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, resetToken: null, resetTokenExpiry: null },
    }),
    prisma.refreshToken.deleteMany({ where: { userId: user.id } }),
  ]);

  await sendSystemEmail(user.email, "password-changed", {
    changedAt: new Date().toISOString(),
    deviceInfo: "Unknown device",
    location: "Unknown",
  }).catch(() => null);
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
