/**
 * Retroactively assign threadId using the same resolver as runtime (References → In-Reply-To → subject).
 * Any row still without a match becomes its own thread root (threadId = id).
 * Run: npx ts-node scripts/fix-threads.ts
 */
import { prisma } from "../src/config/database";
import { normalizeReferencesList, resolveThreadId } from "../src/modules/email/threading";

async function fixThreads() {
  const orphans = await prisma.email.findMany({
    where: {
      threadId: null,
      deletedAt: null,
    },
    select: {
      id: true,
      mailboxId: true,
      inReplyTo: true,
      references: true,
      subject: true,
      fromAddress: true,
      toAddresses: true,
      ccAddresses: true,
    },
  });

  console.log(`Found ${orphans.length} email(s) with null threadId`);

  for (const row of orphans) {
    const participants = [...row.toAddresses, ...row.ccAddresses, row.fromAddress].filter(Boolean);
    const resolved = await resolveThreadId(
      row.mailboxId,
      row.inReplyTo,
      normalizeReferencesList(row.references),
      row.subject,
      participants,
    );
    const threadId = resolved ?? row.id;
    await prisma.email.update({
      where: { id: row.id },
      data: { threadId },
    });
    console.log(`email ${row.id} → threadId ${threadId}`);
  }

  console.log("Thread fix complete");
}

fixThreads()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
