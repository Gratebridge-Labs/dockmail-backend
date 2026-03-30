import { Request, Response } from "express";
import { fail, ok } from "../../utils/response";
import * as service from "./workspace.service";

export async function createWorkspace(req: Request, res: Response) {
  if (!req.user) return fail(res, "UNAUTHORIZED", "Unauthorized", 401);
  const workspace = await service.createWorkspace(req.user.id, req.body);
  return ok(res, workspace, 201);
}

export async function listWorkspaces(req: Request, res: Response) {
  if (!req.user) return fail(res, "UNAUTHORIZED", "Unauthorized", 401);
  const data = await service.listWorkspaces(req.user.id);
  return ok(res, data);
}

export async function getWorkspace(req: Request, res: Response) {
  const workspace = await service.getWorkspace(String(req.params.workspaceId));
  if (!workspace) return fail(res, "NOT_FOUND", "Workspace not found", 404);
  return ok(res, workspace);
}

export async function updateWorkspace(req: Request, res: Response) {
  const workspace = await service.updateWorkspace(String(req.params.workspaceId), req.body);
  return ok(res, workspace);
}
