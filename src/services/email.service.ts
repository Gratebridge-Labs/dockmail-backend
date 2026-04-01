import { sendAppEmail } from "../config/ses";
import { env } from "../config/env";
import { logger } from "../config/logger";
import { renderSystemTemplate, SystemEmailTemplate, TemplateVariables } from "../templates";

type SenderRole = "noreply" | "support" | "billing" | "security";

const senderByTemplate: Record<SystemEmailTemplate, SenderRole> = {
  "welcome": "noreply",
  "verify-email": "noreply",
  "otp": "noreply",
  "reset-password": "security",
  "invite-member": "support",
  "invite-accepted": "support",
  "mailbox-created": "support",
  "mailbox-assigned": "support",
  "mailbox-request-submitted": "support",
  "mailbox-request-approved": "support",
  "mailbox-request-declined": "support",
  "domain-verified": "support",
  "domain-failed": "support",
  "billing-trial-ending": "billing",
  "billing-payment-success": "billing",
  "billing-payment-failed": "billing",
  "billing-storage-upgraded": "billing",
  "team-member-removed": "support",
  "password-changed": "security",
  "new-device-login": "security",
  "email-opened-receipt": "noreply",
  "workspace-deleted": "support",
  "api-key-created": "security",
  "monthly-summary": "noreply",
};

function resolveSender(role: SenderRole): string {
  const map: Record<SenderRole, string> = {
    noreply: env.MAIL_FROM_NOREPLY,
    support: env.MAIL_FROM_SUPPORT,
    billing: env.MAIL_FROM_BILLING,
    security: env.MAIL_FROM_SECURITY,
  };
  return map[role];
}

/**
 * Renders and sends a system email using the specified template.
 * Uses sender-specific mailbox auth, with shared password support.
 */
export async function sendSystemEmail(
  to: string,
  templateName: SystemEmailTemplate,
  variables: TemplateVariables,
): Promise<void> {
  const template = renderSystemTemplate(templateName, variables);
  const senderRole = senderByTemplate[templateName];
  const fromAddress = resolveSender(senderRole);
  const from = `Dockmail <${fromAddress}>`;
  const authPass = env.SYSTEM_MAILBOX_SHARED_PASS || env.SMTP_PASS;

  try {
    await sendAppEmail({
      from,
      to: [to],
      subject: template.subject,
      html: template.html,
      text: template.text,
      smtpAuth: authPass
        ? {
            user: fromAddress,
            pass: authPass,
          }
        : undefined,
    });
  } catch (error) {
    logger.error(
      `sendSystemEmail failed template=${templateName} to=${to} sender=${fromAddress}: ${
        error instanceof Error ? error.message : String(error)
      }`,
      error instanceof Error ? error : undefined,
    );
    throw error;
  }
}

export type { SystemEmailTemplate };
