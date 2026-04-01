import type { Request } from "express";
import geoip from "geoip-lite";
import { prisma } from "../../config/database";
import { io } from "../../config/socket";

function parseDevice(userAgent: string | undefined): string {
  if (!userAgent) return "unknown";
  const ua = userAgent.toLowerCase();
  if (ua.includes("iphone") || ua.includes("ipad")) return "mobile";
  if (ua.includes("android")) return "mobile";
  if (ua.includes("windows")) return "desktop";
  if (ua.includes("mac os")) return "desktop";
  if (ua.includes("linux")) return "desktop";
  return "unknown";
}

function parseOs(userAgent: string | undefined): string {
  if (!userAgent) return "unknown";
  const ua = userAgent.toLowerCase();
  if (ua.includes("windows")) return "Windows";
  if (ua.includes("mac os")) return "macOS";
  if (ua.includes("iphone") || ua.includes("ipad")) return "iOS";
  if (ua.includes("android")) return "Android";
  if (ua.includes("linux")) return "Linux";
  return "unknown";
}

/**
 * Tracking pixel: log event, optional notification + socket on first open only — never send email.
 */
export async function handleTrackingOpen(req: Request, trackingId: string): Promise<void> {
  const email = await prisma.email.findUnique({
    where: { trackingId },
    include: { mailbox: { select: { workspaceId: true } } },
  });
  if (!email) return;

  const userAgentHeader = req.headers["user-agent"];
  const userAgent = Array.isArray(userAgentHeader) ? userAgentHeader[0] : userAgentHeader;
  const ip = req.ip ?? "";
  const geo = geoip.lookup(ip);
  const location = geo ? `${geo.city ?? ""}, ${geo.country}`.trim() : undefined;

  const priorOpens = await prisma.trackingEvent_Log.count({
    where: { emailId: email.id, event: "OPENED" },
  });
  const isFirstOpen = priorOpens === 0;

  await prisma.trackingEvent_Log.create({
    data: {
      emailId: email.id,
      event: "OPENED",
      ipAddress: ip,
      userAgent,
      device: parseDevice(userAgent),
      os: parseOs(userAgent),
      location,
    },
  });

  if (!isFirstOpen || !email.readReceiptEnabled) {
    return;
  }

  const recipientEmail = email.toAddresses[0] ?? "Recipient";
  const assignments = await prisma.mailboxAssignment.findMany({
    where: { mailboxId: email.mailboxId },
  });

  if (assignments.length) {
    await prisma.notification.createMany({
      data: assignments.map((a) => ({
        userId: a.userId,
        workspaceId: email.mailbox.workspaceId,
        type: "EMAIL_OPENED" as const,
        title: `${recipientEmail} opened your email`,
        body: email.subject,
        data: { emailId: email.id, trackingId, mailboxId: email.mailboxId },
      })),
    });
  }

  try {
    io.to(`mailbox:${email.mailboxId}`).emit("email:opened", {
      emailId: email.id,
      mailboxId: email.mailboxId,
      subject: email.subject,
      openedAt: new Date().toISOString(),
      recipientEmail,
      device: parseDevice(userAgent),
      location: location ?? "Unknown",
    });
  } catch {
    /* ignore socket errors */
  }
}
