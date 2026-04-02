import crypto from "node:crypto";
import { RequestStatus, Role } from "@prisma/client";
import { prisma } from "../../config/database";
import { hashPassword } from "../../utils/password";
import { signAccessToken, signRefreshToken } from "../../utils/jwt";
import { sendSystemEmail } from "../../services/email.service";

export function listMembers(workspaceId: string) {
  return prisma.workspaceMember.findMany({
    where: { workspaceId },
    include: { user: true },
    orderBy: { joinedAt: "asc" },
  });
}

export function getMember(workspaceId: string, memberId: string) {
  return prisma.workspaceMember.findFirst({
    where: { workspaceId, id: memberId },
    include: {
      user: true,
    },
  });
}

export async function updateMemberRole(workspaceId: string, memberId: string, role: "ADMIN" | "MEMBER", actorUserId: string) {
  const actor = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId: actorUserId, workspaceId } },
  });
  if (!actor || actor.role !== Role.OWNER) throw new Error("FORBIDDEN");

  const target = await prisma.workspaceMember.findFirst({
    where: { workspaceId, id: memberId },
  });
  if (!target) throw new Error("NOT_FOUND");
  if (target.role === Role.OWNER) throw new Error("FORBIDDEN");

  return prisma.workspaceMember.update({ where: { id: memberId }, data: { role } });
}

export async function removeMember(workspaceId: string, memberId: string) {
  const target = await prisma.workspaceMember.findFirst({
    where: { workspaceId, id: memberId },
    include: { user: { select: { email: true } } },
  });
  if (!target) throw new Error("NOT_FOUND");
  if (target.role === Role.OWNER) throw new Error("FORBIDDEN");
  await prisma.mailboxAssignment.deleteMany({ where: { userId: target.userId } });
  const deleted = await prisma.workspaceMember.delete({ where: { id: memberId } });
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { name: true } });
  await sendSystemEmail(target.user.email, "team-member-removed", {
    workspaceName: workspace?.name ?? "Dockmail Workspace",
    removedByName: "Workspace Admin",
  }).catch(() => null);
  return deleted;
}

