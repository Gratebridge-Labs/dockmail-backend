export function h1(value: string) {
  return `<h1 class="headline" style="font-size:26px;font-weight:600;color:#ededed;line-height:1.3;letter-spacing:-0.3px;margin:0 0 12px 0;">${value}</h1>`;
}

export function p(value: string) {
  return `<p class="subtext" style="font-size:15px;color:#888888;line-height:1.7;margin:0 0 24px 0;">${value}</p>`;
}

export function button(label: string, href: string, variant: "primary" | "danger" | "ghost" = "primary") {
  const style =
    variant === "danger"
      ? "display:inline-block;background:#ef4444;color:#ffffff;text-decoration:none;border-radius:6px;padding:12px 28px;font-size:14px;font-weight:600;"
      : variant === "ghost"
        ? "display:inline-block;background:transparent;color:#ededed;text-decoration:none;border-radius:6px;padding:11px 28px;font-size:14px;font-weight:600;border:1px solid #2a2a2a;"
        : "display:inline-block;background:#ffffff;color:#0a0a0a;text-decoration:none;border-radius:6px;padding:12px 28px;font-size:14px;font-weight:600;";
  return `<a class="btn-${variant}" href="${href}" style="${style}">${label}</a>`;
}

export function info(rows: Array<{ label: string; value: string }>) {
  return `<div class="info-box"><table class="info-table" role="presentation" cellpadding="0" cellspacing="0" width="100%">${rows
    .map(
      (r) =>
        `<tr class="info-row"><td class="info-label" style="padding: 0 0 8px 0;">${r.label}</td><td class="info-value" align="right" style="padding: 0 0 8px 12px;">${r.value}</td></tr>`,
    )
    .join("")}</table></div>`;
}

export function alert(text: string, variant: "success" | "warning" | "danger" = "warning") {
  const style =
    variant === "success"
      ? "border-radius:8px;padding:14px 18px;font-size:13px;margin:0 0 24px 0;line-height:1.6;background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.2);color:#22c55e;"
      : variant === "danger"
        ? "border-radius:8px;padding:14px 18px;font-size:13px;margin:0 0 24px 0;line-height:1.6;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);color:#ef4444;"
        : "border-radius:8px;padding:14px 18px;font-size:13px;margin:0 0 24px 0;line-height:1.6;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.2);color:#f59e0b;";
  return `<div class="alert-banner alert-${variant}" style="${style}">${text}</div>`;
}

export function divider() {
  return `<div class="divider" style="height:1px;background:#1a1a1a;margin:24px 0;"></div>`;
}
