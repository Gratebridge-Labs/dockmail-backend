import { env } from "./env";

function mailcowHeaders() {
  return {
    "Content-Type": "application/json",
    "X-API-Key": env.MAILCOW_API_KEY ?? "",
  };
}

export async function addMailcowMailbox(input: {
  localPart: string;
  domain: string;
  password: string;
  name?: string;
  quotaMb: number;
}) {
  if (!env.MAILCOW_API_URL || !env.MAILCOW_API_KEY) return;
  await fetch(`${env.MAILCOW_API_URL}/api/v1/add/mailbox`, {
    method: "POST",
    headers: mailcowHeaders(),
    body: JSON.stringify([
      {
        local_part: input.localPart,
        domain: input.domain,
        password: input.password,
        password2: input.password,
        name: input.name ?? `${input.localPart}@${input.domain}`,
        quota: input.quotaMb,
        active: "1",
      },
    ]),
  });
}
