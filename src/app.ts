import express from "express";
import cors from "cors";
import path from "node:path";
import { apiLimiter } from "./middleware/rateLimit";
import { rootRouter } from "./routes";
import { errorHandler, notFound } from "./middleware/errorHandler";
import { logger } from "./config/logger";
import { corsAllowedOrigins, env } from "./config/env";

export const app = express();

app.set("trust proxy", 1);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (corsAllowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(express.json({ limit: "5mb" }));
// Serve only public uploads; private attachments are served via authenticated download endpoints.
app.use("/uploads", express.static(path.resolve(env.UPLOAD_DIR, "public")));
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
