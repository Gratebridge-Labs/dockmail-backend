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
<body bgcolor="#0a0a0a">
  <div class="wrapper">
    <div class="container">
      <div class="header"><div class="logo"><span>⬡</span>Dockmail</div></div>
      <div class="body">${input.content}</div>
      <div class="footer">
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
