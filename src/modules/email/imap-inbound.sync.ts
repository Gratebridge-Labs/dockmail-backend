import fs from "node:fs";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import type { AddressObject, ParsedMail } from "mailparser";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { io } from "../../config/socket";
import { attachmentPath } from "../attachment/attachment.service";
import { normalizeMessageId, normalizeReferencesList, resolveThreadId } from "./threading";

const SYSTEM_SENDER_ADDRESSES = new Set([
  "noreply@dockmail.app",
  "system@dockmail.app",
  "no-reply@dockmail.app",
]);

type MailboxRow = Prisma.MailboxGetPayload<{ include: { domain: true } }>;

function imapHost() {
  return env.IMAP_HOST ?? env.INBOUND_MX_HOST;
}

function formatAddresses(list: AddressObject | AddressObject[] | undefined): string[] {
  if (!list) return [];
  const arr = Array.isArray(list) ? list : [list];
  const out: string[] = [];
  for (const a of arr) {
    for (const v of a.value) {
      if (v.address) out.push(v.address);
    }
  }
  return out;
}

function firstFrom(parsed: ParsedMail): { address: string; name?: string } {
  const from = parsed.from?.value?.[0];
  return {
    address: from?.address || "unknown@invalid",
    name: from?.name || undefined,
  };
}

function sanitizeFilename(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "_").slice(0, 200) || "attachment";
}

