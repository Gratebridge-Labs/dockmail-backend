import crypto from "node:crypto";
import { Prisma, Role } from "@prisma/client";
import { prisma } from "../../config/database";
import { logger } from "../../config/logger";
import { addMailcowMailbox } from "../../config/mailcow";
import { sendSystemEmail } from "../../services/email.service";

const mailboxInclude = { domain: true, assignments: true } as const;

function genMailboxPassword() {
  return crypto.randomBytes(24).toString("hex");
}

async function enrichMailboxAssignments(
  mailbox: { assignments?: Array<{ userId: string; assignedById: string }> } & Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const assignments = mailbox.assignments ?? [];
  if (!assignments.length) {
    return { ...mailbox, assignments: [] };
  }

  const ids = Array.from(new Set(assignments.flatMap((a) => [a.userId, a.assignedById])));
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, email: true, fullName: true, displayName: true, avatarUrl: true },
  });
  const byId = new Map(users.map((u) => [u.id, u]));

  return {
    ...mailbox,
    assignments: assignments.map((a) => ({
      ...a,
      assignedUser: byId.get(a.userId) ?? null,
      assignedBy: byId.get(a.assignedById) ?? null,
    })),
  };
}

export async function listMailboxes(workspaceId: string) {
  const rows = await prisma.mailbox.findMany({
    where: { workspaceId },
    include: { domain: true, assignments: true },
    orderBy: { createdAt: "desc" },
  });
  return Promise.all(rows.map((row) => enrichMailboxAssignments(row)));
}

export async function myMailboxes(workspaceId: string, userId: string) {
  return prisma.mailbox.findMany({
    where: { workspaceId, assignments: { some: { userId } } },
    include: { domain: true },
  });
}

