import { NextFunction, Request, Response } from "express";
import { prisma } from "../config/database";
import { fail } from "../utils/response";
import { verifyAccessToken } from "../utils/jwt";

interface TokenPayload {
  id: string;
  email: string;
  fullName: string;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const raw = req.headers.authorization;
  const token = raw?.startsWith("Bearer ") ? raw.slice(7) : null;
  if (!token) return fail(res, "UNAUTHORIZED", "Missing access token", 401);
  try {
    const payload = verifyAccessToken<TokenPayload>(token);
    req.user = { id: payload.id, email: payload.email, fullName: payload.fullName };
    const workspaceHeader = req.headers["x-workspace-id"];
    req.workspaceId =
      (Array.isArray(workspaceHeader) ? workspaceHeader[0] : workspaceHeader) ||
      (req.params.workspaceId ? String(req.params.workspaceId) : undefined);
    return next();
  } catch {
    return fail(res, "UNAUTHORIZED", "Invalid or expired token", 401);
  }
}

/**
 * Routes under `/v1/mailboxes/:mailboxId/...` have no `workspaceId` in the URL.
 * Resolve it from the mailbox row so `requireRole` receives `req.workspaceId`.
 * If `X-Workspace-Id` is set, it must match the mailbox's workspace.
 */
export async function bindMailboxWorkspace(req: Request, res: Response, next: NextFunction) {
  const mailboxId = req.params.mailboxId;
  const id = typeof mailboxId === "string" ? mailboxId : mailboxId?.[0];
  if (!id) {
    return fail(res, "UNAUTHORIZED", "Missing auth context", 401);
  }

  const mailbox = await prisma.mailbox.findFirst({
    where: { id },
    select: { workspaceId: true },
  });
  if (!mailbox) {
    return fail(res, "NOT_FOUND", "Mailbox not found", 404);
  }

  const headerRaw = req.headers["x-workspace-id"];
  const headerWs = (Array.isArray(headerRaw) ? headerRaw[0] : headerRaw) || undefined;
  if (headerWs && headerWs !== mailbox.workspaceId) {
    return fail(res, "FORBIDDEN", "Mailbox does not belong to this workspace", 403);
  }

  req.workspaceId = mailbox.workspaceId;
  return next();
}
