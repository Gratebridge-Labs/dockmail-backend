import express from "express";
import { apiLimiter } from "./middleware/rateLimit";
import { rootRouter } from "./routes";
import { errorHandler, notFound } from "./middleware/errorHandler";

export const app = express();

app.use(express.json({ limit: "5mb" }));
app.use(apiLimiter);
app.use(rootRouter);
app.use(notFound);
app.use(errorHandler);
