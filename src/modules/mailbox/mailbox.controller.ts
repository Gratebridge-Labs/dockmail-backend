import { Request, Response } from "express";
import { fail, ok } from "../../utils/response";
import * as service from "./mailbox.service";

export async function listMailboxes(req: Request, res: Response) {
  const data = await service.listMailboxes(String(req.params.workspaceId));
  return ok(res, data);
}

export async function myMailboxes(req: Request, res: Response) {
  if (!req.user) return fail(res, "UNAUTHORIZED", "Unauthorized", 401);
  const data = await service.myMailboxes(String(req.params.workspaceId), req.user.id);
  return ok(res, data);
}

export async function createMailbox(req: Request, res: Response) {
  try {
    const data = await service.createMailbox(String(req.params.workspaceId), req.body);
    return ok(res, data, 201);
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return fail(res, "NOT_FOUND", "Domain not found", 404);
    }
    if (error instanceof Error && error.message === "DOMAIN_NOT_VERIFIED") {
      return fail(res, "DOMAIN_NOT_VERIFIED", "Domain must be verified first", 409);
    }
    return fail(res, "INTERNAL_ERROR", "Failed to create mailbox", 500);
  }
}

export async function assignMailbox(req: Request, res: Response) {
  if (!req.user) return fail(res, "UNAUTHORIZED", "Unauthorized", 401);
  const data = await service.assignMailbox(String(req.params.mailboxId), req.body.userId, req.user.id);
  return ok(res, data);
}
