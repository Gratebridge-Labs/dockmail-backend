import { prisma } from "../../config/database";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { deleteMailcowDomain, deleteMailcowMailbox, ensureMailcowDomain, getMailcowDkimTxt } from "../../config/mailcow";
import { hasMxRecord, hasTxtContains } from "../../utils/dns";
import fs from "node:fs";
import { Role } from "@prisma/client";
import { sendSystemEmail } from "../../services/email.service";

function normalizeDomain(value: string) {
  return value.trim().toLowerCase();
}

function dkimTxtValue() {
  if (env.DKIM_PUBLIC_KEY && env.DKIM_PUBLIC_KEY.trim()) {
    const key = env.DKIM_PUBLIC_KEY.trim();
    return key.startsWith("v=DKIM1") ? key : `v=DKIM1; p=${key}`;
  }
  return "v=DKIM1; p=<mailcow-public-key>";
}

function buildDnsRecords(domain: string, dkimTxt: string) {
  return [
    { type: "MX", name: "@", value: env.INBOUND_MX_HOST, priority: 10 },
    { type: "TXT", name: "@", value: "v=spf1 mx -all" },
    { type: "TXT", name: "_dmarc", value: `v=DMARC1; p=none; rua=mailto:dmarc@${domain}; fo=1` },
    { type: "TXT", name: `${env.DKIM_SELECTOR}._domainkey`, value: dkimTxt },
  ];
}

async function resolveDkimTxtForDomain(domain: string): Promise<string> {
  let dkimTxt = dkimTxtValue();
  if (env.MAILCOW_API_URL && env.MAILCOW_API_KEY) {
    try {
      const dynamicDkim = await getMailcowDkimTxt(domain);
      if (dynamicDkim) dkimTxt = dynamicDkim;
    } catch (e) {
      logger.warn(`resolveDkimTxtForDomain failed for ${domain} — ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return dkimTxt;
}

export async function listDomains(workspaceId: string) {
  const domains = await prisma.domain.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" } });
  const enriched = await Promise.all(
    domains.map(async (domain) => {
      const dkimTxt = await resolveDkimTxtForDomain(domain.domain);
      return {
        ...domain,
        dnsRecords: buildDnsRecords(domain.domain, dkimTxt),
      };
    }),
  );
  return enriched;
}

export async function addDomain(workspaceId: string, domainRaw: string) {
  const domain = normalizeDomain(domainRaw);
  const existing = await prisma.domain.findUnique({ where: { domain } });
  if (existing && existing.workspaceId !== workspaceId) throw new Error("CONFLICT");

  const record = await prisma.domain.upsert({
    where: { domain },
    create: {
      domain,
      workspaceId,
    },
    update: {
      workspaceId,
    },
  });

  let dkimTxt = dkimTxtValue();
  if (env.MAILCOW_API_URL && env.MAILCOW_API_KEY) {
    try {
      await ensureMailcowDomain(domain);
      const dynamicDkim = await getMailcowDkimTxt(domain);
      if (dynamicDkim) dkimTxt = dynamicDkim;
    } catch (e) {
      logger.warn(`addDomain: dynamic DKIM fetch failed for ${domain} — ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const dnsRecords = buildDnsRecords(domain, dkimTxt);

  return {
    domain: record,
    dnsRecords,
  };
}

export async function getDomain(workspaceId: string, domainId: string) {
  return prisma.domain.findFirst({ where: { id: domainId, workspaceId } });
}

export async function verifyDomain(workspaceId: string, domainId: string) {
  const domain = await getDomain(workspaceId, domainId);
  if (!domain) throw new Error("NOT_FOUND");

  let mailcowVerified = true;
  if (env.MAILCOW_API_URL && env.MAILCOW_API_KEY) {
    try {
      await ensureMailcowDomain(domain.domain);
      mailcowVerified = true;
    } catch (e) {
      logger.error(`ensureMailcowDomain failed for ${domain.domain}: ${e instanceof Error ? e.message : String(e)}`);
      mailcowVerified = false;
    }
  }

  const dkimTxt = await resolveDkimTxtForDomain(domain.domain);

  const [mxVerified, spfVerified, dmarcVerified] = await Promise.all([
    hasMxRecord(domain.domain, env.INBOUND_MX_HOST).catch(() => false),
    hasTxtContains(domain.domain, "v=spf1").catch(() => false),
    hasTxtContains(`_dmarc.${domain.domain}`, "v=DMARC1").catch(() => false),
  ]);
  const dkimHost = `${env.DKIM_SELECTOR}._domainkey.${domain.domain}`;
  const dkimPublicPart = dkimTxt.replace(/^v=DKIM1;\s*p=/i, "").trim();
  const dkimVerified = await hasTxtContains(dkimHost, dkimPublicPart || "v=DKIM1").catch(() => false);

  const verified = mailcowVerified && mxVerified && spfVerified && dkimVerified && dmarcVerified;
  const updated = await prisma.domain.update({
    where: { id: domain.id },
    data: {
      mxVerified,
      spfVerified,
      dkimVerified,
      dmarcVerified,
      mailcowVerified,
      status: verified ? "VERIFIED" : "FAILED",
      verifiedAt: verified ? new Date() : null,
      lastCheckedAt: new Date(),
    },
  });

  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId, role: { in: [Role.OWNER, Role.ADMIN] } },
    include: { user: { select: { email: true } } },
  });
  const template = verified ? "domain-verified" : "domain-failed";
  await Promise.all(
    members.map((m) =>
      sendSystemEmail(m.user.email, template, {
        domain: updated.domain,
        domainId: updated.id,
        verifiedAt: updated.verifiedAt?.toISOString() ?? new Date().toISOString(),
        mxStatus: mxVerified ? "✓ Verified" : "✗ Missing/Incorrect",
        spfStatus: spfVerified ? "✓ Verified" : "✗ Missing/Incorrect",
        dkimStatus: dkimVerified ? "✓ Verified" : "✗ Missing/Incorrect",
        dmarcStatus: dmarcVerified ? "✓ Verified" : "✗ Missing/Incorrect",
      }).catch(() => null),
    ),
  );

  return {
    domain: updated,
    dnsRecords: buildDnsRecords(domain.domain, dkimTxt),
    checks: { mxVerified, spfVerified, dkimVerified, dmarcVerified, mailcowVerified },
  };
}

