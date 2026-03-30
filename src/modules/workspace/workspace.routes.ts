import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { requireRole } from "../../middleware/role";
import { validate } from "../../middleware/validate";
import * as controller from "./workspace.controller";
import { createWorkspaceSchema, updateWorkspaceSchema } from "./workspace.schema";

export const workspaceRouter = Router();

workspaceRouter.use(requireAuth);
workspaceRouter.get("/", controller.listWorkspaces);
workspaceRouter.post("/", validate({ body: createWorkspaceSchema }), controller.createWorkspace);
workspaceRouter.get("/:workspaceId", requireRole("MEMBER", "ADMIN", "OWNER"), controller.getWorkspace);
workspaceRouter.patch(
  "/:workspaceId",
  requireRole("ADMIN", "OWNER"),
  validate({ body: updateWorkspaceSchema }),
  controller.updateWorkspace,
);
