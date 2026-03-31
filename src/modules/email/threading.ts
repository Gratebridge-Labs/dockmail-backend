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

export async function resolveThreadId(
  mailboxId: string,
  inReplyTo?: string,
  references: string[] = [],
): Promise<string | undefined> {
  const candidates = normalizeIds([inReplyTo ?? "", ...references]);
  if (!candidates.length) return undefined;

  const parent = await prisma.email.findFirst({
    where: { mailboxId, messageId: { in: candidates } },
    orderBy: { createdAt: "desc" },
    select: { id: true, threadId: true },
  });
  if (!parent) return undefined;

  if (!parent.threadId) {
    await prisma.email.update({
      where: { id: parent.id },
      data: { threadId: parent.id },
    });
    return parent.id;
  }

  return parent.threadId;
}
