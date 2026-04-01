import { Request, Response } from "express";
import { prisma } from "../../config/database";
import { transparentGifBuffer } from "../../utils/tracking";
import { handleTrackingOpen } from "./tracking.service";

export async function openPixel(req: Request, res: Response) {
  const trackingId = String(req.params.trackingId);
  try {
    await handleTrackingOpen(req, trackingId);
  } catch {
    /* still return pixel */
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
