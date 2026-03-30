import { CreateEmailIdentityCommand, GetEmailIdentityCommand } from "@aws-sdk/client-sesv2";
import { prisma } from "../../config/database";
import { env } from "../../config/env";
import { sesClient } from "../../config/ses";
import { hasMxRecord, hasTxtContains } from "../../utils/dns";

function normalizeDomain(value: string) {
  return value.trim().toLowerCase();
}

export async function listDomains(workspaceId: string) {
  return prisma.domain.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" } });
}

export async function addDomain(workspaceId: string, domainRaw: string) {
  const domain = normalizeDomain(domainRaw);
  const existing = await prisma.domain.findUnique({ where: { domain } });
  if (existing && existing.workspaceId !== workspaceId) throw new Error("CONFLICT");

  const sesIdentity = await sesClient.send(
    new CreateEmailIdentityCommand({
      EmailIdentity: domain,
      DkimSigningAttributes: { NextSigningKeyLength: "RSA_2048_BIT" },
    }),
  );

  const record = await prisma.domain.upsert({
    where: { domain },
    create: {
      domain,
      workspaceId,
      sesIdentityArn: sesIdentity.IdentityType,
      sesMailFromDomain: `bounce.${domain}`,
    },
    update: {
      workspaceId,
      sesMailFromDomain: `bounce.${domain}`,
    },
  });

  const identity = await sesClient.send(new GetEmailIdentityCommand({ EmailIdentity: domain }));
  const dkimTokens = identity.DkimAttributes?.Tokens ?? [];
  const dnsRecords = [
    { type: "MX", name: "@", value: env.INBOUND_MX_HOST, priority: 10 },
    { type: "TXT", name: "@", value: "v=spf1 include:amazonses.com mx -all" },
    { type: "TXT", name: "_dmarc", value: `v=DMARC1; p=none; rua=mailto:dmarc@${domain}; fo=1` },
    ...dkimTokens.map((token) => ({
      type: "CNAME",
      name: `${token}._domainkey`,
      value: `${token}.dkim.amazonses.com`,
    })),
    { type: "MX", name: "bounce", value: `10 feedback-smtp.${env.AWS_REGION}.amazonses.com` },
    { type: "TXT", name: "bounce", value: "v=spf1 include:amazonses.com ~all" },
  ];

  return { domain: record, dnsRecords };
}

export async function getDomain(workspaceId: string, domainId: string) {
  return prisma.domain.findFirst({ where: { id: domainId, workspaceId } });
}

export async function verifyDomain(workspaceId: string, domainId: string) {
  const domain = await getDomain(workspaceId, domainId);
  if (!domain) throw new Error("NOT_FOUND");

  const [mxVerified, spfVerified, dmarcVerified] = await Promise.all([
    hasMxRecord(domain.domain, env.INBOUND_MX_HOST).catch(() => false),
    hasTxtContains(domain.domain, "amazonses.com").catch(() => false),
    hasTxtContains(`_dmarc.${domain.domain}`, "v=DMARC1").catch(() => false),
  ]);

  const sesIdentity = await sesClient.send(new GetEmailIdentityCommand({ EmailIdentity: domain.domain }));
  const dkimVerified = sesIdentity.VerifiedForSendingStatus ?? false;

  const verified = mxVerified && spfVerified && dkimVerified && dmarcVerified;
  const updated = await prisma.domain.update({
    where: { id: domain.id },
    data: {
      mxVerified,
      spfVerified,
      dkimVerified,
      dmarcVerified,
      status: verified ? "VERIFIED" : "FAILED",
      verifiedAt: verified ? new Date() : null,
      lastCheckedAt: new Date(),
    },
  });

  return {
    domain: updated,
    checks: { mxVerified, spfVerified, dkimVerified, dmarcVerified },
  };
}
