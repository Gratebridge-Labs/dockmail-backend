import dns from "node:dns/promises";

export async function hasMxRecord(domain: string, expectedHost: string): Promise<boolean> {
  const records = await dns.resolveMx(domain);
  const expected = expectedHost.replace(/\.$/, "").toLowerCase();
  return records.some((mx) => mx.exchange.replace(/\.$/, "").toLowerCase() === expected);
}

export async function hasTxtContains(domain: string, expectedSubstring: string): Promise<boolean> {
  const records = await dns.resolveTxt(domain);
  const expectedCompact = expectedSubstring.replace(/\s+/g, "");
  return records.some((chunks) => {
    const raw = chunks.join("");
    const compact = raw.replace(/\s+/g, "");
    return raw.includes(expectedSubstring) || compact.includes(expectedCompact);
  });
}
