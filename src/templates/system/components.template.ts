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
  return `<div class="info-box">${rows
    .map((r) => `<div class="info-row"><span class="info-label">${r.label}</span><span class="info-value">${r.value}</span></div>`)
    .join("")}</div>`;
}

export function alert(text: string, variant: "success" | "warning" | "danger" = "warning") {
  return `<div class="alert-banner alert-${variant}">${text}</div>`;
}

export function divider() {
  return `<div class="divider"></div>`;
}
