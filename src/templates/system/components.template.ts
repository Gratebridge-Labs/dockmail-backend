export function h1(value: string) {
  return `<h1 style="font-size:26px;font-weight:600;color:#ededed !important;line-height:1.3;letter-spacing:-0.3px;margin:0 0 12px 0;">${value}</h1>`;
}

export function p(value: string) {
  return `<p style="font-size:15px;color:#888888 !important;line-height:1.7;margin:0 0 24px 0;">${value}</p>`;
}

export function button(label: string, href: string, variant: "primary" | "danger" | "ghost" = "primary") {
  const style =
    variant === "danger"
      ? "display:inline-block;background-color:#ef4444 !important;color:#ffffff !important;font-size:14px;font-weight:600;padding:12px 28px;border-radius:6px;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;"
      : variant === "ghost"
        ? "display:inline-block;background-color:transparent !important;color:#ededed !important;font-size:14px;font-weight:600;padding:11px 28px;border-radius:6px;text-decoration:none;border:1px solid #2a2a2a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;"
        : "display:inline-block;background-color:#ffffff !important;color:#0a0a0a !important;font-size:14px;font-weight:600;padding:12px 28px;border-radius:6px;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;";
  const tdBg = variant === "danger" ? "#ef4444" : variant === "ghost" ? "#111111" : "#ffffff";
  const tdStyle =
    variant === "ghost"
      ? "border-radius:6px;background-color:#111111 !important;border:1px solid #2a2a2a;"
      : `border-radius:6px;background-color:${tdBg} !important;`;
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 24px 0;">
  <tr>
    <td bgcolor="${tdBg}" style="${tdStyle}">
      <a href="${href}" target="_blank" style="${style}">${label}</a>
    </td>
  </tr>
</table>`;
}

export function info(rows: Array<{ label: string; value: string }>) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" bgcolor="#0f0f0f" style="background-color:#0f0f0f !important;border:1px solid #1f1f1f;border-radius:8px;border-collapse:collapse;margin:20px 0;">
  <tr>
    <td bgcolor="#0f0f0f" style="padding:18px 20px;background-color:#0f0f0f !important;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
        ${rows
          .map(
            (r) =>
              `<tr style="font-size:13px;line-height:1.6;">
  <td style="padding:0 0 8px 0;color:#555555 !important;white-space:nowrap;">${r.label}</td>
  <td align="right" style="padding:0 0 8px 12px;color:#ededed !important;font-weight:500;word-break:break-word;">${r.value}</td>
</tr>`,
          )
          .join("")}
      </table>
    </td>
  </tr>
</table>`;
}

export function alert(text: string, variant: "success" | "warning" | "danger" = "warning") {
  const cfg =
    variant === "success"
      ? { bgcolor: "#0a1f0f", bg: "rgba(34,197,94,0.08)", border: "rgba(34,197,94,0.2)", color: "#22c55e" }
      : variant === "danger"
        ? { bgcolor: "#220a0a", bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.2)", color: "#ef4444" }
        : { bgcolor: "#201a0a", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.2)", color: "#f59e0b" };
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" bgcolor="${cfg.bgcolor}" style="background-color:${cfg.bg} !important;border:1px solid ${cfg.border};border-radius:8px;border-collapse:collapse;margin:0 0 24px 0;">
  <tr>
    <td bgcolor="${cfg.bgcolor}" style="padding:14px 18px;background-color:${cfg.bg} !important;color:${cfg.color} !important;font-size:13px;line-height:1.6;">
      ${text}
    </td>
  </tr>
</table>`;
}

export function divider() {
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin:24px 0;">
  <tr>
    <td bgcolor="#1a1a1a" style="height:1px;line-height:1px;font-size:1px;background-color:#1a1a1a !important;">&nbsp;</td>
  </tr>
</table>`;
}
