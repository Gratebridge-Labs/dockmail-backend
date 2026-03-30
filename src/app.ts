import express from "express";
import { apiLimiter } from "./middleware/rateLimit";
import { rootRouter } from "./routes";
import { errorHandler, notFound } from "./middleware/errorHandler";
import { logger } from "./config/logger";

export const app = express();

app.use(express.json({ limit: "5mb" }));
app.use(apiLimiter);
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    logger.info({
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Date.now() - start,
      userId: req.user?.id ?? null,
    });
  });
  next();
});
app.use(rootRouter);
app.use(notFound);
app.use(errorHandler);
