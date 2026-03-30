import { Request, Response } from "express";
import { env } from "../../config/env";
import { fail, ok } from "../../utils/response";
import * as service from "./billing.service";

export async function summary(req: Request, res: Response) {
  try {
    const data = await service.getSummary(String(req.params.workspaceId));
    return ok(res, data);
  } catch {
    return fail(res, "NOT_FOUND", "Billing not found", 404);
  }
}

export async function invoices(req: Request, res: Response) {
  const data = await service.listInvoices(String(req.params.workspaceId));
  return ok(res, data);
}

export async function invoice(req: Request, res: Response) {
  const data = await service.getInvoice(String(req.params.workspaceId), String(req.params.invoiceId));
  if (!data) return fail(res, "NOT_FOUND", "Invoice not found", 404);
  return ok(res, data);
}

export async function addPaymentMethod(req: Request, res: Response) {
  const data = await service.addPaymentMethod(String(req.params.workspaceId), req.body);
  return ok(res, data);
}

export async function removePaymentMethod(req: Request, res: Response) {
  const data = await service.removePaymentMethod(String(req.params.workspaceId));
  return ok(res, data);
}

export async function updateStorageTier(req: Request, res: Response) {
  const data = await service.updateStorageTier(String(req.params.workspaceId), req.body.tier);
  return ok(res, data);
}

export async function simulatePayment(req: Request, res: Response) {
  if (env.NODE_ENV === "production") {
    return fail(res, "FORBIDDEN", "Disabled in production", 403);
  }
  const data = await service.simulatePayment(String(req.params.workspaceId));
  return ok(res, data);
}