export async function inviteMember(
  workspaceId: string,
  invitedById: string,
  input: { email: string; role: "ADMIN" | "MEMBER"; mailboxIds: string[]; message?: string },
) {
  const existingMember = await prisma.workspaceMember.findFirst({
    where: { workspaceId, user: { email: input.email } },
  });
  if (existingMember) throw new Error("CONFLICT");
  const pending = await prisma.invite.findFirst({
    where: { workspaceId, email: input.email, acceptedAt: null, expiresAt: { gt: new Date() } },
  });
  if (pending) throw new Error("CONFLICT");

  const token = crypto.randomBytes(24).toString("hex");
  const invite = await prisma.invite.create({
    data: {
      workspaceId,
      email: input.email,
      role: input.role,
      invitedById,
      message: input.message,
      token,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  const [workspace, inviter] = await Promise.all([
    prisma.workspace.findUnique({ where: { id: workspaceId }, select: { name: true } }),
    prisma.user.findUnique({ where: { id: invitedById }, select: { fullName: true, email: true } }),
  ]);
  await sendSystemEmail(input.email, "invite-member", {
    inviterName: inviter?.fullName ?? "Workspace Admin",
    inviterEmail: inviter?.email ?? "",
    workspaceName: workspace?.name ?? "Dockmail Workspace",
    role: input.role,
    mailboxCount: String(input.mailboxIds.length),
    expiryDate: invite.expiresAt.toISOString(),
    inviteUrl: `https://dockmail.app/invite?token=${token}`,
    personalMessage: input.message ?? "",
  }).catch(() => null);

  if (input.mailboxIds.length > 0) {
    await Promise.all(
      input.mailboxIds.map(async (mailboxId) => {
        const mailbox = await prisma.mailbox.findUnique({ where: { id: mailboxId } });
        if (!mailbox) return;
      }),
    );
  }

  return invite;
}

export function listInvites(workspaceId: string) {
  return prisma.invite.findMany({
    where: { workspaceId, acceptedAt: null },
    orderBy: { createdAt: "desc" },
  });
}

export function cancelInvite(workspaceId: string, inviteId: string) {
  return prisma.invite.deleteMany({ where: { id: inviteId, workspaceId, acceptedAt: null } });
}

export async function resendInvite(workspaceId: string, inviteId: string) {
  const invite = await prisma.invite.findFirst({ where: { id: inviteId, workspaceId, acceptedAt: null } });
  if (!invite) throw new Error("NOT_FOUND");
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { name: true } });
  await sendSystemEmail(invite.email, "invite-member", {
    inviterName: "Workspace Admin",
    inviterEmail: "",
    workspaceName: workspace?.name ?? "Dockmail Workspace",
    role: invite.role,
    mailboxCount: "0",
    expiryDate: invite.expiresAt.toISOString(),
    inviteUrl: `https://dockmail.app/invite?token=${invite.token}`,
  }).catch(() => null);
  return invite;
}

export async function getInvitePreviewByToken(token: string) {
  const invite = await prisma.invite.findUnique({
    where: { token },
    include: { workspace: true },
  });
  if (!invite) throw new Error("NOT_FOUND");

  const inviter = await prisma.user.findUnique({
    where: { id: invite.invitedById },
    select: { fullName: true, email: true },
  });

  const now = Date.now();
  const isExpired = invite.expiresAt.getTime() < now;
  const isAccepted = invite.acceptedAt != null;

  return {
    workspace: {
      id: invite.workspace.id,
      name: invite.workspace.name,
      slug: invite.workspace.slug,
      logoUrl: invite.workspace.logoUrl,
    },
    invite: {
      id: invite.id,
      email: invite.email,
      role: invite.role,
      message: invite.message,
      expiresAt: invite.expiresAt,
      createdAt: invite.createdAt,
      isExpired,
      isAccepted,
      invitedBy: {
        fullName: inviter?.fullName ?? null,
        email: inviter?.email ?? null,
      },
    },
  };
}

export async function acceptInvite(input: { token: string; password?: string; fullName?: string }) {
  const invite = await prisma.invite.findUnique({ where: { token: input.token } });
  if (!invite) throw new Error("NOT_FOUND");
  if (invite.acceptedAt) throw new Error("INVITE_ALREADY_USED");
  if (invite.expiresAt.getTime() < Date.now()) throw new Error("INVITE_EXPIRED");

  const result = await prisma.$transaction(async (tx) => {
    let user = await tx.user.findUnique({ where: { email: invite.email } });
    if (!user) {
      if (!input.password || !input.fullName) throw new Error("VALIDATION");
      user = await tx.user.create({
        data: {
          email: invite.email,
          fullName: input.fullName,
          passwordHash: await hashPassword(input.password),
        },
      });
    }
    await tx.workspaceMember.upsert({
      where: { userId_workspaceId: { userId: user.id, workspaceId: invite.workspaceId } },
      create: { userId: user.id, workspaceId: invite.workspaceId, role: invite.role },
      update: { role: invite.role },
    });
    await tx.invite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    });
    return user;
  });

  const accessToken = signAccessToken({
    id: result.id,
    email: result.email,
    fullName: result.fullName,
  });
  const refreshToken = signRefreshToken({ sub: result.id });

  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId: result.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  const userWithMemberships = await prisma.user.findUnique({
    where: { id: result.id },
    select: {
      id: true,
      email: true,
      fullName: true,
      emailVerified: true,
      workspaceMembers: {
        select: {
          role: true,
          workspace: { select: { id: true, name: true, slug: true, logoUrl: true } },
        },
      },
    },
  });

  const workspaces =
    userWithMemberships?.workspaceMembers.map((m) => ({ ...m.workspace, role: m.role })) ?? [];
  const activeWorkspace = workspaces.find((w) => w.id === invite.workspaceId) ?? workspaces[0] ?? null;

  const [workspace, ownerAdmins] = await Promise.all([
    prisma.workspace.findUnique({ where: { id: invite.workspaceId }, select: { name: true } }),
    prisma.workspaceMember.findMany({
      where: { workspaceId: invite.workspaceId, role: { in: [Role.OWNER, Role.ADMIN] } },
      include: { user: { select: { email: true } } },
    }),
  ]);
  await Promise.all(
    ownerAdmins.map((m) =>
      sendSystemEmail(m.user.email, "invite-accepted", {
        memberName: result.fullName,
        memberEmail: result.email,
        workspaceName: workspace?.name ?? "Dockmail Workspace",
        role: invite.role,
        joinedAt: new Date().toISOString(),
      }).catch(() => null),
    ),
  );

  return {
    user: userWithMemberships
      ? {
          id: userWithMemberships.id,
          email: userWithMemberships.email,
          fullName: userWithMemberships.fullName,
          emailVerified: userWithMemberships.emailVerified,
        }
      : { id: result.id, email: result.email, fullName: result.fullName, emailVerified: true },
    workspaces,
    activeWorkspace,
    tokens: { accessToken, refreshToken },
  };
}

