import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { requireRole } from "../../middleware/role";
import { validate } from "../../middleware/validate";
import {
  createMailboxSchema,
  mailboxAssignSchema,
  mailboxRequestSchema,
  patchMailboxSchema,
  reviewMailboxRequestSchema,
} from "./mailbox.schema";
import * as controller from "./mailbox.controller";

export const mailboxRouter = Router({ mergeParams: true });

mailboxRouter.use(requireAuth);
mailboxRouter.get("/", requireRole("ADMIN", "OWNER"), controller.listMailboxes);
mailboxRouter.get("/mine", requireRole("MEMBER", "ADMIN", "OWNER"), controller.myMailboxes);
mailboxRouter.post("/", requireRole("ADMIN", "OWNER"), validate({ body: createMailboxSchema }), controller.createMailbox);
mailboxRouter.post(
  "/:mailboxId/assign",
  requireRole("ADMIN", "OWNER"),
  validate({ body: mailboxAssignSchema }),
  controller.assignMailbox,
);
mailboxRouter.get("/requests", requireRole("MEMBER", "ADMIN", "OWNER"), controller.listMailboxRequests);
mailboxRouter.post(
  "/requests",
  requireRole("MEMBER", "ADMIN", "OWNER"),
  validate({ body: mailboxRequestSchema }),
  controller.createMailboxRequest,
);
mailboxRouter.patch(
  "/requests/:requestId",
  requireRole("ADMIN", "OWNER"),
  validate({ body: reviewMailboxRequestSchema }),
  controller.reviewMailboxRequest,
);
mailboxRouter.patch(
  "/:mailboxId",
  requireRole("ADMIN", "OWNER"),
  validate({ body: patchMailboxSchema }),
  controller.patchMailbox,
);
mailboxRouter.delete("/:mailboxId", requireRole("ADMIN", "OWNER"), controller.deleteMailbox);
