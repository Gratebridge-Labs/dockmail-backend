import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3000),
  CLIENT_URL: z.string().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  JWT_ACCESS_SECRET: z.string().default("change-me-access"),
  JWT_REFRESH_SECRET: z.string().default("change-me-refresh"),
  JWT_ACCESS_EXPIRES: z.string().default("15m"),
  JWT_REFRESH_EXPIRES: z.string().default("7d"),
  AWS_REGION: z.string().default("eu-north-1"),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  SES_CONFIGURATION_SET: z.string().optional(),
  MAILCOW_API_URL: z.string().optional(),
  MAILCOW_API_KEY: z.string().optional(),
  APP_DOMAIN: z.string().default("dockmail.app"),
  API_URL: z.string().optional(),
  INBOUND_MX_HOST: z.string().default("mail.dockmail.app"),
  TRACKING_PIXEL_URL: z.string().default("https://api.dockmail.app/v1/track/open"),
  TRACKING_LINK_URL: z.string().default("https://api.dockmail.app/v1/track/click"),
  UPLOAD_DIR: z.string().default("./uploads"),
  MAX_FILE_SIZE: z.coerce.number().default(26214400),
  PRICE_PER_MAILBOX: z.coerce.number().default(1),
  STORAGE_5GB_PRICE: z.coerce.number().default(0),
  STORAGE_20GB_PRICE: z.coerce.number().default(2),
  STORAGE_50GB_PRICE: z.coerce.number().default(5),
  STORAGE_100GB_PRICE: z.coerce.number().default(10),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  // Keep startup failure explicit and concise.
  throw new Error(`Invalid environment: ${parsed.error.message}`);
}

export const env = parsed.data;
