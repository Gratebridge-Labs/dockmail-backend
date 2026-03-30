import crypto from "node:crypto";
import { prisma } from "../../config/database";
import { addMailcowMailbox } from "../../config/mailcow";

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
  const password = genMailboxPassword();

  const mailbox = await prisma.mailbox.create({
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
    include: { domain: true, assignments: true },
  });

  await addMailcowMailbox({
    localPart: input.localPart,
    domain: domain.domain,
    password,
    name: input.displayName,
    quotaMb: input.storageLimitMb,
  });

  return mailbox;
}

export async function assignMailbox(mailboxId: string, userId: string, assignedById: string) {
  return prisma.mailboxAssignment.create({
    data: { mailboxId, userId, assignedById },
  });
}
