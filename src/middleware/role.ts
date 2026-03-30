import { NextFunction, Request, Response } from "express";
import { Role } from "@prisma/client";
import { prisma } from "../config/database";
import { fail } from "../utils/response";

export function requireRole(...roles: Role[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !req.workspaceId) return fail(res, "UNAUTHORIZED", "Missing auth context", 401);
    const member = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId: req.user.id,
          workspaceId: req.workspaceId,
        },
      },
      select: { role: true },
    });
    if (!member) return fail(res, "FORBIDDEN", "Not a workspace member", 403);
    req.workspaceMember = member;
    if (!roles.includes(member.role)) return fail(res, "FORBIDDEN", "Insufficient role", 403);
    return next();
  };
}
