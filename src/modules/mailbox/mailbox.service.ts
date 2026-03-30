import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { addMailcowMailbox } from "../../config/mailcow";

const mailboxInclude = { domain: true, assignments: true } as const;

function genMailboxPassword() {
  return crypto.randomBytes(24).toString("hex");
}

export async function listMailboxes(workspaceId: string) {
  return prisma.mailbox.findMany({
    where: { workspaceId },
    include: { domain: true, assignments: true },
    orderBy: { createdAt: "desc" },
  });
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
    return existing;
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
      if (again) return again;
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

  return mailbox;
}

export async function assignMailbox(mailboxId: string, userId: string, assignedById: string) {
  return prisma.mailboxAssignment.create({
    data: { mailboxId, userId, assignedById },
  });
}

export function listMailboxRequests(workspaceId: string) {
  return prisma.mailboxRequest.findMany({
    where: { workspaceId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });
}

export function createMailboxRequest(
  workspaceId: string,
  requestedById: string,
  input: { localPart: string; domainId: string; reason?: string },
) {
  return prisma.mailboxRequest.create({
    data: { workspaceId, requestedById, localPart: input.localPart, domainId: input.domainId, reason: input.reason },
  });
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
    return { request: updated, mailbox };
  }
  return { request: updated };
}
