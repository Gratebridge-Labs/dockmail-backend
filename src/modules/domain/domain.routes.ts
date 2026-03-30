import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { requireRole } from "../../middleware/role";
import { validate } from "../../middleware/validate";
import * as controller from "./domain.controller";
import { createDomainSchema } from "./domain.schema";

export const domainRouter = Router({ mergeParams: true });

domainRouter.use(requireAuth);
domainRouter.get("/", requireRole("MEMBER", "ADMIN", "OWNER"), controller.listDomains);
domainRouter.post("/", requireRole("ADMIN", "OWNER"), validate({ body: createDomainSchema }), controller.addDomain);
domainRouter.get("/:domainId", requireRole("MEMBER", "ADMIN", "OWNER"), controller.getDomain);
domainRouter.post("/:domainId/verify", requireRole("ADMIN", "OWNER"), controller.verifyDomain);
