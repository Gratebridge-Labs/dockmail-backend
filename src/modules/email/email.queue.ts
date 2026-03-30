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
    await performSend(payload.mailboxId, payload.emailId);
  });

  emailScheduledQueue.process(async (job) => {
    const payload = job.data as SendJob;
    await performSend(payload.mailboxId, payload.emailId);
  });

  billingCycleQueue.process(async () => {
    logger.info("Billing cycle job executed");
  });

  dnsVerifyQueue.process(async () => {
    logger.info("DNS verify job executed");
  });

  emailSendQueue.on("failed", async (job) => {
    if (!job) return;
    if (job.attemptsMade < 3) return;
    const payload = job.data as SendJob;
    await prisma.email.updateMany({
      where: { id: payload.emailId },
      data: { status: "FAILED" },
    });
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
