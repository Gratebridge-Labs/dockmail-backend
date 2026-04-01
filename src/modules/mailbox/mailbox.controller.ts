import { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
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
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return fail(res, "CONFLICT", "Mailbox already exists", 409);
    }
    logger.error(
      `createMailbox failed: ${error instanceof Error ? error.message : String(error)}`,
      error instanceof Error ? error : undefined,
    );
    const detail =
      env.NODE_ENV === "development" && error instanceof Error ? error.message : "Failed to create mailbox";
    return fail(res, "INTERNAL_ERROR", detail, 500);
  }
}

export async function assignMailbox(req: Request, res: Response) {
  if (!req.user) return fail(res, "UNAUTHORIZED", "Unauthorized", 401);
  const data = await service.assignMailbox(String(req.params.mailboxId), req.body.userId, req.user.id);
  return ok(res, data);
}

export async function deleteMailbox(req: Request, res: Response) {
  try {
    const data = await service.deleteMailbox(String(req.params.workspaceId), String(req.params.mailboxId));
    return ok(res, data);
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return fail(res, "NOT_FOUND", "Mailbox not found", 404);
    }
    logger.error(
      `deleteMailbox failed: ${error instanceof Error ? error.message : String(error)}`,
      error instanceof Error ? error : undefined,
    );
    return fail(res, "INTERNAL_ERROR", "Failed to delete mailbox", 500);
  }
}

export async function listMailboxRequests(req: Request, res: Response) {
  const data = await service.listMailboxRequests(String(req.params.workspaceId));
  return ok(res, data);
}

export async function createMailboxRequest(req: Request, res: Response) {
  if (!req.user) return fail(res, "UNAUTHORIZED", "Unauthorized", 401);
  const data = await service.createMailboxRequest(String(req.params.workspaceId), req.user.id, req.body);
  return ok(res, data, 201);
}

export async function reviewMailboxRequest(req: Request, res: Response) {
  if (!req.user) return fail(res, "UNAUTHORIZED", "Unauthorized", 401);
  try {
    const data = await service.reviewMailboxRequest(
      String(req.params.workspaceId),
      String(req.params.requestId),
      req.user.id,
      req.body,
    );
    return ok(res, data);
  } catch {
    return fail(res, "NOT_FOUND", "Request not found", 404);
  }
}
