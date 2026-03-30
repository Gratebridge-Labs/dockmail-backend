import { Request, Response } from "express";
import { ok } from "../../utils/response";
import * as service from "./folder.service";

export async function listFolders(req: Request, res: Response) {
  const data = await service.listFolders(String(req.params.mailboxId));
  return ok(res, data);
}

export async function createFolder(req: Request, res: Response) {
  const data = await service.createFolder(String(req.params.mailboxId), req.body);
  return ok(res, data, 201);
}

export async function updateFolder(req: Request, res: Response) {
  const data = await service.updateFolder(String(req.params.folderId), req.body);
  return ok(res, data);
}

export async function deleteFolder(req: Request, res: Response) {
  await service.deleteFolder(String(req.params.mailboxId), String(req.params.folderId));
  return ok(res, { deleted: true });
}
