import { prisma } from "../../config/database";

export function listNotifications(userId: string, workspaceId?: string, isRead?: boolean, limit = 20, cursor?: string) {
  return prisma.notification.findMany({
    where: {
      userId,
      ...(workspaceId ? { workspaceId } : {}),
      ...(typeof isRead === "boolean" ? { isRead } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
  });
}

export function markRead(userId: string, notificationId: string) {
  return prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { isRead: true, readAt: new Date() },
  });
}

export function markAllRead(userId: string, workspaceId?: string) {
  return prisma.notification.updateMany({
    where: { userId, ...(workspaceId ? { workspaceId } : {}), isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
}

export function deleteNotification(userId: string, notificationId: string) {
  return prisma.notification.deleteMany({
    where: { id: notificationId, userId },
  });
}

export async function unreadCount(userId: string) {
  const unread = await prisma.notification.count({ where: { userId, isRead: false } });
  return { unread };
}
