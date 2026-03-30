import { Router } from "express";
import { clickLink, openPixel } from "./tracking.controller";

export const trackingRouter = Router();

trackingRouter.get("/open/:trackingId", openPixel);
trackingRouter.get("/click/:trackingId", clickLink);
