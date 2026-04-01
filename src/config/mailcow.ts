import http from "node:http";
import https from "node:https";
import { URL } from "node:url";
import { env } from "./env";

function mailcowHeaders() {
  return {
    "Content-Type": "application/json",
    "X-API-Key": env.MAILCOW_API_KEY ?? "",
  };
}

function postJson(urlString: string, headers: Record<string, string>, body: string): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const u = new URL(urlString);
    const isHttps = u.protocol === "https:";
    const lib = isHttps ? https : http;
    const options: http.RequestOptions = {
      hostname: u.hostname,
      port: u.port || (isHttps ? 443 : 80),
      path: `${u.pathname}${u.search}`,
      method: "POST",
      headers: { ...headers, "Content-Length": Buffer.byteLength(body, "utf8") },
    };
    if (isHttps && env.MAILCOW_TLS_INSECURE === "true") {
      (options as https.RequestOptions).rejectUnauthorized = false;
    }
    const req = lib.request(options, (res) => {
      let data = "";
      res.on("data", (c) => {
        data += c;
      });
      res.on("end", () => resolve({ statusCode: res.statusCode ?? 0, body: data }));
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

/**
 * Mailcow json_api decodes the POST body into `$attr` and expects a JSON object with keys
 * like `domain`, `local_part` — not a one-element array `[{ ... }]`, which would set `$attr[0]`
 * and leave `$attr.domain` unset (domain_invalid / mailbox_invalid).
 */
async function mailcowRequest(path: string, payload: unknown): Promise<string> {
  if (!env.MAILCOW_API_URL || !env.MAILCOW_API_KEY) {
    throw new Error("Mailcow is not configured (MAILCOW_API_URL / MAILCOW_API_KEY)");
  }
  const url = `${env.MAILCOW_API_URL.replace(/\/$/, "")}${path}`;
  const body = JSON.stringify(payload);

  let statusCode: number;
  let resBody: string;
  try {
    const result = await postJson(url, mailcowHeaders(), body);
    statusCode = result.statusCode;
    resBody = result.body;
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === "ECONNREFUSED") {
      throw new Error(
        `Cannot connect to Mailcow at ${env.MAILCOW_API_URL}. ` +
          `Local dev: set MAILCOW_API_URL=https://127.0.0.1:8443 and MAILCOW_TLS_INSECURE=true, then run ` +
          `ssh -N -L 8443:127.0.0.1:443 you@vps-ip (keep it open). ` +
          `Note: https://127.0.0.1 without a port uses port 443 on this machine only — use that when the API runs on the same server as Mailcow.`,
      );
    }
    throw e;
  }

  if (statusCode < 200 || statusCode >= 300) {
    throw new Error(`Mailcow HTTP ${statusCode}: ${resBody.slice(0, 800)}`);
  }

  return resBody;
}

async function mailcowGet(path: string): Promise<string> {
  if (!env.MAILCOW_API_URL || !env.MAILCOW_API_KEY) {
    throw new Error("Mailcow is not configured (MAILCOW_API_URL / MAILCOW_API_KEY)");
  }
  const url = `${env.MAILCOW_API_URL.replace(/\/$/, "")}${path}`;
  let statusCode: number;
  let resBody: string;
  try {
    const result = await new Promise<{ statusCode: number; body: string }>((resolve, reject) => {
      const u = new URL(url);
      const isHttps = u.protocol === "https:";
      const lib = isHttps ? https : http;
      const options: http.RequestOptions = {
        hostname: u.hostname,
        port: u.port || (isHttps ? 443 : 80),
        path: `${u.pathname}${u.search}`,
        method: "GET",
        headers: { "X-API-Key": env.MAILCOW_API_KEY ?? "" },
      };
      if (isHttps && env.MAILCOW_TLS_INSECURE === "true") {
        (options as https.RequestOptions).rejectUnauthorized = false;
      }
      const req = lib.request(options, (res) => {
        let data = "";
        res.on("data", (c) => {
          data += c;
        });
        res.on("end", () => resolve({ statusCode: res.statusCode ?? 0, body: data }));
      });
      req.on("error", reject);
      req.end();
    });
    statusCode = result.statusCode;
    resBody = result.body;
  } catch (e) {
    throw e;
  }
  if (statusCode < 200 || statusCode >= 300) {
    throw new Error(`Mailcow HTTP ${statusCode}: ${resBody.slice(0, 800)}`);
  }
  return resBody;
}

/** Mailcow returns HTTP 200 with JSON body; failures use type "danger" / "error". */
function assertMailcowSuccess(
  body: string,
  opts?: { ignoreDomainExists?: boolean; ignoreMailboxExists?: boolean; ignoreMissing?: boolean },
) {
  let data: unknown;
  try {
    data = JSON.parse(body);
  } catch {
    return;
  }
  const items = Array.isArray(data) ? data : [data];
  for (const item of items) {
    if (item && typeof item === "object" && "type" in item) {
      const t = (item as { type?: string; msg?: unknown }).type;
      if (t === "success") {
        return;
      }
      if (t === "danger" || t === "error") {
        const msg = (item as { msg?: unknown }).msg;
        const text =
          typeof msg === "string"
            ? msg
            : Array.isArray(msg)
              ? msg.join(" ")
              : JSON.stringify(msg ?? item);
        if (opts?.ignoreDomainExists && /domain_exists|object_exists|already exists|duplicate/i.test(text)) {
          return;
        }
        if (opts?.ignoreMailboxExists && /mailbox_exists|mailbox_duplicate|object_exists|already exists|duplicate/i.test(text)) {
          return;
        }
        if (opts?.ignoreMissing && /not found|does not exist|unknown/i.test(text)) {
          return;
        }
        throw new Error(text || "Mailcow rejected the request");
      }
    }
  }
}

/** Create domain in Mailcow if missing. Idempotent when domain already exists. */
export async function ensureMailcowDomain(domainName: string): Promise<void> {
  if (!env.MAILCOW_API_URL || !env.MAILCOW_API_KEY) {
    return;
  }

  const resBody = await mailcowRequest("/api/v1/add/domain", {
    domain: domainName,
    description: "Dockmail",
    aliases: "400",
    mailboxes: "500",
    maxquota: "10240",
    quota: "102400",
    defquota: "5120",
    active: "1",
    backupmx: "0",
    relay_all_recipients: "0",
    relay_unknown_only: "0",
    restart_sogo: "1",
  });

  assertMailcowSuccess(resBody, { ignoreDomainExists: true });
}

export async function addMailcowMailbox(input: {
  localPart: string;
  domain: string;
  password: string;
  name?: string;
  quotaMb: number;
}) {
  if (!env.MAILCOW_API_URL || !env.MAILCOW_API_KEY) return;

  const resBody = await mailcowRequest("/api/v1/add/mailbox", {
    local_part: input.localPart,
    domain: input.domain,
    password: input.password,
    password2: input.password,
    name: input.name ?? `${input.localPart}@${input.domain}`,
    quota: input.quotaMb,
    active: "1",
  });

  assertMailcowSuccess(resBody, { ignoreMailboxExists: true });
}

export async function deleteMailcowMailbox(emailAddress: string) {
  if (!env.MAILCOW_API_URL || !env.MAILCOW_API_KEY) return;
  const resBody = await mailcowRequest("/api/v1/delete/mailbox", [emailAddress]);
  assertMailcowSuccess(resBody, { ignoreMissing: true });
}

export async function deleteMailcowDomain(domainName: string) {
  if (!env.MAILCOW_API_URL || !env.MAILCOW_API_KEY) return;
  const resBody = await mailcowRequest("/api/v1/delete/domain", [domainName]);
  assertMailcowSuccess(resBody, { ignoreMissing: true });
}

function normalizeDkimTxt(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim().replace(/^"|"$/g, "");
  if (!trimmed) return undefined;
  if (/^v=DKIM1/i.test(trimmed)) return trimmed;
  // If only key material was provided, prepend the full TXT format.
  if (/^[A-Za-z0-9+\/=]+$/.test(trimmed)) return `v=DKIM1; p=${trimmed}`;
  return undefined;
}

function pickDkimCandidate(obj: unknown): string | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  const record = obj as Record<string, unknown>;
  const direct = [
    record.dkim_txt,
    record.dkimTxt,
    record.public_key,
    record.publicKey,
    record.pubkey,
    record.txt,
    record.value,
  ];
  for (const v of direct) {
    if (typeof v === "string") {
      const normalized = normalizeDkimTxt(v);
      if (normalized) return normalized;
    }
  }
  const nested = [record.data, record.result, record.attrs, record.attr, record.dkim];
  for (const v of nested) {
    const normalized = pickDkimCandidate(v);
    if (normalized) return normalized;
  }
  return undefined;
}

/**
 * Resolve per-domain DKIM TXT value from Mailcow.
 * Tries multiple API variants to stay compatible across Mailcow versions.
 */
export async function getMailcowDkimTxt(domainName: string): Promise<string | undefined> {
  if (!env.MAILCOW_API_URL || !env.MAILCOW_API_KEY) return undefined;

  const attempts: Array<() => Promise<string>> = [
    () => mailcowRequest(`/api/v1/get/dkim/${encodeURIComponent(domainName)}`, {}),
    () => mailcowRequest(`/api/v1/get/dkim/${encodeURIComponent(domainName)}`, domainName),
    () => mailcowGet(`/api/v1/get/dkim/${encodeURIComponent(domainName)}`),
  ];

  for (const attempt of attempts) {
    try {
      const body = await attempt();
      const parsed = JSON.parse(body) as unknown;
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          const candidate = pickDkimCandidate(item);
          if (candidate) return candidate;
        }
      } else {
        const candidate = pickDkimCandidate(parsed);
        if (candidate) return candidate;
      }
    } catch {
      // Try next known API variant.
    }
  }
  return undefined;
}
