export function h1(value: string) {
  return `<h1 class="headline">${value}</h1>`;
}

export function p(value: string) {
  return `<p class="subtext">${value}</p>`;
}

export function button(label: string, href: string, variant: "primary" | "danger" | "ghost" = "primary") {
  return `<a class="btn-${variant}" href="${href}">${label}</a>`;
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
  return `<div class="alert-banner alert-${variant}">${text}</div>`;
}

export function divider() {
  return `<div class="divider"></div>`;
}
