import { BillingStatus, InvoiceStatus, Role, StorageTier } from "@prisma/client";
import { prisma } from "../../config/database";
import { env } from "../../config/env";
import { sendSystemEmail } from "../../services/email.service";

const storagePriceMap: Record<StorageTier, number> = {
  GB_5: env.STORAGE_5GB_PRICE,
  GB_20: env.STORAGE_20GB_PRICE,
  GB_50: env.STORAGE_50GB_PRICE,
  GB_100: env.STORAGE_100GB_PRICE,
};

function cardBrand(cardNumber: string) {
  if (cardNumber.startsWith("4")) return "Visa";
  if (cardNumber.startsWith("5")) return "Mastercard";
  return "Card";
}

function storageLimitByTier(tier: StorageTier) {
  switch (tier) {
    case "GB_20":
      return 20480;
    case "GB_50":
      return 51200;
    case "GB_100":
      return 102400;
    default:
      return 5120;
  }
}

export async function getSummary(workspaceId: string) {
  const billing = await prisma.billing.findUnique({
    where: { workspaceId },
    include: { workspace: { include: { mailboxes: true } } },
  });
  if (!billing) throw new Error("NOT_FOUND");
  const mailboxCount = billing.workspace.mailboxes.length;
  const mailboxCost = mailboxCount * env.PRICE_PER_MAILBOX;
  const storageCost = storagePriceMap[billing.storageTier];
  return {
    status: billing.status,
    storageTier: billing.storageTier,
    mailboxCount,
    monthlyTotal: Number((mailboxCost + storageCost).toFixed(2)),
    breakdown: {
      mailboxCost: Number(mailboxCost.toFixed(2)),
      storageCost: Number(storageCost.toFixed(2)),
    },
    nextBillingDate: billing.currentPeriodEnd,
    card: billing.cardLast4
      ? { last4: billing.cardLast4, brand: billing.cardBrand, expiry: billing.cardExpiry }
      : null,
  };
}

export function listInvoices(workspaceId: string) {
  return prisma.invoice.findMany({
    where: { billing: { workspaceId } },
    orderBy: { createdAt: "desc" },
  });
}

export function getInvoice(workspaceId: string, invoiceId: string) {
  return prisma.invoice.findFirst({
    where: { id: invoiceId, billing: { workspaceId } },
  });
}

export function addPaymentMethod(
  workspaceId: string,
  input: { cardNumber: string; expiry: string },
) {
  return prisma.billing.update({
    where: { workspaceId },
    data: {
      cardLast4: input.cardNumber.slice(-4),
      cardBrand: cardBrand(input.cardNumber),
      cardExpiry: input.expiry,
      status: BillingStatus.ACTIVE,
    },
  });
}

export function removePaymentMethod(workspaceId: string) {
  return prisma.billing.update({
    where: { workspaceId },
    data: {
      cardLast4: null,
      cardBrand: null,
      cardExpiry: null,
      status: BillingStatus.PAST_DUE,
    },
  });
}

export async function updateStorageTier(workspaceId: string, tier: StorageTier) {
  const billing = await prisma.$transaction(async (tx) => {
    const billing = await tx.billing.update({
      where: { workspaceId },
      data: { storageTier: tier },
    });
    const storageLimitMb = storageLimitByTier(tier);
    await tx.mailbox.updateMany({
      where: { workspaceId },
      data: { storageLimitMb },
    });
    await tx.invoice.create({
      data: {
        billingId: billing.id,
        amount: storagePriceMap[tier],
        mailboxCount: 0,
        storageCost: storagePriceMap[tier],
        status: InvoiceStatus.PENDING,
        periodStart: new Date(),
        periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    return billing;
  });
  const [workspace, owners] = await Promise.all([
    prisma.workspace.findUnique({ where: { id: workspaceId }, select: { name: true } }),
    prisma.workspaceMember.findMany({
      where: { workspaceId, role: Role.OWNER },
      include: { user: { select: { email: true } } },
    }),
  ]);
  await Promise.all(
    owners.map((m) =>
      sendSystemEmail(m.user.email, "billing-storage-upgraded", {
        oldTier: "Previous tier",
        newTier: tier,
        additionalCost: String(storagePriceMap[tier]),
        workspaceName: workspace?.name ?? "Dockmail Workspace",
      }).catch(() => null),
    ),
  );
  return billing;
}

export async function simulatePayment(workspaceId: string) {
  const billing = await prisma.billing.findUnique({
    where: { workspaceId },
    include: { workspace: { include: { mailboxes: true } } },
  });
  if (!billing) throw new Error("NOT_FOUND");
  const mailboxCount = billing.workspace.mailboxes.length;
  const mailboxCost = mailboxCount * env.PRICE_PER_MAILBOX;
  const storageCost = storagePriceMap[billing.storageTier];
  const amount = Number((mailboxCost + storageCost).toFixed(2));

  const invoice = await prisma.invoice.create({
    data: {
      billingId: billing.id,
      amount,
      mailboxCount,
      storageCost,
      status: InvoiceStatus.PAID,
      paidAt: new Date(),
      periodStart: new Date(),
      periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });
  await prisma.billing.update({
    where: { workspaceId },
    data: {
      status: BillingStatus.ACTIVE,
      currentPeriodStart: invoice.periodStart,
      currentPeriodEnd: invoice.periodEnd,
    },
  });
  const owners = await prisma.workspaceMember.findMany({
    where: { workspaceId, role: Role.OWNER },
    include: { user: { select: { email: true } } },
  });
  await Promise.all(
    owners.map((m) =>
      sendSystemEmail(m.user.email, "billing-payment-success", {
        amount: amount.toFixed(2),
        mailboxCount: String(mailboxCount),
        storageLabel: billing.storageTier,
        storageCost: storageCost.toFixed(2),
        periodStart: invoice.periodStart.toISOString(),
        periodEnd: invoice.periodEnd.toISOString(),
        cardBrand: billing.cardBrand ?? "Card",
        cardLast4: billing.cardLast4 ?? "----",
        invoiceId: invoice.id,
      }).catch(() => null),
    ),
  );
  return invoice;
}
