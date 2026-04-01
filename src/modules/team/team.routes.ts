import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { requireRole } from "../../middleware/role";
import { validate } from "../../middleware/validate";
import * as controller from "./team.controller";
import {
  acceptInviteSchema,
  invitePreviewQuerySchema,
  inviteSchema,
  reviewMailboxRequestSchema,
  updateRoleSchema,
} from "./team.schema";

export const teamRouter = Router({ mergeParams: true });
export const acceptInviteRouter = Router();

teamRouter.use(requireAuth);
teamRouter.get("/", requireRole("ADMIN", "OWNER"), controller.members);
teamRouter.post("/invite", requireRole("ADMIN", "OWNER"), validate({ body: inviteSchema }), controller.invite);
teamRouter.get("/invites", requireRole("ADMIN", "OWNER"), controller.invites);
teamRouter.delete("/invites/:inviteId", requireRole("ADMIN", "OWNER"), controller.cancelInvite);
teamRouter.post("/invites/:inviteId/resend", requireRole("ADMIN", "OWNER"), controller.resendInvite);

teamRouter.get("/mailbox/requests", requireRole("ADMIN", "OWNER"), controller.mailboxRequests);
teamRouter.post("/mailbox/requests", requireRole("MEMBER", "ADMIN", "OWNER"), controller.createMailboxRequest);
teamRouter.patch(
  "/mailbox/requests/:requestId",
  requireRole("ADMIN", "OWNER"),
  validate({ body: reviewMailboxRequestSchema }),
  controller.reviewMailboxRequest,
);
teamRouter.get("/:memberId", requireRole("ADMIN", "OWNER"), controller.member);
teamRouter.patch(
  "/:memberId",
  requireRole("OWNER"),
  validate({ body: updateRoleSchema }),
  controller.updateMemberRole,
);
teamRouter.delete("/:memberId", requireRole("ADMIN", "OWNER"), controller.removeMember);

acceptInviteRouter.get("/invite", validate({ query: invitePreviewQuerySchema }), controller.invitePreview);
acceptInviteRouter.post("/accept-invite", validate({ body: acceptInviteSchema }), controller.acceptInvite);
