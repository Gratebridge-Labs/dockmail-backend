import { prisma } from "../../config/database";

export function normalizeMessageId(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  return raw.replace(/^<|>$/g, "").trim() || undefined;
}

function normalizeIds(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const normalized = normalizeMessageId(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

/** Split References header / array into normalized message-id tokens. */
export function normalizeReferencesList(references: string[] | string | undefined): string[] {
  if (!references) return [];
  const raw = Array.isArray(references) ? references.join(" ") : String(references);
  return normalizeIds(raw.split(/\s+/).filter(Boolean));
}

export function normalizeSubjectForThread(subject: string): string {
  return subject
    .replace(/^(Re|Fwd|Fw|RE|FWD|FW):\s*/gi, "")
    .trim()
    .toLowerCase();
}

function participantOverlap(
  email: { fromAddress: string; toAddresses: string[]; ccAddresses: string[] },
  participants: string[],
): boolean {
  const set = new Set(participants.map((p) => p.toLowerCase()));
  if (set.has(email.fromAddress.toLowerCase())) return true;
  return [...email.toAddresses, ...email.ccAddresses].some((a) => set.has(a.toLowerCase()));
}

/**
 * Gmail-style thread resolution: References → In-Reply-To → subject + participants.
 * Returns the canonical thread id (root email id), or undefined if this email should become a new root.
 */
export async function resolveThreadId(
  mailboxId: string,
  inReplyTo: string | null | undefined,
  references: string[],
  subject: string,
  participants: string[],
): Promise<string | undefined> {
  const normRefs = normalizeReferencesList(references);

  for (const ref of normRefs) {
    const referencedEmail = await prisma.email.findFirst({
      where: { mailboxId, messageId: ref, deletedAt: null },
      select: { threadId: true, id: true },
    });
    if (referencedEmail) {
      const root = referencedEmail.threadId ?? referencedEmail.id;
      if (!referencedEmail.threadId) {
        await prisma.email.update({
          where: { id: referencedEmail.id },
          data: { threadId: referencedEmail.id },
        });
      }
      return root;
    }
  }

  const cleanInReplyTo = normalizeMessageId(inReplyTo ?? undefined);
  if (cleanInReplyTo) {
    const parent = await prisma.email.findFirst({
      where: { mailboxId, messageId: cleanInReplyTo, deletedAt: null },
      select: { threadId: true, id: true },
    });
    if (parent) {
      const root = parent.threadId ?? parent.id;
      if (!parent.threadId) {
        await prisma.email.update({
          where: { id: parent.id },
          data: { threadId: parent.id },
        });
      }
      return root;
    }
  }

  const normalizedSubject = normalizeSubjectForThread(subject);
  const filteredParticipants = participants.map((p) => p.trim()).filter(Boolean);
  if (normalizedSubject.length > 3 && filteredParticipants.length > 0) {
    const candidates = await prisma.email.findMany({
      where: {
        mailboxId,
        deletedAt: null,
        OR: [
          { fromAddress: { in: filteredParticipants } },
          ...filteredParticipants.flatMap((p) => [
            { toAddresses: { has: p } },
            { ccAddresses: { has: p } },
          ]),
        ],
      },
      select: {
        id: true,
        threadId: true,
        subject: true,
        fromAddress: true,
        toAddresses: true,
        ccAddresses: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
      take: 400,
    });

    const match = candidates.find(
      (row) =>
        normalizeSubjectForThread(row.subject) === normalizedSubject && participantOverlap(row, filteredParticipants),
    );
    if (match) {
      const root = match.threadId ?? match.id;
      if (!match.threadId) {
        await prisma.email.update({
          where: { id: match.id },
          data: { threadId: match.id },
        });
      }
      return root;
    }
  }

  return undefined;
}
