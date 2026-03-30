import { billingCycleQueue, defaultJobOptions, dnsVerifyQueue, emailScheduledQueue, emailSendQueue } from "../../config/queue";
import { prisma } from "../../config/database";
import { performSend } from "./email.service";
import { logger } from "../../config/logger";

interface SendJob {
  mailboxId: string;
  emailId: string;
}

export function registerEmailWorkers() {
  emailSendQueue.process(async (job) => {
    const payload = job.data as SendJob;
    try {
      await performSend(payload.mailboxId, payload.emailId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error(
        `email:send job failed attempt=${job.attemptsMade} mailbox=${payload.mailboxId} email=${payload.emailId} — ${msg}`,
      );
      throw e;
    }
  });

  emailScheduledQueue.process(async (job) => {
    const payload = job.data as SendJob;
    try {
      await performSend(payload.mailboxId, payload.emailId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error(
        `email:scheduled job failed attempt=${job.attemptsMade} mailbox=${payload.mailboxId} email=${payload.emailId} — ${msg}`,
      );
      throw e;
    }
  });

  billingCycleQueue.process(async () => {
    logger.info("Billing cycle job executed");
  });

  dnsVerifyQueue.process(async () => {
    logger.info("DNS verify job executed");
  });

  emailSendQueue.on("failed", async (job, err) => {
    if (!job) return;
    const payload = job.data as SendJob;
    const reason = err instanceof Error ? err.message : String(err);
    if (job.attemptsMade >= 3) {
      logger.error(
        `email:send permanently failed after ${job.attemptsMade} attempts email=${payload.emailId} — ${reason}`,
      );
      await prisma.email.updateMany({
        where: { id: payload.emailId },
        data: { status: "FAILED" },
      });
    }
  });
}

export async function queueSend(mailboxId: string, emailId: string) {
  await emailSendQueue.add({ mailboxId, emailId }, defaultJobOptions);
}

export async function queueScheduledSend(mailboxId: string, emailId: string, when: Date) {
  await emailScheduledQueue.add(
    { mailboxId, emailId },
    { ...defaultJobOptions, delay: Math.max(0, when.getTime() - Date.now()) },
  );
}
