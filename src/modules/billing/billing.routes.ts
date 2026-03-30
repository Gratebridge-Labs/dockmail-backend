import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { requireRole } from "../../middleware/role";
import { validate } from "../../middleware/validate";
import {
  addPaymentMethod,
  invoice,
  invoices,
  removePaymentMethod,
  simulatePayment,
  summary,
  updateStorageTier,
} from "./billing.controller";
import { paymentMethodSchema, storageTierSchema } from "./billing.schema";

export const billingRouter = Router({ mergeParams: true });

billingRouter.use(requireAuth, requireRole("OWNER"));
billingRouter.get("/", summary);
billingRouter.get("/invoices", invoices);
billingRouter.get("/invoices/:invoiceId", invoice);
billingRouter.post("/payment-method", validate({ body: paymentMethodSchema }), addPaymentMethod);
billingRouter.delete("/payment-method", removePaymentMethod);
billingRouter.patch("/storage", validate({ body: storageTierSchema }), updateStorageTier);
billingRouter.post("/simulate-payment", simulatePayment);
