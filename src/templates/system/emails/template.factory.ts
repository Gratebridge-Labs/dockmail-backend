import { alert, button, divider, h1, info, p } from "../components.template";
import { get, TemplateBuilder } from "./template.types";

function small(text: string) {
  return `<p class="small-link" style="font-size:13px;color:#555555;line-height:1.6;margin:0 0 12px 0;">${text}</p>`;
}

function code(value: string) {
  return `<p class="code-block" style="font-family:'Courier New',monospace;font-size:13px;background:#1a1a1a;border:1px solid #1f1f1f;border-radius:4px;padding:8px;color:#4f8ef7;word-break:break-all;margin:0 0 12px 0;">${value}</p>`;
}

function list(items: string[]) {
  return `<ol style="margin: 0 0 20px 20px; color: #888888; font-size: 15px; line-height: 1.8;">${items
    .map((i) => `<li>${i}</li>`)
    .join("")}</ol>`;
}

function plain(value: string) {
  return value.replace(/[&<>]/g, (s) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[s] ?? s));
}

export const buildWelcomeTemplate: TemplateBuilder = (v) => ({
  subject: `Welcome to Dockmail, ${get(v, "firstName", "there")} 👋`,
  content:
    h1("Welcome to Dockmail") +
    p("Your account has been created successfully. You're one step away from professional email - verify your address to get started.") +
    alert("Check your inbox - we've sent a separate verification email.", "success") +
    info([
      { label: "Account", value: get(v, "email") },
      { label: "Workspace", value: get(v, "workspaceName") },
      { label: "Plan", value: "Free trial - 14 days" },
    ]) +
    button("Go to Dashboard", "https://dockmail.app/dashboard") +
    divider() +
    p("What's next") +
    list(["Verify your email address", "Connect your first domain", "Create your first mailbox"]) +
    small("If you didn't create this account, you can safely ignore this email."),
});
export const buildVerifyEmailTemplate: TemplateBuilder = (v) => ({
  subject: "Verify your email address",
  content:
    h1("Verify your email") +
    p("Click the button below to verify your email address. This link expires in 24 hours.") +
    button("Verify email address", get(v, "verifyUrl")) +
    divider() +
    small("Or copy and paste this link into your browser:") +
    code(get(v, "verifyUrl")) +
    small(`This link will expire on ${get(v, "expiryDate", "tomorrow")}. If you didn't request this, ignore this email.`),
});
export const buildOtpTemplate: TemplateBuilder = (v) => ({
  subject: `Your Dockmail verification code: ${get(v, "code")}`,
  content:
    h1("Your verification code") +
    p("Enter this code to complete your sign-in. It expires in 10 minutes.") +
    `<div class="info-box" style="background:#0f0f0f;border:1px solid #1f1f1f;border-radius:8px;padding:18px 20px;margin:20px 0;"><div class="otp-code" style="font-family:'Courier New',monospace;font-size:42px;font-weight:700;letter-spacing:10px;color:#ededed;text-align:center;padding:28px 0;white-space:nowrap;">${plain(get(v, "code")).replace(/\D/g, "").slice(0, 6).split("").join(" ")}</div></div>` +
    alert("Never share this code with anyone. Dockmail will never ask for it.", "warning") +
    divider() +
    info([
      { label: "Requested at", value: get(v, "timestamp", new Date().toISOString()) },
      { label: "From device", value: get(v, "deviceInfo", "Unknown device") },
      { label: "Location", value: get(v, "location", "Unknown") },
    ]) +
    small("If you didn't request this code, ignore this email and contact support."),
});
export const buildResetPasswordTemplate: TemplateBuilder = (v) => ({
  subject: "Reset your Dockmail password",
  content:
    h1("Reset your password") +
    p("We received a request to reset the password for your Dockmail account. Click below to set a new one. This link expires in 1 hour.") +
    button("Reset password", get(v, "resetUrl"), "danger") +
    divider() +
    info([
      { label: "Requested at", value: get(v, "timestamp", new Date().toISOString()) },
      { label: "IP Address", value: get(v, "ipAddress", "Unknown") },
      { label: "Location", value: get(v, "location", "Unknown") },
    ]) +
    alert("If you didn't request a password reset, someone may be trying to access your account. Your password has NOT been changed.", "warning") +
    small(`This link will expire at ${get(v, "expiryTime", "in 1 hour")}. After that, you'll need to request a new one.`),
});
export const buildInviteMemberTemplate: TemplateBuilder = (v) => ({
  subject: `${get(v, "inviterName")} invited you to join ${get(v, "workspaceName")} on Dockmail`,
  content:
    h1(`You're invited to ${get(v, "workspaceName")}`) +
    p(`${get(v, "inviterName")} has invited you to join their workspace on Dockmail as a ${get(v, "role", "MEMBER")}.`) +
    info([
      { label: "Workspace", value: get(v, "workspaceName") },
      { label: "Your role", value: get(v, "role", "MEMBER") },
      { label: "Mailboxes assigned", value: get(v, "mailboxCount", "None yet") },
      { label: "Invite expires", value: get(v, "expiryDate", "Soon") },
    ]) +
    button("Accept invitation", get(v, "inviteUrl")) +
    divider() +
    small(`By accepting, you agree to Dockmail's Terms of Service. This invite expires on ${get(v, "expiryDate", "soon")}.`) +
    small(`If you don't know ${get(v, "inviterName", "this sender")}, you can ignore this email.`),
});
export const buildInviteAcceptedTemplate: TemplateBuilder = (v) => ({
  subject: `${get(v, "memberName")} has joined ${get(v, "workspaceName")}`,
  content:
    alert("New team member joined", "success") +
    h1(`${get(v, "memberName")} joined your workspace`) +
    p(`${get(v, "memberName")} accepted your invitation and joined ${get(v, "workspaceName")} as a ${get(v, "role", "MEMBER")}.`) +
    info([
      { label: "Name", value: get(v, "memberName") },
      { label: "Email", value: get(v, "memberEmail") },
      { label: "Role", value: get(v, "role", "MEMBER") },
      { label: "Joined", value: get(v, "joinedAt", new Date().toISOString()) },
    ]) +
    button("Manage team", "https://dockmail.app/dashboard/team"),
});
export const buildMailboxCreatedTemplate: TemplateBuilder = (v) => ({
  subject: `Mailbox ${get(v, "email")} is ready`,
  content:
    alert("Your mailbox is ready", "success") +
    h1(`${get(v, "email")} is live`) +
    p("Your new professional mailbox has been created and is ready to use. You can start sending and receiving emails immediately.") +
    info([
      { label: "Mailbox", value: get(v, "email") },
      { label: "Display name", value: get(v, "displayName", "-") },
      { label: "Storage", value: get(v, "storageLimit", "512 MiB") },
      { label: "Workspace", value: get(v, "workspaceName") },
      { label: "Created", value: get(v, "createdAt", new Date().toISOString()) },
    ]) +
    button("Open inbox", "https://dockmail.app/dashboard/inbox") +
    divider() +
    p("Configure in your email client") +
    info([
      { label: "IMAP", value: "mail.dockmail.app : 993 (SSL)" },
      { label: "SMTP", value: "mail.dockmail.app : 587 (STARTTLS)" },
      { label: "Username", value: get(v, "email") },
    ]) +
    small("Your password was set by your administrator. Contact them if you need it."),
});
export const buildMailboxAssignedTemplate: TemplateBuilder = (v) => ({
  subject: `You've been assigned to ${get(v, "email")}`,
  content:
    h1("You've been given access to a mailbox") +
    p(`${get(v, "adminName")} has assigned the mailbox ${get(v, "email")} to you in ${get(v, "workspaceName")}.`) +
    info([
      { label: "Mailbox", value: get(v, "email") },
      { label: "Assigned by", value: get(v, "adminName") },
      { label: "Workspace", value: get(v, "workspaceName") },
      { label: "Assigned", value: get(v, "assignedAt", new Date().toISOString()) },
    ]) +
    button("Open mailbox", "https://dockmail.app/dashboard/inbox"),
});
export const buildMailboxRequestSubmittedTemplate: TemplateBuilder = (v) => ({
  subject: `New mailbox request from ${get(v, "requesterName")}`,
  content:
    alert("Pending approval", "warning") +
    h1("Mailbox request") +
    p(`${get(v, "requesterName")} has requested a new mailbox in ${get(v, "workspaceName")}.`) +
    info([
      { label: "Requested by", value: `${get(v, "requesterName")} (${get(v, "requesterEmail")})` },
      { label: "Requested address", value: get(v, "requestedEmail") },
      { label: "Reason", value: get(v, "reason", "No reason provided") },
      { label: "Submitted", value: get(v, "submittedAt", new Date().toISOString()) },
    ]) +
    button("Approve", get(v, "approveUrl", "https://dockmail.app/dashboard/mailboxes?tab=requests")) +
    `&nbsp;&nbsp;` +
    button("Review in dashboard", "https://dockmail.app/dashboard/mailboxes?tab=requests", "ghost"),
});
export const buildMailboxRequestApprovedTemplate: TemplateBuilder = () => ({
  subject: "Your mailbox request was approved ✓",
  content:
    alert("Request approved", "success") +
    h1("Your mailbox is ready") +
    p("Your request has been approved and the mailbox is now live and assigned to you.") +
    button("Open inbox", "https://dockmail.app/dashboard/inbox"),
});
export const buildMailboxRequestDeclinedTemplate: TemplateBuilder = () => ({
  subject: "Update on your mailbox request",
  content:
    h1("Mailbox request not approved") +
    p("Your mailbox request was not approved at this time.") +
    button("Submit a new request", "https://dockmail.app/dashboard/requests", "ghost"),
});
export const buildDomainVerifiedTemplate: TemplateBuilder = (v) => ({
  subject: `${get(v, "domain")} is verified and ready ✓`,
  content:
    alert("Domain verified", "success") +
    h1(`${get(v, "domain")} is ready`) +
    p(`All DNS records for ${get(v, "domain")} have been verified. You can now create professional email addresses on this domain.`) +
    info([
      { label: "MX Record", value: "Verified" },
      { label: "SPF Record", value: "Verified" },
      { label: "DKIM Record", value: "Verified" },
      { label: "DMARC Record", value: "Verified" },
      { label: "Verified at", value: get(v, "verifiedAt", new Date().toISOString()) },
    ]) +
    button("Create a mailbox", "https://dockmail.app/dashboard/mailboxes"),
});
export const buildDomainFailedTemplate: TemplateBuilder = (v) => ({
  subject: `DNS verification failed for ${get(v, "domain")}`,
  content:
    alert("Verification failed", "danger") +
    h1(`${get(v, "domain")} couldn't be verified`) +
    p(`We checked the DNS records for ${get(v, "domain")} but some required records are missing or incorrect.`) +
    info([
      { label: "MX", value: get(v, "mxStatus", "✗ Missing/Incorrect") },
      { label: "SPF", value: get(v, "spfStatus", "✗ Missing/Incorrect") },
      { label: "DKIM", value: get(v, "dkimStatus", "✗ Missing/Incorrect") },
      { label: "DMARC", value: get(v, "dmarcStatus", "✗ Missing/Incorrect") },
    ]) +
    small("DNS changes can take up to 24 hours to propagate. Please be patient and verify again shortly.") +
    small("Tip: if records were added recently, partial verification is normal while propagation completes.") +
    button("View DNS records", `https://dockmail.app/dashboard/domains/${get(v, "domainId", "")}`),
});
export const buildBillingTrialEndingTemplate: TemplateBuilder = (v) => ({
  subject: `Your Dockmail trial ends in ${get(v, "daysLeft")} days`,
  content:
    alert("Trial ending soon", "warning") +
    h1(`Your free trial ends ${get(v, "endDate", "soon")}`) +
    p("To keep access to your mailboxes and workspace, add a payment method before your trial ends.") +
    info([
      { label: "Trial ends", value: get(v, "endDate", "Soon") },
      { label: "Active mailboxes", value: get(v, "mailboxCount", "0") },
      { label: "Monthly cost after trial", value: `$${get(v, "monthlyTotal", "0")}/month` },
      { label: "Workspace", value: get(v, "workspaceName") },
    ]) +
    button("Add payment method", "https://dockmail.app/dashboard/billing"),
});
export const buildBillingPaymentSuccessTemplate: TemplateBuilder = (v) => ({
  subject: `Payment confirmed — $${get(v, "amount")}`,
  content:
    alert("Payment successful", "success") +
    h1(`Payment of $${get(v, "amount")} received`) +
    p("Your Dockmail subscription has been renewed. Thank you for using Dockmail.") +
    info([
      { label: "Amount", value: `$${get(v, "amount")}` },
      { label: "Mailboxes", value: get(v, "mailboxLine", `${get(v, "mailboxCount", "0")} x $1.00`) },
      { label: "Storage", value: get(v, "storageLabel", "-") },
      { label: "Period", value: `${get(v, "periodStart", "-")} -> ${get(v, "periodEnd", "-")}` },
      { label: "Card", value: `${get(v, "cardBrand", "Card")} ending ${get(v, "cardLast4", "----")}` },
    ]) +
    button("View invoice", `https://dockmail.app/dashboard/billing/invoices/${get(v, "invoiceId", "")}`),
});
export const buildBillingPaymentFailedTemplate: TemplateBuilder = () => ({
  subject: "⚠ Payment failed for your Dockmail account",
  content:
    alert("Payment failed", "danger") +
    h1("We couldn't process your payment") +
    p("Please update your payment method to keep your mailboxes active.") +
    button("Update payment method", "https://dockmail.app/dashboard/billing", "danger") +
    alert("If payment isn't resolved within 7 days, your workspace will be paused.", "warning"),
});
export const buildBillingStorageUpgradedTemplate: TemplateBuilder = (v) => ({
  subject: `Storage upgraded to ${get(v, "newTier")} ✓`,
  content:
    alert("Storage upgraded", "success") +
    h1("Your storage has been upgraded") +
    p(`Your Dockmail workspace storage has been upgraded to ${get(v, "newTier")}.`) +
    info([
      { label: "Previous", value: get(v, "oldTier", "-") },
      { label: "New", value: get(v, "newTier") },
      { label: "Additional cost", value: `+$${get(v, "additionalCost", "0")}/month` },
      { label: "Effective", value: "Immediately" },
    ]),
});
export const buildTeamMemberRemovedTemplate: TemplateBuilder = (v) => ({
  subject: `Your access to ${get(v, "workspaceName")} has been removed`,
  content:
    h1(`You've been removed from ${get(v, "workspaceName")}`) +
    p(`Your access was revoked by ${get(v, "removedByName", "an administrator")}.`) +
    code(get(v, "mailboxList", "No mailbox list provided")) +
    divider() +
    small("If you believe this was a mistake, please contact your workspace administrator directly.") +
    button("Go to Dockmail", "https://dockmail.app", "ghost"),
});
export const buildPasswordChangedTemplate: TemplateBuilder = () => ({
  subject: "Your Dockmail password was changed",
  content:
    alert("Password updated", "success") +
    h1("Your password was changed") +
    p("The password for your Dockmail account was successfully changed.") +
    button("This wasn't me - secure my account", "https://dockmail.app/auth/reset-password", "danger"),
});
export const buildNewDeviceLoginTemplate: TemplateBuilder = (v) => ({
  subject: "New sign-in to your Dockmail account",
  content:
    alert("New device sign-in", "warning") +
    h1("New sign-in detected") +
    p("Your Dockmail account was signed in from a new device or location.") +
    info([
      { label: "Time", value: get(v, "loginAt", "-") },
      { label: "Device", value: get(v, "deviceName", "-") },
      { label: "OS", value: get(v, "os", "-") },
      { label: "Location", value: get(v, "location", "-") },
      { label: "IP", value: get(v, "ipAddress", "-") },
    ]),
});
export const buildEmailOpenedReceiptTemplate: TemplateBuilder = (v) => ({
  subject: `${get(v, "recipientEmail")} opened your email`,
  content:
    h1("Your email was opened") +
    p(`${get(v, "recipientEmail")} opened the email you sent.`) +
    info([
      { label: "Email subject", value: get(v, "emailSubject", "-") },
      { label: "Opened", value: get(v, "openedAt", "-") },
      { label: "Device", value: get(v, "device", "-") },
      { label: "OS", value: get(v, "os", "-") },
      { label: "Location", value: get(v, "location", "-") },
      { label: "Times opened", value: get(v, "openCount", "1") },
    ]) +
    button("View email", get(v, "emailUrl", "https://dockmail.app/dashboard/inbox")),
});
export const buildWorkspaceDeletedTemplate: TemplateBuilder = (v) => ({
  subject: `${get(v, "workspaceName")} workspace has been deleted`,
  content:
    alert("Workspace deleted", "danger") +
    h1("Your workspace has been deleted") +
    p(`The workspace ${get(v, "workspaceName")} and all associated data have been permanently deleted.`) +
    info([
      { label: "Workspace", value: get(v, "workspaceName") },
      { label: "Mailboxes deleted", value: get(v, "mailboxCount", "0") },
      { label: "Team members removed", value: get(v, "memberCount", "0") },
      { label: "Deleted by", value: get(v, "deletedByName", "-") },
      { label: "Deleted at", value: get(v, "deletedAt", new Date().toISOString()) },
    ]) +
    button("Create a new workspace", "https://dockmail.app/dashboard", "ghost"),
});
export const buildApiKeyCreatedTemplate: TemplateBuilder = (v) => ({
  subject: `New API key created in ${get(v, "workspaceName")}`,
  content:
    h1("New API key created") +
    p("A new API key was created in your Dockmail workspace. It was shown only once at creation.") +
    info([
      { label: "Key name", value: get(v, "keyName", "-") },
      { label: "Prefix", value: get(v, "keyPrefix", "-") },
      { label: "Permissions", value: get(v, "permissions", "-") },
      { label: "Created by", value: get(v, "createdByName", "-") },
      { label: "Created at", value: get(v, "createdAt", new Date().toISOString()) },
    ]) +
    alert("If you didn't create this key, revoke it immediately.", "warning") +
    button("Revoke this key", get(v, "revokeUrl", "https://dockmail.app/dashboard/settings/api-keys"), "danger"),
});
export const buildMonthlySummaryTemplate: TemplateBuilder = (v) => ({
  subject: `${get(v, "workspaceName")} — Your ${get(v, "month", "Monthly")} 2026 summary`,
  content:
    h1(`${get(v, "month", "Monthly")} ${get(v, "year", "2026")} Summary`) +
    p("Here's a quick overview of your Dockmail workspace activity last month.") +
    info([
      { label: "Emails sent", value: get(v, "emailsSent", "0") },
      { label: "Emails received", value: get(v, "emailsReceived", "0") },
      { label: "Emails opened", value: get(v, "emailsOpened", "0") },
      { label: "Active mailboxes", value: get(v, "activeMailboxes", "0") },
    ]) +
    divider() +
    info([
      { label: "Mailboxes", value: `${get(v, "mailboxCount", "0")} x $1.00 = $${get(v, "mailboxCost", "0")}` },
      { label: "Storage", value: `${get(v, "storageTier", "GB_5")} = $${get(v, "storageCost", "0")}` },
      { label: "Total", value: `$${get(v, "total", "0")}` },
    ]) +
    button("View full dashboard", "https://dockmail.app/dashboard"),
});
