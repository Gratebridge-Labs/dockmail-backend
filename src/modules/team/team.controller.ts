import { Request, Response } from "express";
import { fail, ok } from "../../utils/response";
import * as service from "./team.service";

function mapErr(res: Response, err: unknown) {
  const code = err instanceof Error ? err.message : "INTERNAL_ERROR";
  if (code === "NOT_FOUND") return fail(res, "NOT_FOUND", "Not found", 404);
  if (code === "FORBIDDEN") return fail(res, "FORBIDDEN", "Forbidden", 403);
  if (code === "CONFLICT") return fail(res, "CONFLICT", "Conflict", 409);
  if (code === "INVITE_EXPIRED") return fail(res, "INVITE_EXPIRED", "Invite expired", 409);
  if (code === "INVITE_ALREADY_USED") return fail(res, "INVITE_ALREADY_USED", "Invite already used", 409);
  if (code === "VALIDATION") return fail(res, "VALIDATION_ERROR", "Missing required invite fields", 400);
  return fail(res, "INTERNAL_ERROR", "Something went wrong", 500);
}

export async function members(req: Request, res: Response) {
  const data = await service.listMembers(String(req.params.workspaceId));
  return ok(res, data);
}

export async function member(req: Request, res: Response) {
  const data = await service.getMember(String(req.params.workspaceId), String(req.params.memberId));
  if (!data) return fail(res, "NOT_FOUND", "Member not found", 404);
  return ok(res, data);
}

export async function updateMemberRole(req: Request, res: Response) {
  if (!req.user) return fail(res, "UNAUTHORIZED", "Unauthorized", 401);
  try {
    const data = await service.updateMemberRole(
      String(req.params.workspaceId),
      String(req.params.memberId),
      req.body.role,
      req.user.id,
    );
    return ok(res, data);
  } catch (err) {
    return mapErr(res, err);
  }
}

export async function removeMember(req: Request, res: Response) {
  try {
    const data = await service.removeMember(String(req.params.workspaceId), String(req.params.memberId));
    return ok(res, data);
  } catch (err) {
    return mapErr(res, err);
  }
}

export async function invite(req: Request, res: Response) {
  if (!req.user) return fail(res, "UNAUTHORIZED", "Unauthorized", 401);
  try {
    const data = await service.inviteMember(String(req.params.workspaceId), req.user.id, req.body);
    return ok(res, data, 201);
  } catch (err) {
    return mapErr(res, err);
  }
}

export async function invites(req: Request, res: Response) {
  const data = await service.listInvites(String(req.params.workspaceId));
  return ok(res, data);
}

export async function cancelInvite(req: Request, res: Response) {
  await service.cancelInvite(String(req.params.workspaceId), String(req.params.inviteId));
  return ok(res, { deleted: true });
}

export async function resendInvite(req: Request, res: Response) {
  try {
    const data = await service.resendInvite(String(req.params.workspaceId), String(req.params.inviteId));
    return ok(res, data);
  } catch (err) {
    return mapErr(res, err);
  }
}

export async function acceptInvite(req: Request, res: Response) {
  try {
    const data = await service.acceptInvite(req.body);
    return ok(res, data);
  } catch (err) {
    return mapErr(res, err);
  }
}

export async function invitePreview(req: Request, res: Response) {
  try {
    const token = String(req.query.token ?? "");
    const data = await service.getInvitePreviewByToken(token);
    return ok(res, data);
  } catch (err) {
    return mapErr(res, err);
  }
}

export async function mailboxRequests(req: Request, res: Response) {
  const data = await service.mailboxRequests(String(req.params.workspaceId));
  return ok(res, data);
}

export async function myMailboxRequests(req: Request, res: Response) {
  if (!req.user) return fail(res, "UNAUTHORIZED", "Unauthorized", 401);
  const data = await service.mailboxRequestsForUser(String(req.params.workspaceId), req.user.id);
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
  } catch (err) {
    return mapErr(res, err);
  }
}
