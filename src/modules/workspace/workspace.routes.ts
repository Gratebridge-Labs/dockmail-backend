import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { requireRole } from "../../middleware/role";
import { validate } from "../../middleware/validate";
import * as controller from "./workspace.controller";
import { createWorkspaceSchema, updateWorkspaceSchema } from "./workspace.schema";

export const workspaceRouter = Router();

// requireAuth must run per-route (not router.use) so `/:workspaceId` is matched first and
// req.params.workspaceId is set before requireAuth / requireRole run.
workspaceRouter.get("/", requireAuth, controller.listWorkspaces);
workspaceRouter.post("/", requireAuth, validate({ body: createWorkspaceSchema }), controller.createWorkspace);
workspaceRouter.get("/:workspaceId", requireAuth, requireRole("MEMBER", "ADMIN", "OWNER"), controller.getWorkspace);
workspaceRouter.patch(
  "/:workspaceId",
  requireAuth,
  requireRole("ADMIN", "OWNER"),
  validate({ body: updateWorkspaceSchema }),
  controller.updateWorkspace,
);
