import { prisma } from "../../config/database";

export async function getSettings(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      fullName: true,
      displayName: true,
      avatarUrl: true,
      timezone: true,
      workspaceMembers: true,
    },
  });
  return user;
}

export async function updateProfile(
  userId: string,
  input: { fullName?: string; displayName?: string; timezone?: string; companyName?: string },
) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      fullName: input.fullName,
      displayName: input.displayName,
      timezone: input.timezone,
    },
  });
  if (input.companyName) {
    const ownerMembership = await prisma.workspaceMember.findFirst({
      where: { userId, role: "OWNER" },
      select: { workspaceId: true },
    });
    if (ownerMembership) {
      await prisma.workspace.update({
        where: { id: ownerMembership.workspaceId },
        data: { name: input.companyName },
      });
    }
  }
  return user;
}

export function updateAvatar(userId: string, avatarUrl: string) {
  return prisma.user.update({ where: { id: userId }, data: { avatarUrl } });
}

export function deleteAvatar(userId: string) {
  return prisma.user.update({ where: { id: userId }, data: { avatarUrl: null } });
}

export function updateNotificationPrefs(
  userId: string,
  input: {
    workspaceId: string;
    notifyEmailOpened?: boolean;
    notifyNewEmail?: boolean;
    notifyTeamActivity?: boolean;
    notifyMailboxReq?: boolean;
    notifyBilling?: boolean;
  },
) {
  return prisma.workspaceMember.update({
    where: { userId_workspaceId: { userId, workspaceId: input.workspaceId } },
    data: {
      notifyEmailOpened: input.notifyEmailOpened,
      notifyNewEmail: input.notifyNewEmail,
      notifyTeamActivity: input.notifyTeamActivity,
      notifyMailboxReq: input.notifyMailboxReq,
      notifyBilling: input.notifyBilling,
    },
  });
}

export function listSessions(userId: string) {
  return prisma.session.findMany({ where: { userId }, orderBy: { lastActiveAt: "desc" } });
}

export function revokeSession(userId: string, sessionId: string) {
  return prisma.session.deleteMany({ where: { id: sessionId, userId } });
}
