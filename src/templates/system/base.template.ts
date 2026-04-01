import { systemEmailStyles } from "./styles.template";

export function baseTemplate(input: { subject: string; content: string; unsubscribeText?: string }) {
  const unsubscribeText = input.unsubscribeText ?? "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="color-scheme" content="dark" />
  <meta name="supported-color-schemes" content="dark" />
  <title>${escapeHtml(input.subject)}</title>
  <style>${systemEmailStyles}</style>
</head>
<body bgcolor="#0a0a0a" style="margin:0;padding:0;background:#0a0a0a;">
  <div class="wrapper" style="width:100%;background:#0a0a0a;padding:48px 16px;">
    <div class="container" style="max-width:600px;margin:0 auto;background:#111111;border:1px solid #1f1f1f;border-radius:12px;overflow:hidden;">
      <div class="header" style="padding:32px 40px 24px;border-bottom:1px solid #1a1a1a;"><div class="logo" style="font-size:20px;font-weight:600;color:#ededed;letter-spacing:-0.3px;"><span style="color:#4f8ef7;margin-right:6px;">o</span>Dockmail</div></div>
      <div class="body" style="padding:40px;">${input.content}</div>
      <div class="footer" style="padding:28px 40px;border-top:1px solid #1a1a1a;">
        <div class="footer-logo">Dockmail · by Gratebridge Labs</div>
        <div class="footer-text">
          You're receiving this email because of your account at
          <a href="https://dockmail.app">dockmail.app</a>. ${escapeHtml(unsubscribeText)}
        </div>
        <div class="footer-links">
          <a href="https://dockmail.app/legal/privacy">Privacy</a>
          <a href="https://dockmail.app/legal/terms">Terms</a>
          <a href="https://dockmail.app/support">Support</a>
        </div>
        <div class="footer-text" style="margin-top: 12px;">© 2026 Gratebridge Labs. All rights reserved.</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export function stripHtmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<\/(p|div|h1|h2|h3|li|tr|br)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
