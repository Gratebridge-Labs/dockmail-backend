import fs from "node:fs/promises";
import path from "node:path";
import { renderSystemTemplate, SystemEmailTemplate } from "./index";

const outDir = path.resolve(process.cwd(), "tmp/email-previews");

const templates: SystemEmailTemplate[] = [
  "welcome",
  "verify-email",
  "otp",
  "reset-password",
  "invite-member",
  "invite-accepted",
  "mailbox-created",
  "mailbox-assigned",
  "mailbox-request-submitted",
  "mailbox-request-approved",
  "mailbox-request-declined",
  "domain-verified",
  "domain-failed",
  "billing-trial-ending",
  "billing-payment-success",
  "billing-payment-failed",
  "billing-storage-upgraded",
  "team-member-removed",
  "password-changed",
  "new-device-login",
  "email-opened-receipt",
  "workspace-deleted",
  "api-key-created",
  "monthly-summary",
];

async function run() {
  await fs.mkdir(outDir, { recursive: true });
  for (const name of templates) {
    const rendered = renderSystemTemplate(name, {
      firstName: "Olamide",
      email: "user@dockmail.app",
      workspaceName: "Dockmail HQ",
      verifyUrl: "https://dockmail.app/verify/token",
      code: "123456",
      resetUrl: "https://dockmail.app/auth/reset/token",
      inviterName: "Admin User",
      role: "MEMBER",
      domain: "dockmail.app",
      month: "March",
      amount: "9.00",
    });
    await fs.writeFile(path.join(outDir, `${name}.html`), rendered.html, "utf8");
    await fs.writeFile(path.join(outDir, `${name}.txt`), rendered.text, "utf8");
  }
  console.log(`Generated ${templates.length} previews in ${outDir}`);
}

void run();
