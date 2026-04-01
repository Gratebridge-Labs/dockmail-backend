/**
 * One-off: remove read-receipt emails that were incorrectly stored via IMAP ingestion.
 * Run: npx ts-node scripts/cleanup-receipt-emails.ts
 */
import { prisma } from "../src/config/database";

async function cleanup() {
  const deleted = await prisma.email.deleteMany({
    where: {
      fromAddress: { contains: "noreply@dockmail.app", mode: "insensitive" },
      subject: { contains: "opened your email", mode: "insensitive" },
    },
  });
  console.log(`Deleted ${deleted.count} read receipt email row(s)`);
}

cleanup()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
