import nodemailer from "nodemailer";
import { env } from "./env";

export interface SendAppEmailInput {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
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

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE === "true",
    auth: smtpAuth,
  });

  const info = await transporter.sendMail({
    from: input.from,
    to: input.to.join(","),
    subject: input.subject,
    html: input.html,
    text: input.text,
    replyTo: input.replyTo,
  });

  return info.messageId;
}
