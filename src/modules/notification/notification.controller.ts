import { Request, Response } from "express";
import { fail, ok } from "../../utils/response";
import * as service from "./notification.service";

export async function listNotifications(req: Request, res: Response) {
  if (!req.user) return fail(res, "UNAUTHORIZED", "Unauthorized", 401);
  const isRead =
    typeof req.query.isRead === "string" ? req.query.isRead === "true" : undefined;
  const data = await service.listNotifications(
    req.user.id,
    typeof req.query.workspaceId === "string" ? req.query.workspaceId : undefined,
    isRead,
    typeof req.query.limit === "string" ? Number(req.query.limit) : 20,
    typeof req.query.cursor === "string" ? req.query.cursor : undefined,
  );
  return ok(res, data);
}

export async function markRead(req: Request, res: Response) {
  if (!req.user) return fail(res, "UNAUTHORIZED", "Unauthorized", 401);
  await service.markRead(req.user.id, String(req.params.notificationId));
  return ok(res, { updated: true });
}

export async function markAllRead(req: Request, res: Response) {
  if (!req.user) return fail(res, "UNAUTHORIZED", "Unauthorized", 401);
  await service.markAllRead(
    req.user.id,
    typeof req.body.workspaceId === "string" ? req.body.workspaceId : undefined,
  );
  return ok(res, { updated: true });
}

export async function deleteNotification(req: Request, res: Response) {
  if (!req.user) return fail(res, "UNAUTHORIZED", "Unauthorized", 401);
  await service.deleteNotification(req.user.id, String(req.params.notificationId));
  return ok(res, { deleted: true });
}

export async function count(req: Request, res: Response) {
  if (!req.user) return fail(res, "UNAUTHORIZED", "Unauthorized", 401);
  const data = await service.unreadCount(req.user.id);
  return ok(res, data);
}
