import { Request, Response } from "express";
import geoip from "geoip-lite";
import { prisma } from "../../config/database";
import { transparentGifBuffer } from "../../utils/tracking";
import { sendSystemEmail } from "../../services/email.service";

export async function openPixel(req: Request, res: Response) {
  const trackingId = String(req.params.trackingId);
  const email = await prisma.email.findUnique({ where: { trackingId } });
  if (email) {
    const userAgentHeader = req.headers["user-agent"];
    const userAgent = Array.isArray(userAgentHeader) ? userAgentHeader[0] : userAgentHeader;
    const ip = req.ip ?? "";
    const geo = geoip.lookup(ip);
    await prisma.trackingEvent_Log.create({
      data: {
        emailId: email.id,
        event: "OPENED",
        ipAddress: ip,
        userAgent,
        device: "unknown",
        os: "unknown",
        location: geo ? `${geo.city ?? ""}, ${geo.country}`.trim() : undefined,
      },
    });
    if (email.readReceiptEnabled && email.fromAddress) {
      await sendSystemEmail(email.fromAddress, "email-opened-receipt", {
        recipientEmail: email.toAddresses[0] ?? "Recipient",
        emailSubject: email.subject,
        openedAt: new Date().toISOString(),
        device: "unknown",
        os: "unknown",
        location: geo ? `${geo.city ?? ""}, ${geo.country}`.trim() : "Unknown",
        openCount: "1",
        emailUrl: "https://dockmail.app/dashboard/inbox",
      }).catch(() => null);
    }
  }
  res.setHeader("Content-Type", "image/gif");
  res.setHeader("Cache-Control", "no-cache, no-store");
  return res.send(transparentGifBuffer());
}

export async function clickLink(req: Request, res: Response) {
  const trackingId = String(req.params.trackingId);
  const target = String(req.query.url || "");
  const email = await prisma.email.findUnique({ where: { trackingId } });
  if (email) {
    const userAgentHeader = req.headers["user-agent"];
    const userAgent = Array.isArray(userAgentHeader) ? userAgentHeader[0] : userAgentHeader;
    await prisma.trackingEvent_Log.create({
      data: {
        emailId: email.id,
        event: "CLICKED",
        ipAddress: req.ip,
        userAgent,
        clickedUrl: target,
      },
    });
  }
  return res.redirect(302, target || "https://dockmail.app");
}
