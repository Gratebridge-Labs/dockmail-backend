import { Request, Response } from "express";
import { fail, ok } from "../../utils/response";
import * as service from "./domain.service";

export async function listDomains(req: Request, res: Response) {
  const data = await service.listDomains(String(req.params.workspaceId));
  return ok(res, data);
}

export async function addDomain(req: Request, res: Response) {
  try {
    const data = await service.addDomain(String(req.params.workspaceId), req.body.domain);
    return ok(res, data, 201);
  } catch (error) {
    if (error instanceof Error && error.message === "CONFLICT") {
      return fail(res, "CONFLICT", "Domain already in use", 409);
    }
    return fail(res, "INTERNAL_ERROR", "Failed to add domain", 500);
  }
}

export async function getDomain(req: Request, res: Response) {
  const domain = await service.getDomain(String(req.params.workspaceId), String(req.params.domainId));
  if (!domain) return fail(res, "NOT_FOUND", "Domain not found", 404);
  return ok(res, domain);
}

export async function verifyDomain(req: Request, res: Response) {
  try {
    const data = await service.verifyDomain(String(req.params.workspaceId), String(req.params.domainId));
    return ok(res, data);
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return fail(res, "NOT_FOUND", "Domain not found", 404);
    }
    return fail(res, "INTERNAL_ERROR", "Failed to verify domain", 500);
  }
}
