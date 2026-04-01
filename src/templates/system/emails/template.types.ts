export type SystemEmailTemplate =
  | "welcome"
  | "verify-email"
  | "otp"
  | "reset-password"
  | "invite-member"
  | "invite-accepted"
  | "mailbox-created"
  | "mailbox-assigned"
  | "mailbox-request-submitted"
  | "mailbox-request-approved"
  | "mailbox-request-declined"
  | "domain-verified"
  | "domain-failed"
  | "billing-trial-ending"
  | "billing-payment-success"
  | "billing-payment-failed"
  | "billing-storage-upgraded"
  | "team-member-removed"
  | "password-changed"
  | "new-device-login"
  | "email-opened-receipt"
  | "workspace-deleted"
  | "api-key-created"
  | "monthly-summary";

export type TemplateVariables = Record<string, string | number | undefined>;
export type TemplateOutput = { subject: string; content: string; unsubscribeText?: string };
export type TemplateBuilder = (v: TemplateVariables) => TemplateOutput;

export function get(v: TemplateVariables, key: string, fallback = ""): string {
  return String(v[key] ?? fallback);
}
