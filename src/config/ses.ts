import nodemailer from "nodemailer";
import { env } from "./env";

export interface SendAppEmailInput {
  /** Sender SMTP address (also used as envelope From when no separate fromName). */
  from: string;
  /** Optional display name for the From header (e.g. mailbox display name in Gmail). */
  fromName?: string;
  to: string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  /** Raw Message-ID value for threading (angle brackets optional). */
  inReplyTo?: string;
  /** Space-separated list of Message-IDs for References header. */
  references?: string;
  smtpAuth?: {
    user: string;
    pass: string;
  };
}

export async function sendAppEmail(input: SendAppEmailInput): Promise<string | undefined> {
  if (!env.SMTP_HOST) {
    throw new Error("SMTP is not configured (SMTP_HOST)");
  }
  const smtpAuth = input.smtpAuth ?? (env.SMTP_USER && env.SMTP_PASS ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined);
  if (!smtpAuth) throw new Error("SMTP is not configured (SMTP_USER / SMTP_PASS)");

  const displayName = input.fromName?.trim();
  const fromHeader = displayName ? { name: displayName, address: input.from.trim() } : input.from;

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE === "true",
    auth: smtpAuth,
  });

  const info = await transporter.sendMail({
    from: fromHeader,
    to: input.to.join(","),
    subject: input.subject,
    html: input.html,
    text: input.text,
    replyTo: input.replyTo,
    inReplyTo: input.inReplyTo,
    references: input.references,
  });

  return info.messageId;
}
