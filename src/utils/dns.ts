import dns from "node:dns/promises";

export async function hasMxRecord(domain: string, expectedHost: string): Promise<boolean> {
  const records = await dns.resolveMx(domain);
  return records.some((mx) => mx.exchange.replace(/\.$/, "") === expectedHost.replace(/\.$/, ""));
}

export async function hasTxtContains(domain: string, expectedSubstring: string): Promise<boolean> {
  const records = await dns.resolveTxt(domain);
  return records.some((chunks) => chunks.join("").includes(expectedSubstring));
}
