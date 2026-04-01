import { buildApiKeyCreatedTemplate } from "./api-key-created.template";
import { buildBillingPaymentFailedTemplate } from "./billing-payment-failed.template";
import { buildBillingPaymentSuccessTemplate } from "./billing-payment-success.template";
import { buildBillingStorageUpgradedTemplate } from "./billing-storage-upgraded.template";
import { buildBillingTrialEndingTemplate } from "./billing-trial-ending.template";
import { buildDomainFailedTemplate } from "./domain-failed.template";
import { buildDomainVerifiedTemplate } from "./domain-verified.template";
import { buildEmailOpenedReceiptTemplate } from "./email-opened-receipt.template";
import { buildInviteAcceptedTemplate } from "./invite-accepted.template";
import { buildInviteMemberTemplate } from "./invite-member.template";
import { buildMailboxAssignedTemplate } from "./mailbox-assigned.template";
import { buildMailboxCreatedTemplate } from "./mailbox-created.template";
import { buildMailboxRequestApprovedTemplate } from "./mailbox-request-approved.template";
import { buildMailboxRequestDeclinedTemplate } from "./mailbox-request-declined.template";
import { buildMailboxRequestSubmittedTemplate } from "./mailbox-request-submitted.template";
import { buildMonthlySummaryTemplate } from "./monthly-summary.template";
import { buildNewDeviceLoginTemplate } from "./new-device-login.template";
import { buildOtpTemplate } from "./otp.template";
import { buildPasswordChangedTemplate } from "./password-changed.template";
import { buildResetPasswordTemplate } from "./reset-password.template";
import { buildTeamMemberRemovedTemplate } from "./team-member-removed.template";
import { TemplateBuilder, TemplateVariables, SystemEmailTemplate } from "./template.types";
import { buildVerifyEmailTemplate } from "./verify-email.template";
import { buildWelcomeTemplate } from "./welcome.template";
import { buildWorkspaceDeletedTemplate } from "./workspace-deleted.template";

const templateRegistry: Record<SystemEmailTemplate, TemplateBuilder> = {
  "welcome": buildWelcomeTemplate,
  "verify-email": buildVerifyEmailTemplate,
  "otp": buildOtpTemplate,
  "reset-password": buildResetPasswordTemplate,
  "invite-member": buildInviteMemberTemplate,
  "invite-accepted": buildInviteAcceptedTemplate,
  "mailbox-created": buildMailboxCreatedTemplate,
  "mailbox-assigned": buildMailboxAssignedTemplate,
  "mailbox-request-submitted": buildMailboxRequestSubmittedTemplate,
  "mailbox-request-approved": buildMailboxRequestApprovedTemplate,
  "mailbox-request-declined": buildMailboxRequestDeclinedTemplate,
  "domain-verified": buildDomainVerifiedTemplate,
  "domain-failed": buildDomainFailedTemplate,
  "billing-trial-ending": buildBillingTrialEndingTemplate,
  "billing-payment-success": buildBillingPaymentSuccessTemplate,
  "billing-payment-failed": buildBillingPaymentFailedTemplate,
  "billing-storage-upgraded": buildBillingStorageUpgradedTemplate,
  "team-member-removed": buildTeamMemberRemovedTemplate,
  "password-changed": buildPasswordChangedTemplate,
  "new-device-login": buildNewDeviceLoginTemplate,
  "email-opened-receipt": buildEmailOpenedReceiptTemplate,
  "workspace-deleted": buildWorkspaceDeletedTemplate,
  "api-key-created": buildApiKeyCreatedTemplate,
  "monthly-summary": buildMonthlySummaryTemplate,
};

export function buildSystemTemplate(name: SystemEmailTemplate, variables: TemplateVariables) {
  return templateRegistry[name](variables);
}

export type { SystemEmailTemplate, TemplateVariables };
