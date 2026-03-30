import Bull from "bull";
import { env } from "./env";

export const emailSendQueue = new Bull("email:send", env.REDIS_URL);
export const emailScheduledQueue = new Bull("email:scheduled", env.REDIS_URL);
export const billingCycleQueue = new Bull("billing:cycle", env.REDIS_URL);
export const dnsVerifyQueue = new Bull("dns:verify", env.REDIS_URL);

export const defaultJobOptions = {
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 5000 },
};