async function persistInboundEmail(mb: MailboxRow, uid: number, raw: Buffer) {
  const parsed = await simpleParser(raw);
  const msgId = normalizeMessageId(parsed.messageId);

  if (msgId) {
    const exists = await prisma.email.findFirst({ where: { messageId: msgId } });
    if (exists) {
      await prisma.mailbox.update({
        where: { id: mb.id },
        data: { imapLastUid: uid },
      });
      return;
    }
  }

  const from = firstFrom(parsed);
  if (SYSTEM_SENDER_ADDRESSES.has(from.address.toLowerCase())) {
    logger.info(`imap inbound: dropped system sender ${from.address} mailbox=${mb.id} uid=${uid}`);
    await prisma.mailbox.update({
      where: { id: mb.id },
      data: { imapLastUid: uid },
    });
    return;
  }

  const toAddresses = formatAddresses(parsed.to);
  const ccAddresses = formatAddresses(parsed.cc);
  const bccAddresses = formatAddresses(parsed.bcc);
  const subject = (parsed.subject || "").trim() || "(no subject)";
  const bodyHtml =
    typeof parsed.html === "string" && parsed.html.trim()
      ? parsed.html
      : `<pre>${escapeHtml(parsed.text || "")}</pre>`;
  const bodyText = parsed.text ?? undefined;
  const snippet = (parsed.text || parsed.subject || "").slice(0, 200);
  const referencesRaw = parsed.references;
  const references = normalizeReferencesList(
    Array.isArray(referencesRaw) ? referencesRaw.map(String) : referencesRaw ? [String(referencesRaw)] : undefined,
  );

  const replyTo = parsed.replyTo?.value?.[0]?.address ?? undefined;
  const inReplyTo = normalizeMessageId(
    typeof parsed.inReplyTo === "string" ? parsed.inReplyTo : parsed.inReplyTo?.[0],
  );
  const participants = [from.address, ...toAddresses, ...ccAddresses].filter(Boolean);
  const threadId = await resolveThreadId(mb.id, inReplyTo, references, subject, participants);

  let sizeBytes = Buffer.byteLength(bodyHtml, "utf8");
  for (const a of parsed.attachments) {
    sizeBytes += a.size || a.content?.length || 0;
  }

  const email = await prisma.email.create({
    data: {
      mailboxId: mb.id,
      folder: "INBOX",
      status: "RECEIVED",
      fromAddress: from.address,
      fromName: from.name,
      toAddresses,
      ccAddresses,
      bccAddresses,
      replyTo,
      subject,
      bodyHtml,
      bodyText,
      snippet,
      messageId: msgId,
      inReplyTo,
      references,
      threadId: threadId ?? undefined,
      isDraft: false,
      isRead: false,
      receivedAt: parsed.date ?? new Date(),
      sizeBytes,
    },
  });

  if (!threadId) {
    await prisma.email.update({
      where: { id: email.id },
      data: { threadId: email.id },
    });
  }

  for (const att of parsed.attachments) {
    const filename = sanitizeFilename(att.filename || "attachment");
    const storagePath = attachmentPath(env.UPLOAD_DIR, mb.workspaceId, mb.id, email.id, filename);
    try {
      fs.writeFileSync(storagePath, att.content);
      const sz = att.size || att.content.length;
      const projectedMb = mb.storageUsedMb + Math.ceil(sz / 1024 / 1024);
      if (projectedMb > mb.storageLimitMb) {
        logger.warn(`imap inbound: storage limit for mailbox=${mb.id}, skipping attachment ${filename}`);
        if (fs.existsSync(storagePath)) fs.unlinkSync(storagePath);
        continue;
      }
      await prisma.attachment.create({
        data: {
          emailId: email.id,
          filename,
          mimeType: att.contentType || "application/octet-stream",
          sizeBytes: sz,
          storagePath,
        },
      });
      await prisma.mailbox.update({
        where: { id: mb.id },
        data: { storageUsedMb: projectedMb },
      });
      mb.storageUsedMb = projectedMb;
    } catch (e) {
      logger.error(
        `imap inbound: attachment failed mailbox=${mb.id} email=${email.id} — ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  await prisma.mailbox.update({
    where: { id: mb.id },
    data: { imapLastUid: uid },
  });

  const assignments = await prisma.mailboxAssignment.findMany({ where: { mailboxId: mb.id } });
  if (assignments.length) {
    await prisma.notification.createMany({
      data: assignments.map((a) => ({
        userId: a.userId,
        workspaceId: mb.workspaceId,
        type: "NEW_EMAIL" as const,
        title: "New email",
        body: subject,
        data: { emailId: email.id, mailboxId: mb.id },
      })),
    });
  }

  try {
    io.to(`mailbox:${mb.id}`).emit("email:received", {
      mailboxId: mb.id,
      emailId: email.id,
      subject,
      fromAddress: from.address,
    });
  } catch (e) {
    logger.warn(`imap inbound: socket emit failed — ${e instanceof Error ? e.message : String(e)}`);
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function fetchAndStoreUid(client: ImapFlow, mb: MailboxRow, uid: number) {
  let found = false;
  for await (const msg of client.fetch(
    { uid: `${uid}:${uid}` },
    { source: true, uid: true },
    { uid: true },
  )) {
    found = true;
    if (!msg.source?.length) {
      await prisma.mailbox.update({ where: { id: mb.id }, data: { imapLastUid: uid } });
      continue;
    }
    try {
      await persistInboundEmail(mb, uid, msg.source);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        await prisma.mailbox.update({ where: { id: mb.id }, data: { imapLastUid: uid } });
        return;
      }
      logger.error(
        `imap inbound: persist failed uid=${uid} mailbox=${mb.id} — ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
  if (!found) {
    await prisma.mailbox.update({ where: { id: mb.id }, data: { imapLastUid: uid } });
  }
}

async function syncInbox(client: ImapFlow, mb: MailboxRow) {
  const fresh = await prisma.mailbox.findUnique({
    where: { id: mb.id },
    include: { domain: true },
  });
  if (!fresh) return;
  mb = fresh;

  const last = mb.imapLastUid;

  if (last == null) {
    const all = await client.search({ all: true });
    if (!all || all.length === 0) return;
    const sorted = [...all].sort((a, b) => a - b);
    const limit = env.IMAP_INITIAL_SYNC_LIMIT;
    const slice = sorted.slice(-limit);
    for (const uid of slice) {
      await fetchAndStoreUid(client, mb, uid);
      const updated = await prisma.mailbox.findUnique({ where: { id: mb.id }, include: { domain: true } });
      if (updated) mb = updated;
    }
    return;
  }

  const uids = await client.search({ uid: `${last + 1}:*` });
  if (!uids || uids.length === 0) return;
  const sorted = [...uids].sort((a, b) => a - b);
  for (const uid of sorted) {
    await fetchAndStoreUid(client, mb, uid);
    const updated = await prisma.mailbox.findUnique({ where: { id: mb.id }, include: { domain: true } });
    if (updated) mb = updated;
  }
}

function createImapClient(mb: MailboxRow) {
  const tls: { rejectUnauthorized?: boolean } = {};
  if (env.IMAP_TLS_INSECURE === "true") {
    tls.rejectUnauthorized = false;
  }

  return new ImapFlow({
    host: imapHost(),
    port: env.IMAP_PORT,
    secure: true,
    auth: {
      user: mb.email,
      pass: mb.password,
    },
    logger: false,
    /** We call `idle()` ourselves; auto-idle would leave `idling=true` and make `idle()` a no-op (busy-loop). */
    disableAutoIdle: true,
    tls: Object.keys(tls).length ? tls : undefined,
    // Keep finite socket timeout to avoid stale hung connections.
    socketTimeout: 5 * 60 * 1000,
    connectionTimeout: 90_000,
    // Shorter IDLE cycle keeps worst-case inbox lag low.
    maxIdleTime: 60 * 1000,
  });
}

async function runMailboxSession(mb: MailboxRow) {
  const label = `imap:${mb.email}`;
  while (true) {
    const client = createImapClient(mb);
    let lock: { release: () => void } | null = null;
    try {
      client.on("error", (err) => {
        logger.warn(
          `${label} client error — ${err instanceof Error ? err.message : String(err)}`,
          err instanceof Error ? err : undefined,
        );
      });
      client.on("close", () => {
        logger.warn(`${label} client closed`);
      });

      await client.connect();
      lock = await client.getMailboxLock("INBOX");
      let syncing = false;
      const safeSync = async (reason: string) => {
        if (syncing) return;
        syncing = true;
        logger.info(`${label} sync:start reason=${reason}`);
        try {
          await syncInbox(client, mb);
          const latest = await prisma.mailbox.findUnique({
            where: { id: mb.id },
            include: { domain: true },
          });
          if (latest) mb = latest;
          logger.info(`${label} sync:done reason=${reason}`);
        } catch (e) {
          logger.error(
            `${label} sync:error reason=${reason} — ${e instanceof Error ? e.message : String(e)}`,
            e instanceof Error ? e : undefined,
          );
        } finally {
          syncing = false;
        }
      };

      await safeSync("session-start");

      client.on("exists", () => {
        void safeSync("exists-event");
      });

      const poll = setInterval(() => {
        void safeSync("poll");
      }, 15_000);

      while (client.usable) {
        try {
          logger.info(`${label} idle:waiting`);
          await client.idle();
          await safeSync("idle-return");
        } catch (e) {
          logger.warn(
            `${label} idle loop interrupted — ${e instanceof Error ? e.message : String(e)}`,
            e instanceof Error ? e : undefined,
          );
          break;
        }
      }
      clearInterval(poll);
    } catch (e) {
      logger.error(
        `${label} session error — ${e instanceof Error ? e.message : String(e)}`,
        e instanceof Error ? e : undefined,
      );
    } finally {
      try {
        lock?.release();
      } catch {
        /* ignore */
      }
      try {
        await client.logout();
      } catch {
        client.close();
      }
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
}

export function startImapInboundSync() {
  if (env.IMAP_SYNC_ENABLED === "false") {
    logger.info("IMAP inbound sync disabled (IMAP_SYNC_ENABLED=false)");
    return;
  }

  void (async () => {
    await new Promise((r) => setTimeout(r, 1500));
    try {
      const mailboxes = await prisma.mailbox.findMany({
        where: { status: "ACTIVE" },
        include: { domain: true },
      });
      logger.info(`IMAP inbound: starting ${mailboxes.length} mailbox session(s) → ${imapHost()}:${env.IMAP_PORT}`);
      for (let i = 0; i < mailboxes.length; i++) {
        void runMailboxSession(mailboxes[i]);
        await new Promise((r) => setTimeout(r, 150));
      }
    } catch (e) {
      logger.error(`IMAP inbound: failed to list mailboxes — ${e instanceof Error ? e.message : String(e)}`);
    }
  })();
}