export async function createMailbox(
  workspaceId: string,
  input: {
    localPart: string;
    domainId: string;
    displayName?: string;
    assignToUserId?: string;
    storageLimitMb: number;
  },
) {
  const domain = await prisma.domain.findFirst({
    where: { id: input.domainId, workspaceId },
  });
  if (!domain) throw new Error("NOT_FOUND");
  if (domain.status !== "VERIFIED") throw new Error("DOMAIN_NOT_VERIFIED");

  const email = `${input.localPart}@${domain.domain}`;

  const existing = await prisma.mailbox.findFirst({
    where: { workspaceId, domainId: input.domainId, localPart: input.localPart },
    include: mailboxInclude,
  });
  if (existing) {
    // Idempotent create: DB row may exist without Mailcow (e.g. first run had no MAILCOW_* env).
    // Retry provisioning so a second API call heals the gap instead of returning early forever.
    try {
      await addMailcowMailbox({
        localPart: existing.localPart,
        domain: existing.domain.domain,
        password: existing.password,
        name: existing.displayName ?? undefined,
        quotaMb: existing.storageLimitMb,
      });
    } catch (e) {
      logger.error(
        `addMailcowMailbox (existing mailbox heal) failed email=${existing.email}: ${e instanceof Error ? e.message : String(e)}`,
        e instanceof Error ? e : undefined,
      );
    }
    return enrichMailboxAssignments(existing);
  }

  const password = genMailboxPassword();

  let mailbox;
  try {
    mailbox = await prisma.mailbox.create({
      data: {
        workspaceId,
        domainId: input.domainId,
        localPart: input.localPart,
        email,
        displayName: input.displayName,
        storageLimitMb: input.storageLimitMb,
        password,
        assignments: input.assignToUserId
          ? {
              create: {
                userId: input.assignToUserId,
                assignedById: input.assignToUserId,
              },
            }
          : undefined,
      },
      include: mailboxInclude,
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const again = await prisma.mailbox.findFirst({
        where: { email },
        include: mailboxInclude,
      });
      if (again) return enrichMailboxAssignments(again);
    }
    throw e;
  }

  try {
    await addMailcowMailbox({
      localPart: input.localPart,
      domain: domain.domain,
      password,
      name: input.displayName,
      quotaMb: input.storageLimitMb,
    });
  } catch (e) {
    await prisma.mailbox.delete({ where: { id: mailbox.id } }).catch(() => {});
    throw e;
  }

  if (input.assignToUserId) {
    const [assignedUser, workspace] = await Promise.all([
      prisma.user.findUnique({ where: { id: input.assignToUserId }, select: { email: true } }),
      prisma.workspace.findUnique({ where: { id: workspaceId }, select: { name: true } }),
    ]);
    if (assignedUser) {
      await sendSystemEmail(assignedUser.email, "mailbox-created", {
        email: mailbox.email,
        displayName: mailbox.displayName ?? "",
        storageLimit: `${mailbox.storageLimitMb} MiB`,
        workspaceName: workspace?.name ?? "Dockmail Workspace",
        createdAt: mailbox.createdAt.toISOString(),
      }).catch(() => null);
    }
  }

  return enrichMailboxAssignments(mailbox);
}

export async function assignMailbox(mailboxId: string, userId: string, assignedById: string) {
  const assignment = await prisma.mailboxAssignment.create({
    data: { mailboxId, userId, assignedById },
  });
  const [mailbox, user, admin] = await Promise.all([
    prisma.mailbox.findUnique({ where: { id: mailboxId }, select: { email: true, workspaceId: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { email: true } }),
    prisma.user.findUnique({ where: { id: assignedById }, select: { fullName: true } }),
  ]);
  const workspace = mailbox
    ? await prisma.workspace.findUnique({ where: { id: mailbox.workspaceId }, select: { name: true } })
    : null;
  if (mailbox && user) {
    await sendSystemEmail(user.email, "mailbox-assigned", {
      email: mailbox.email,
      adminName: admin?.fullName ?? "Workspace Admin",
      workspaceName: workspace?.name ?? "Dockmail Workspace",
      assignedAt: new Date().toISOString(),
    }).catch(() => null);
  }
  return assignment;
}

export function listMailboxRequests(workspaceId: string) {
  return prisma.mailboxRequest.findMany({
    where: { workspaceId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });
}

export async function createMailboxRequest(
  workspaceId: string,
  requestedById: string,
  input: { localPart: string; domainId: string; reason?: string },
) {
  const request = await prisma.mailboxRequest.create({
    data: { workspaceId, requestedById, localPart: input.localPart, domainId: input.domainId, reason: input.reason },
  });
  const [requester, workspace, domain, admins] = await Promise.all([
    prisma.user.findUnique({ where: { id: requestedById }, select: { fullName: true, email: true } }),
    prisma.workspace.findUnique({ where: { id: workspaceId }, select: { name: true } }),
    prisma.domain.findUnique({ where: { id: input.domainId }, select: { domain: true } }),
    prisma.workspaceMember.findMany({
      where: { workspaceId, role: { in: [Role.OWNER, Role.ADMIN] } },
      include: { user: { select: { email: true } } },
    }),
  ]);
  const requestedEmail = `${input.localPart}@${domain?.domain ?? "unknown-domain"}`;
  await Promise.all(
    admins.map((m) =>
      sendSystemEmail(m.user.email, "mailbox-request-submitted", {
        requesterName: requester?.fullName ?? "Team Member",
        requesterEmail: requester?.email ?? "",
        requestedEmail,
        reason: input.reason ?? "No reason provided",
        submittedAt: request.createdAt.toISOString(),
        workspaceName: workspace?.name ?? "Dockmail Workspace",
        approveUrl: "https://dockmail.app/dashboard/mailboxes?tab=requests",
      }).catch(() => null),
    ),
  );
  return request;
}

export async function reviewMailboxRequest(
  workspaceId: string,
  requestId: string,
  reviewerId: string,
  input: { status: "APPROVED" | "DECLINED"; reviewNote?: string },
) {
  const request = await prisma.mailboxRequest.findFirst({ where: { id: requestId, workspaceId } });
  if (!request) throw new Error("NOT_FOUND");
  const updated = await prisma.mailboxRequest.update({
    where: { id: request.id },
    data: {
      status: input.status,
      reviewNote: input.reviewNote,
      reviewedById: reviewerId,
      reviewedAt: new Date(),
    },
  });
  if (input.status === "APPROVED") {
    const mailbox = await createMailbox(workspaceId, {
      localPart: request.localPart,
      domainId: request.domainId,
      assignToUserId: request.requestedById,
      storageLimitMb: 5120,
    });
    const [requester, reviewer] = await Promise.all([
      prisma.user.findUnique({ where: { id: request.requestedById }, select: { email: true } }),
      prisma.user.findUnique({ where: { id: reviewerId }, select: { fullName: true } }),
    ]);
    if (requester) {
      await sendSystemEmail(requester.email, "mailbox-request-approved", {
        requestedEmail: String((mailbox as { email?: unknown }).email ?? ""),
        approvedByName: reviewer?.fullName ?? "Workspace Admin",
        approvedAt: new Date().toISOString(),
        reviewNote: input.reviewNote ?? "",
      }).catch(() => null);
    }
    return { request: updated, mailbox };
  }
  const [declineRequester, declineReviewer, workspace, domain] = await Promise.all([
    prisma.user.findUnique({ where: { id: request.requestedById }, select: { email: true } }),
    prisma.user.findUnique({ where: { id: reviewerId }, select: { fullName: true } }),
    prisma.workspace.findUnique({ where: { id: workspaceId }, select: { name: true } }),
    prisma.domain.findUnique({ where: { id: request.domainId }, select: { domain: true } }),
  ]);
  if (declineRequester) {
    await sendSystemEmail(declineRequester.email, "mailbox-request-declined", {
      requestedEmail: `${request.localPart}@${domain?.domain ?? "unknown-domain"}`,
      workspaceName: workspace?.name ?? "Dockmail Workspace",
      reviewedByName: declineReviewer?.fullName ?? "Workspace Admin",
      reviewNote: input.reviewNote ?? "",
    }).catch(() => null);
  }
  return { request: updated };
}