export function mailboxRequests(workspaceId: string) {
  return prisma.mailboxRequest.findMany({
    where: { workspaceId, status: RequestStatus.PENDING },
    orderBy: { createdAt: "desc" },
  });
}

export async function createMailboxRequest(
  workspaceId: string,
  requestedById: string,
  input: { localPart: string; domainId: string; reason?: string },
) {
  const request = await prisma.mailboxRequest.create({
    data: {
      workspaceId,
      requestedById,
      localPart: input.localPart,
      domainId: input.domainId,
      reason: input.reason,
    },
  });
  const [requester, workspace, domain, admins] = await Promise.all([
    prisma.user.findUnique({ where: { id: requestedById }, select: { fullName: true, email: true } }),
    prisma.workspace.findUnique({ where: { id: workspaceId }, select: { name: true } }),
    prisma.domain.findUnique({ where: { id: input.domainId }, select: { domain: true } }),
    prisma.workspaceMember.findMany({
      where: { workspaceId, role: { in: [Role.OWNER, Role.ADMIN] } },
      include: { user: { select: { email: true } } },
    }),
  ]);
  await Promise.all(
    admins.map((m) =>
      sendSystemEmail(m.user.email, "mailbox-request-submitted", {
        requesterName: requester?.fullName ?? "Team Member",
        requesterEmail: requester?.email ?? "",
        requestedEmail: `${input.localPart}@${domain?.domain ?? "unknown-domain"}`,
        reason: input.reason ?? "No reason provided",
        submittedAt: request.createdAt.toISOString(),
        workspaceName: workspace?.name ?? "Dockmail Workspace",
      }).catch(() => null),
    ),
  );
  return request;
}

export async function reviewMailboxRequest(
  workspaceId: string,
  requestId: string,
  reviewerId: string,
  input: { status: "APPROVED" | "DECLINED"; reviewNote?: string },
) {
  const request = await prisma.mailboxRequest.findFirst({ where: { id: requestId, workspaceId } });
  if (!request) throw new Error("NOT_FOUND");
  const updated = await prisma.mailboxRequest.update({
    where: { id: request.id },
    data: {
      status: input.status,
      reviewNote: input.reviewNote,
      reviewedAt: new Date(),
      reviewedById: reviewerId,
    },
  });
  const [requester, reviewer, workspace, domain] = await Promise.all([
    prisma.user.findUnique({ where: { id: request.requestedById }, select: { email: true } }),
    prisma.user.findUnique({ where: { id: reviewerId }, select: { fullName: true } }),
    prisma.workspace.findUnique({ where: { id: workspaceId }, select: { name: true } }),
    prisma.domain.findUnique({ where: { id: request.domainId }, select: { domain: true } }),
  ]);
  if (requester) {
    if (input.status === "APPROVED") {
      await sendSystemEmail(requester.email, "mailbox-request-approved", {
        requestedEmail: `${request.localPart}@${domain?.domain ?? "unknown-domain"}`,
        approvedByName: reviewer?.fullName ?? "Workspace Admin",
        approvedAt: new Date().toISOString(),
        reviewNote: input.reviewNote ?? "",
      }).catch(() => null);
    } else {
      await sendSystemEmail(requester.email, "mailbox-request-declined", {
        requestedEmail: `${request.localPart}@${domain?.domain ?? "unknown-domain"}`,
        reviewedByName: reviewer?.fullName ?? "Workspace Admin",
        workspaceName: workspace?.name ?? "Dockmail Workspace",
        reviewNote: input.reviewNote ?? "",
      }).catch(() => null);
    }
  }
  return updated;
}
