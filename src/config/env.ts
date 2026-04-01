import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3000),
  CLIENT_URL: z.string().default("http://localhost:3000"),
  CORS_ORIGINS: z.string().default("http://localhost:3000,http://localhost:3001,https://dockmail.app"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  JWT_ACCESS_SECRET: z.string().default("change-me-access"),
  JWT_REFRESH_SECRET: z.string().default("change-me-refresh"),
  JWT_ACCESS_EXPIRES: z.string().default("1h"),
  JWT_REFRESH_EXPIRES: z.string().default("7d"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: z.enum(["true", "false"]).default("false"),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM_NOREPLY: z.string().default("noreply@dockmail.app"),
  MAIL_FROM_SUPPORT: z.string().default("support@dockmail.app"),
  MAIL_FROM_BILLING: z.string().default("billing@dockmail.app"),
  MAIL_FROM_SECURITY: z.string().default("security@dockmail.app"),
  SYSTEM_MAILBOX_SHARED_PASS: z.string().optional(),
  MAILCOW_API_URL: z.string().optional(),
  MAILCOW_API_KEY: z.string().optional(),
  /** Set to "true" when calling Mailcow over HTTPS with a self-signed cert (e.g. SSH tunnel to localhost). */
  MAILCOW_TLS_INSECURE: z.enum(["true", "false"]).optional(),
  APP_DOMAIN: z.string().default("dockmail.app"),
  API_URL: z.string().default("https://api.dockmail.app"),
  INBOUND_MX_HOST: z.string().default("mail.dockmail.app"),
  /** IMAP host for inbound sync (defaults to INBOUND_MX_HOST / Mailcow). */
  IMAP_HOST: z.string().optional(),
  IMAP_PORT: z.coerce.number().default(993),
  /** Set "true" for self-signed IMAP TLS (dev / tunnel). */
  IMAP_TLS_INSECURE: z.enum(["true", "false"]).optional(),
  /** Set "false" to disable the IMAP IDLE workers. */
  IMAP_SYNC_ENABLED: z.enum(["true", "false"]).default("true"),
  /** Max messages to import on first sync when imapLastUid is null. */
  IMAP_INITIAL_SYNC_LIMIT: z.coerce.number().default(50),
  TRACKING_PIXEL_URL: z.string().default("https://api.dockmail.app/v1/track/open"),
  TRACKING_LINK_URL: z.string().default("https://api.dockmail.app/v1/track/click"),
  DKIM_SELECTOR: z.string().default("dkim"),
  /** Optional: set Mailcow DKIM public key so addDomain can return exact TXT value. */
  DKIM_PUBLIC_KEY: z.string().optional(),
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

export const corsAllowedOrigins = env.CORS_ORIGINS.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
