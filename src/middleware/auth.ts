import { NextFunction, Request, Response } from "express";
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