export async function resetDomain(workspaceId: string, domainId: string, confirm: boolean) {
  if (!confirm) throw new Error("CONFIRM_REQUIRED");
  const domain = await prisma.domain.findFirst({
    where: { id: domainId, workspaceId },
    include: {
      mailboxes: {
        include: {
          emails: {
            include: {
              attachments: {
                select: { id: true, storagePath: true },
              },
            },
          },
        },
      },
    },
  });
  if (!domain) throw new Error("NOT_FOUND");

  const mailboxCount = domain.mailboxes.length;
  const emailCount = domain.mailboxes.reduce((sum, mb) => sum + mb.emails.length, 0);
  const attachments = domain.mailboxes.flatMap((mb) => mb.emails.flatMap((em) => em.attachments));
  const attachmentCount = attachments.length;

  for (const att of attachments) {
    if (!att.storagePath) continue;
    try {
      if (fs.existsSync(att.storagePath)) fs.unlinkSync(att.storagePath);
    } catch (e) {
      logger.warn(
        `resetDomain: failed to delete attachment file ${att.id} (${att.storagePath}) — ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  for (const mb of domain.mailboxes) {
    try {
      await deleteMailcowMailbox(mb.email);
    } catch (e) {
      logger.warn(
        `resetDomain: deleteMailcowMailbox failed for ${mb.email} — ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
  try {
    await deleteMailcowDomain(domain.domain);
  } catch (e) {
    logger.warn(`resetDomain: deleteMailcowDomain failed for ${domain.domain} — ${e instanceof Error ? e.message : String(e)}`);
  }

  await prisma.domain.delete({ where: { id: domain.id } });
  return {
    deleted: true,
    domain: domain.domain,
    counts: {
      mailboxes: mailboxCount,
      emails: emailCount,
      attachments: attachmentCount,
    },
  };
}
