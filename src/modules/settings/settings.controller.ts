import path from "node:path";
import { Request, Response } from "express";
import { fail, ok } from "../../utils/response";
import * as service from "./settings.service";

export async function getSettings(req: Request, res: Response) {
  if (!req.user) return fail(res, "UNAUTHORIZED", "Unauthorized", 401);
  const data = await service.getSettings(req.user.id);
  return ok(res, data);
}

export async function updateProfile(req: Request, res: Response) {
  if (!req.user) return fail(res, "UNAUTHORIZED", "Unauthorized", 401);
  const data = await service.updateProfile(req.user.id, req.body);
  return ok(res, data);
}

export async function uploadAvatar(req: Request, res: Response) {
  if (!req.user) return fail(res, "UNAUTHORIZED", "Unauthorized", 401);
  if (!req.file) return fail(res, "VALIDATION_ERROR", "Image is required", 400);
  const avatarUrl = `/uploads/${path.basename(req.file.path)}`;
  const data = await service.updateAvatar(req.user.id, avatarUrl);
  return ok(res, data);
}

export async function deleteAvatar(req: Request, res: Response) {
  if (!req.user) return fail(res, "UNAUTHORIZED", "Unauthorized", 401);
  const data = await service.deleteAvatar(req.user.id);
  return ok(res, data);
}

export async function updateNotificationPrefs(req: Request, res: Response) {
  if (!req.user) return fail(res, "UNAUTHORIZED", "Unauthorized", 401);
  const data = await service.updateNotificationPrefs(req.user.id, req.body);
  return ok(res, data);
}

export async function listSessions(req: Request, res: Response) {
  if (!req.user) return fail(res, "UNAUTHORIZED", "Unauthorized", 401);
  const data = await service.listSessions(req.user.id);
  return ok(res, data);
}

export async function revokeSession(req: Request, res: Response) {
  if (!req.user) return fail(res, "UNAUTHORIZED", "Unauthorized", 401);
  await service.revokeSession(req.user.id, String(req.params.sessionId));
  return ok(res, { revoked: true });
}
