import crypto from "node:crypto";
import type { EmailFolder, Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { sendAppEmail } from "../../config/ses";
import { injectTrackingPixel } from "../../utils/tracking";
import { normalizeMessageId, resolveThreadId } from "./threading";

interface ListEmailsOptions {
  folder?: string;
  status?: string;
  isRead?: boolean;
  isStarred?: boolean;
  isDraft?: boolean;
  search?: string;
  fromAddress?: string;
  toAddress?: string;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  perPage?: number;
  /** Default `flat` = one list row per thread (plus one row per standalone message). Use `threaded` for grouped thread summary rows. */
  view?: "flat" | "threaded";
}

function buildEmailWhere(mailboxId: string, options: ListEmailsOptions): Prisma.EmailWhereInput {
  const where: Prisma.EmailWhereInput = {
    mailboxId,
    ...(options.folder ? { folder: options.folder as EmailFolder } : {}),
    ...(options.status ? { status: options.status as Prisma.EnumEmailStatusFilter } : {}),
    ...(typeof options.isRead === "boolean" ? { isRead: options.isRead } : {}),
    ...(typeof options.isStarred === "boolean" ? { isStarred: options.isStarred } : {}),
    ...(typeof options.isDraft === "boolean" ? { isDraft: options.isDraft } : {}),
    ...(options.fromAddress ? { fromAddress: { contains: options.fromAddress, mode: "insensitive" } } : {}),
    ...(options.toAddress ? { toAddresses: { has: options.toAddress } } : {}),
  };

  if (options.dateFrom || options.dateTo) {
    where.createdAt = {
      ...(options.dateFrom ? { gte: options.dateFrom } : {}),
      ...(options.dateTo ? { lte: options.dateTo } : {}),
    };
  }

  if (options.search && options.search.trim()) {
    const s = options.search.trim();
    where.OR = [
      { subject: { contains: s, mode: "insensitive" } },
      { fromAddress: { contains: s, mode: "insensitive" } },
      { bodyText: { contains: s, mode: "insensitive" } },
      { bodyHtml: { contains: s, mode: "insensitive" } },
      { toAddresses: { has: s } },
    ];
  }

  return where;
}

function formatInReplyToHeader(raw: string | null | undefined): string | undefined {
  const n = normalizeMessageId(raw ?? undefined);
  return n ? `<${n}>` : undefined;
}

function formatReferencesHeader(ids: string[]): string | undefined {
  if (!ids?.length) return undefined;
  const parts = ids
    .map((id) => {
      const n = normalizeMessageId(id);
      return n ? `<${n}>` : "";
    })
    .filter(Boolean);
  return parts.length ? parts.join(" ") : undefined;
}

export async function listEmails(mailboxId: string, options: ListEmailsOptions = {}) {
  if (options.view === "threaded") {
    return listEmailsThreaded(mailboxId, options);
  }
  return listEmailsFlat(mailboxId, options);
}

function activityTime(
  receivedAt: Date | null,
  sentAt: Date | null,
  createdAt: Date,
): number {
  return (receivedAt ?? sentAt ?? createdAt).getTime();
}

type EmailWithAttachments = Awaited<
  ReturnType<
    typeof prisma.email.findMany<{
      include: { attachments: true };
    }>
  >
>[number];

async function listEmailsFlat(mailboxId: string, options: ListEmailsOptions = {}) {
  const page = Math.max(1, options.page ?? 1);
  const perPage = Math.min(50, Math.max(1, options.perPage ?? 50));
  const skip = (page - 1) * perPage;

  const whereBase = buildEmailWhere(mailboxId, options);
  const whereList: Prisma.EmailWhereInput = {
    ...whereBase,
    ...(options.folder === "TRASH" ? {} : { deletedAt: null }),
  };

  const [threadedGroups, standaloneRows] = await Promise.all([
    prisma.email.groupBy({
      by: ["threadId"],
      where: { ...whereList, threadId: { not: null } },
      _max: { receivedAt: true, sentAt: true, createdAt: true },
    }),
    prisma.email.findMany({
      where: { ...whereList, threadId: null },
      select: {
        id: true,
        receivedAt: true,
        sentAt: true,
        createdAt: true,
      },
    }),
  ]);

  type RowPlan =
    | { kind: "thread"; threadId: string; sortKey: number }
    | { kind: "standalone"; emailId: string; sortKey: number };

  const plans: RowPlan[] = [];

  for (const g of threadedGroups) {
    const tid = g.threadId!;
    const sortKey = activityTime(
      g._max.receivedAt,
      g._max.sentAt,
      g._max.createdAt ?? new Date(0),
    );
    plans.push({ kind: "thread", threadId: tid, sortKey });
  }

  for (const s of standaloneRows) {
    plans.push({
      kind: "standalone",
      emailId: s.id,
      sortKey: activityTime(s.receivedAt, s.sentAt, s.createdAt),
    });
  }

  plans.sort((a, b) => b.sortKey - a.sortKey);

  const total = plans.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const pagePlans = plans.slice(skip, skip + perPage);

  const threadIdsOnPage = pagePlans.filter((p) => p.kind === "thread").map((p) => p.threadId);
  const standaloneIdsOnPage = pagePlans.filter((p) => p.kind === "standalone").map((p) => p.emailId);

  const messagesByThread = new Map<string, EmailWithAttachments[]>();
  if (threadIdsOnPage.length) {
    const allInThreads = await prisma.email.findMany({
      where: {
        mailboxId,
        deletedAt: null,
        threadId: { in: threadIdsOnPage },
      },
      include: { attachments: true },
      orderBy: [{ receivedAt: "asc" }, { createdAt: "asc" }],
    });
    for (const row of allInThreads) {
      if (!row.threadId) continue;
      const arr = messagesByThread.get(row.threadId) ?? [];
      arr.push(row);
      messagesByThread.set(row.threadId, arr);
    }
  }

  const repByThread = new Map<string, EmailWithAttachments>();
  if (threadIdsOnPage.length) {
    const candidates = await prisma.email.findMany({
      where: {
        ...whereList,
        threadId: { in: threadIdsOnPage },
      },
      orderBy: [{ receivedAt: "desc" }, { sentAt: "desc" }, { createdAt: "desc" }],
      include: { attachments: true },
    });
    for (const e of candidates) {
      if (!e.threadId) continue;
      if (!repByThread.has(e.threadId)) {
        repByThread.set(e.threadId, e);
      }
    }
  }

  const standaloneById = new Map<string, EmailWithAttachments>();
  if (standaloneIdsOnPage.length) {
    const rows = await prisma.email.findMany({
      where: { id: { in: standaloneIdsOnPage }, mailboxId },
      include: { attachments: true },
    });
    for (const r of rows) {
      standaloneById.set(r.id, r);
    }
  }

  type ItemRow = EmailWithAttachments & {
    isThreadRoot: boolean;
    thread:
      | null
      | {
          id: string;
          messageCount: number;
          messages: EmailWithAttachments[];
          original: EmailWithAttachments;
          latest: EmailWithAttachments;
        };
  };

  const itemsWithThread: ItemRow[] = [];

  for (const plan of pagePlans) {
    if (plan.kind === "standalone") {
      const email = standaloneById.get(plan.emailId);
      if (!email) continue;
      itemsWithThread.push({ ...email, isThreadRoot: true, thread: null });
      continue;
    }

    const rep = repByThread.get(plan.threadId);
    if (!rep) continue;

    const tid = plan.threadId;
    const messages = messagesByThread.get(tid);
    const fullThread = messages && messages.length > 0 ? messages : [rep];

    itemsWithThread.push({
      ...rep,
      isThreadRoot: rep.id === tid,
      thread: {
        id: tid,
        messageCount: fullThread.length,
        messages: fullThread,
        original: fullThread[0],
        latest: fullThread[fullThread.length - 1],
      },
    });
  }

  return {
    view: "flat" as const,
    items: itemsWithThread,
    meta: {
      page,
      perPage,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
}

function intersectThreadIds(a: string[] | undefined, b: string[] | undefined): string[] | undefined {
  if (!a) return b;
  if (!b) return a;
  const setB = new Set(b);
  return a.filter((id) => setB.has(id));
}

/** Thread ids matching read/unread state for emails in optional folder. */
async function threadIdsForReadFilter(
  mailboxId: string,
  folder: string | undefined,
  isRead: boolean,
): Promise<string[]> {
  const rows = await prisma.email.findMany({
    where: {
      mailboxId,
      deletedAt: null,
      ...(folder ? { folder: folder as EmailFolder } : {}),
    },
    select: { threadId: true, id: true, isRead: true },
    take: 12_000,
  });
  const unreadCount = new Map<string, number>();
  const all = new Set<string>();
  for (const e of rows) {
    const tid = e.threadId ?? e.id;
    all.add(tid);
    if (!e.isRead) {
      unreadCount.set(tid, (unreadCount.get(tid) ?? 0) + 1);
    }
  }
  if (!isRead) {
    return [...all].filter((tid) => (unreadCount.get(tid) ?? 0) > 0);
  }
  return [...all].filter((tid) => (unreadCount.get(tid) ?? 0) === 0);
}

async function listEmailsThreaded(mailboxId: string, options: ListEmailsOptions = {}) {
  const page = Math.max(1, options.page ?? 1);
  const perPage = Math.min(50, Math.max(1, options.perPage ?? 50));
  const skip = (page - 1) * perPage;

  const base: Prisma.EmailWhereInput = {
    ...buildEmailWhere(mailboxId, options),
    deletedAt: null,
    threadId: { not: null },
  };

  let allowedThreadIds: string[] | undefined;

  if (options.search?.trim()) {
    const hits = await prisma.email.findMany({
      where: {
        mailboxId,
        deletedAt: null,
        ...buildEmailWhere(mailboxId, { ...options, search: options.search }),
      },
      select: { threadId: true, id: true },
      take: 3000,
    });
    allowedThreadIds = [...new Set(hits.map((h) => h.threadId ?? h.id))];
    if (allowedThreadIds.length === 0) {
      return {
        view: "threaded" as const,
        threads: [] as unknown[],
        meta: {
          page,
          perPage,
          total: 0,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        },
      };
    }
  }

  if (typeof options.isRead === "boolean") {
    const readTids = await threadIdsForReadFilter(mailboxId, options.folder, options.isRead);
    allowedThreadIds = intersectThreadIds(allowedThreadIds, readTids);
    if (allowedThreadIds !== undefined && allowedThreadIds.length === 0) {
      return {
        view: "threaded" as const,
        threads: [],
        meta: {
          page,
          perPage,
          total: 0,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        },
      };
    }
  }

  if (allowedThreadIds) {
    base.threadId = { in: allowedThreadIds };
  }

  const groups = await prisma.email.groupBy({
    by: ["threadId"],
    where: base,
    _max: { receivedAt: true, createdAt: true },
  });

  const sorted = [...groups].sort((a, b) => {
    const ta = a._max.receivedAt?.getTime() ?? a._max.createdAt?.getTime() ?? 0;
    const tb = b._max.receivedAt?.getTime() ?? b._max.createdAt?.getTime() ?? 0;
    return tb - ta;
  });

  const totalThreads = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalThreads / perPage));
  const pageSlice = sorted.slice(skip, skip + perPage);

  const threads = await Promise.all(
    pageSlice.map(async (g) => {
      const tid = g.threadId!;
      const emails = await prisma.email.findMany({
        where: { mailboxId, threadId: tid, deletedAt: null },
        orderBy: [{ receivedAt: "asc" }, { createdAt: "asc" }],
        include: {
          attachments: { select: { id: true, filename: true, sizeBytes: true } },
        },
      });
      const latest = emails[emails.length - 1];
      const oldest = emails[0];
      const unreadCount = emails.filter((e) => !e.isRead).length;
      const hasAttachments = emails.some((e) => e.attachments.length > 0);
      const participants = [
        ...new Set(
          emails.map((e) => (e.fromName?.trim() ? e.fromName : e.fromAddress.split("@")[0]) || e.fromAddress),
        ),
      ];

      return {
        threadId: tid,
        subject: oldest?.subject ?? latest.subject,
        snippet: latest.snippet ?? latest.bodyText?.slice(0, 200) ?? "",
        messageCount: emails.length,
        unreadCount,
        isStarred: emails.some((e) => e.isStarred),
        hasAttachments,
        participants,
        latestAt: latest.receivedAt ?? latest.createdAt,
        latestEmail: {
          id: latest.id,
          fromAddress: latest.fromAddress,
          fromName: latest.fromName,
          isRead: latest.isRead,
          folder: latest.folder,
          trackingStatus: latest.trackingId ? "tracked" : null,
        },
        emailIds: emails.map((e) => e.id),
      };
    }),
  );

  return {
    view: "threaded" as const,
    threads,
    meta: {
      page,
      perPage,
      total: totalThreads,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
}

export async function createDraft(mailboxId: string, input: Record<string, unknown>) {
  const mailbox = await prisma.mailbox.findFirst({ where: { id: mailboxId } });
  if (!mailbox) throw new Error("NOT_FOUND");

  const toAddresses = (input.toAddresses as string[]) ?? [];
  const ccAddresses = (input.ccAddresses as string[]) ?? [];
  const subject = String(input.subject ?? "");
  const participants = [mailbox.email, ...toAddresses, ...ccAddresses].filter(Boolean);

  let threadId = await resolveThreadId(
    mailboxId,
    (input.inReplyTo as string | null) ?? null,
    (input.references as string[]) ?? [],
    subject,
    participants,
  );

  const created = await prisma.email.create({
    data: {
      mailboxId,
      folder: "DRAFTS",
      fromAddress: mailbox.email,
      fromName: mailbox.displayName ?? undefined,
      subject,
      bodyHtml: String(input.bodyHtml ?? ""),
      bodyText: input.bodyText as string | undefined,
      toAddresses,
      ccAddresses,
      bccAddresses: (input.bccAddresses as string[]) ?? [],
      replyTo: input.replyTo as string | undefined,
      inReplyTo: input.inReplyTo as string | undefined,
      references: (input.references as string[]) ?? [],
      threadId: threadId ?? undefined,
      isDraft: true,
      status: "DRAFT",
      readReceiptEnabled: (input.readReceiptEnabled as boolean) ?? true,
    },
  });

  if (!threadId) {
    return prisma.email.update({
      where: { id: created.id },
      data: { threadId: created.id, folder: "DRAFTS" },
    });
  }

  return created;
}

export async function sendDraft(mailboxId: string, emailId: string, scheduledAt?: string) {
  const email = await prisma.email.findFirst({
    where: { id: emailId, mailboxId },
    include: { mailbox: true },
  });
  if (!email) throw new Error("NOT_FOUND");
  if (!email.toAddresses.length || !email.subject) throw new Error("VALIDATION");

  const fromData = {
    fromAddress: email.mailbox.email,
    fromName: email.mailbox.displayName ?? undefined,
  };

  if (scheduledAt) {
    return prisma.email.update({
      where: { id: email.id },
      data: {
        status: "SCHEDULED",
        isScheduled: true,
        scheduledAt: new Date(scheduledAt),
        folder: "DRAFTS",
        ...fromData,
      },
    });
  }

  return prisma.email.update({
    where: { id: email.id },
    data: { status: "QUEUED", isScheduled: false, folder: "DRAFTS", ...fromData },
  });
}

export async function performSend(mailboxId: string, emailId: string) {
  const email = await prisma.email.findFirst({
    where: { id: emailId, mailboxId },
    include: { mailbox: true },
  });
  if (!email) throw new Error("NOT_FOUND");
  if (!email.toAddresses.length || !email.subject) throw new Error("VALIDATION");

  const participants = [email.mailbox.email, ...email.toAddresses, ...email.ccAddresses];

  let resolvedThreadId =
    email.threadId ??
    (await resolveThreadId(
      mailboxId,
      email.inReplyTo,
      email.references ?? [],
      email.subject,
      participants,
    ));
  if (!resolvedThreadId) {
    resolvedThreadId = email.id;
  }

  const trackingId = email.trackingId ?? crypto.randomUUID();
  const trackingBase = env.TRACKING_PIXEL_URL.trim();
  const normalizedBase = /^https?:\/\//i.test(trackingBase)
    ? trackingBase
    : `${(env.API_URL ?? "").replace(/\/$/, "")}/${trackingBase.replace(/^\/+/, "")}`;
  const trackingUrl = `${normalizedBase.replace(/\/$/, "")}/${trackingId}`;
  const bodyHtml = injectTrackingPixel(email.bodyHtml, trackingUrl);

  const from = email.mailbox.email;
  const fromName = email.mailbox.displayName?.trim() || undefined;
  let messageId: string | undefined;
  try {
    messageId = await sendAppEmail({
      from,
      fromName,
      to: email.toAddresses,
      subject: email.subject,
      html: bodyHtml,
      text: email.bodyText ?? undefined,
      replyTo: email.replyTo ?? undefined,
      inReplyTo: formatInReplyToHeader(email.inReplyTo),
      references: formatReferencesHeader(email.references ?? []),
      smtpAuth: {
        user: email.mailbox.email,
        pass: email.mailbox.password,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error(`SES send failed mailbox=${mailboxId} email=${emailId} from=${from} — ${msg}`);
    throw e;
  }

  const normalizedMsgId = normalizeMessageId(messageId);

  return prisma.email.update({
    where: { id: email.id },
    data: {
      status: "SENT",
      folder: "SENT",
      sentAt: new Date(),
      isDraft: false,
      fromAddress: from,
      fromName: email.mailbox.displayName ?? undefined,
      trackingId,
      messageId: normalizedMsgId,
      threadId: resolvedThreadId,
    },
  });
}

export function moveToTrash(mailboxId: string, emailId: string) {
  return prisma.email.updateMany({
    where: { id: emailId, mailboxId },
    data: { folder: "TRASH", deletedAt: new Date() },
  });
}

export async function permanentDelete(mailboxId: string, emailId: string) {
  const email = await prisma.email.findFirst({ where: { id: emailId, mailboxId } });
  if (!email || email.folder !== "TRASH") throw new Error("NOT_FOUND");
  await prisma.attachment.deleteMany({ where: { emailId } });
  return prisma.email.delete({ where: { id: emailId } });
}

export async function bulkAction(
  mailboxId: string,
  input: { emailIds: string[]; action: string },
) {
  const map: Record<string, Record<string, unknown>> = {
    MARK_READ: { isRead: true },
    MARK_UNREAD: { isRead: false },
    STAR: { isStarred: true },
    UNSTAR: { isStarred: false },
    TRASH: { folder: "TRASH", deletedAt: new Date() },
    ARCHIVE: { folder: "ARCHIVE" },
    SPAM: { folder: "SPAM" },
    RESTORE: { folder: "INBOX", deletedAt: null },
  };
  if (input.action === "PERMANENT_DELETE") {
    await prisma.email.deleteMany({
      where: { id: { in: input.emailIds }, mailboxId, folder: "TRASH" },
    });
    return { affected: input.emailIds.length, emailIds: input.emailIds };
  }
  const data = map[input.action];
  const updated = await prisma.email.updateMany({
    where: { id: { in: input.emailIds }, mailboxId },
    data,
  });
  return { affected: updated.count, emailIds: input.emailIds };
}

export function moveEmail(mailboxId: string, emailId: string, folder: string) {
  return prisma.email.updateMany({
    where: { id: emailId, mailboxId },
    data: { folder: folder as never },
  });
}

export async function getThread(mailboxId: string, emailId: string) {
  const email = await prisma.email.findFirst({ where: { id: emailId, mailboxId } });
  if (!email) return null;
  if (!email.threadId) return [email];
  return prisma.email.findMany({
    where: { mailboxId, threadId: email.threadId },
    orderBy: { createdAt: "asc" },
  });
}

export async function getThreadByThreadId(mailboxId: string, threadId: string) {
  const emails = await prisma.email.findMany({
    where: { mailboxId, threadId, deletedAt: null },
    orderBy: [{ receivedAt: "asc" }, { createdAt: "asc" }],
    include: {
      attachments: true,
      trackingEvents: {
        where: { event: "OPENED" },
        orderBy: { occurredAt: "desc" },
        take: 1,
      },
    },
  });
  if (!emails.length) return null;

  await prisma.email.updateMany({
    where: { mailboxId, threadId, isRead: false },
    data: { isRead: true },
  });

  return emails.map((e) => ({ ...e, isRead: true }));
}

export function cancelSchedule(mailboxId: string, emailId: string) {
  return prisma.email.updateMany({
    where: { id: emailId, mailboxId, status: "SCHEDULED" },
    data: {
      status: "DRAFT",
      isScheduled: false,
      scheduledAt: null,
      isDraft: true,
      folder: "DRAFTS",
    },
  });
}
