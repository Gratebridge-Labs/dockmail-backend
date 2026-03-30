# Dockmail — Backend API (SES overrides)

> **Use the merged master prompt:** [`docs/CURSOR_PROMPT_FULL.md`](CURSOR_PROMPT_FULL.md) — it inlines Prisma, env, tech stack, and SES deltas; keep this file as the detailed SES/Mailcow reference.

> **Outbound correction:** Product outbound email is sent through **Amazon SES** (verified domain identities, DKIM/SPF via SES). **Mailcow** on Contabo is for **inbound mail, IMAP, mailbox storage, and provisioning** (Mailcow API), not the app’s primary outbound transport.

## Important Instructions

Read this entire prompt before writing a single line of code. This is the complete backend specification for Dockmail — a multi-tenant professional email management platform. Build everything documented here. Every model, every endpoint, every middleware, every validation. Write clean, well-documented code with JSDoc comments on every function and route. No stubs, no TODOs left in production code. Document every API route in a separate `API.md` file as you build.

---

## Tech Stack

- **Runtime:** Node.js 20+
- **Framework:** Express.js
- **ORM:** Prisma
- **Database:** PostgreSQL
- **Auth:** JWT (access token 15min + refresh token 7 days)
- **Password hashing:** bcrypt (12 rounds)
- **Outbound email (application sends):** **Amazon SES** via `@aws-sdk/client-sesv2` (`SendEmail` / `SendRawEmail`). Use SES **verified identities** per tenant domain; DKIM/SPF alignment for sending is managed through SES (Easy DKIM, MAIL FROM domain). Optionally use **SES configuration sets** for event publishing (bounces/complaints → SNS/EventBridge).
- **Inbound / mailboxes:** **Mailcow** on Contabo VPS — Postfix/Dovecot for receiving and storing mail; **Mailcow HTTP API** for mailbox/domain provisioning. Do **not** use Mailcow SMTP as the primary path for product outbound sends.
- **Validation:** Zod (all request bodies and params)
- **File uploads:** Multer + local storage (profile images, attachments)
- **Real-time:** Socket.io (notifications, read receipts)
- **Queue:** Bull + Redis (email sending queue, scheduled emails — workers call **SES**, not Mailcow SMTP)
- **Rate limiting:** express-rate-limit
- **Logging:** Winston
- **Testing:** Jest + Supertest
- **Payment:** Simulated (no real payment gateway yet — mock Stripe-like flow)
- **DNS verification:** `dns` module (Node built-in) + **SES identity status** (AWS API) for domain verification state
- **Email tracking:** Custom pixel tracking endpoint

---

## Project Structure

```
dockmail-backend/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── src/
│   ├── config/
│   │   ├── database.ts          ← Prisma client singleton
│   │   ├── redis.ts             ← Redis connection
│   │   ├── socket.ts            ← Socket.io setup
│   │   ├── ses.ts               ← Amazon SES client + send helpers (NOT Nodemailer for outbound)
│   │   ├── queue.ts             ← Bull queue setup
│   │   └── env.ts               ← Zod env validation
│   ├── middleware/
│   │   ├── auth.ts
│   │   ├── role.ts
│   │   ├── validate.ts
│   │   ├── rateLimit.ts
│   │   ├── upload.ts
│   │   └── errorHandler.ts
│   ├── modules/
│   │   └── ... (same as original spec: auth, workspace, domain, mailbox, email, team, billing, notification, tracking, settings)
│   ├── utils/
│   │   ├── jwt.ts
│   │   ├── password.ts
│   │   ├── dns.ts               ← DNS checks + merge with SES GetEmailIdentity
│   │   ├── tracking.ts
│   │   ├── pagination.ts
│   │   ├── response.ts
│   │   └── slugify.ts
│   ├── types/
│   ├── app.ts
│   ├── server.ts
│   └── routes.ts
├── tests/
├── docs/
│   └── API.md
├── .env.example
├── package.json
└── tsconfig.json
```

---

## Environment Variables (.env.example)

```env
# Server
NODE_ENV=development
PORT=4000
CLIENT_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/dockmail

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_ACCESS_SECRET=your_access_secret_here
JWT_REFRESH_SECRET=your_refresh_secret_here
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d

# Amazon SES (outbound — required for product sends)
AWS_REGION=eu-north-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
# Optional: default configuration set for event publishing (bounces/complaints)
SES_CONFIGURATION_SET=dockmail-default

# Mailcow (inbound provisioning + IMAP hostnames in customer docs — not primary outbound)
MAILCOW_API_URL=https://mail.dockmail.app
MAILCOW_API_KEY=

# App Domain
APP_DOMAIN=dockmail.app
API_URL=https://api.dockmail.app

# Inbound MX / branding (what tenants point MX to)
INBOUND_MX_HOST=mail.dockmail.app

# Tracking
TRACKING_PIXEL_URL=https://api.dockmail.app/track/open
TRACKING_LINK_URL=https://api.dockmail.app/track/click

# Storage
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=26214400

# Billing (simulated)
PRICE_PER_MAILBOX=1.00
STORAGE_5GB_PRICE=0.00
STORAGE_20GB_PRICE=2.00
STORAGE_50GB_PRICE=5.00
STORAGE_100GB_PRICE=10.00
```

**Removed from default:** `SMTP_*` + Nodemailer as the primary outbound path. If you need **optional** Mailcow SMTP for manual/integration tests only, document it under `docs/` and keep it out of the main send pipeline.

---

## Prisma — Domain model (SES-aligned)

Replace the original `Domain` model fields that implied **locally generated DKIM key pairs** with SES-oriented fields. SES owns DKIM keys for outbound signing.

**Use something like:**

```prisma
model Domain {
  id                  String       @id @default(cuid())
  workspaceId       String
  domain              String       @unique
  status              DomainStatus @default(PENDING)

  mxVerified          Boolean      @default(false)
  spfVerified         Boolean      @default(false)
  dkimVerified        Boolean      @default(false)  // SES DKIM verification
  dmarcVerified       Boolean      @default(false)

  // SES — do NOT store private DKIM material; SES manages keys
  sesIdentityArn      String?
  sesMailFromDomain   String?      // e.g. bounce.customer.com

  lastCheckedAt       DateTime?
  verifiedAt          DateTime?
  createdAt           DateTime     @default(now())
  updatedAt           DateTime     @updatedAt

  workspace           Workspace    @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  mailboxes           Mailbox[]

  @@map("domains")
}
```

Remove `dkimPublicKey` / `dkimPrivateKey` from the schema unless you implement BYODKIM (not the default).

All **other models** from the original spec remain as specified (User, Workspace, Email, etc.).

---

## Domain module — POST `/v1/workspaces/:workspaceId/domains` (updated logic)

**Logic:**

1. Normalize domain (lowercase, trim).
2. Check domain not already used by another workspace.
3. **Create SES domain identity** (API) for that domain; enable Easy DKIM; configure custom MAIL FROM if product requires it.
4. Create `Domain` record with status `PENDING` and store `sesIdentityArn` if returned.
5. Return **DNS records from SES** (DKIM CNAMEs) plus your **inbound** records:

```json
{
  "domain": "acme.com",
  "dnsRecords": [
    { "type": "MX", "name": "@", "value": "mail.dockmail.app", "priority": 10 },
    { "type": "TXT", "name": "@", "value": "v=spf1 include:amazonses.com mx -all" },
    { "type": "TXT", "name": "_dmarc", "value": "v=DMARC1; p=none; rua=mailto:dmarc@acme.com; fo=1" },
    { "type": "CNAME", "name": "<ses-token-1>._domainkey", "value": "<ses-token-1>.dkim.amazonses.com" },
    { "type": "CNAME", "name": "<ses-token-2>._domainkey", "value": "<ses-token-2>.dkim.amazonses.com" },
    { "type": "CNAME", "name": "<ses-token-3>._domainkey", "value": "<ses-token-3>.dkim.amazonses.com" },
    { "type": "MX", "name": "bounce", "value": "10 feedback-smtp.<region>.amazonses.com" },
    { "type": "TXT", "name": "bounce", "value": "v=spf1 include:amazonses.com ~all" }
  ]
}
```

(Exact DKIM/MAIL FROM rows come from SES; do not fabricate.)

---

## Email module — POST `/v1/mailboxes/:mailboxId/emails/:emailId/send` (updated logic)

**Logic:**

1. Load draft; validate required fields.
2. If `scheduledAt`: queue Bull job; else enqueue immediate send job.
3. Inject tracking pixel and rewrite links (unchanged).
4. **Send via Amazon SES** (`SendRawEmail` recommended if you need full MIME + attachments). Use a **From** address allowed by SES for that verified domain (e.g. `hello@acme.com`). Use DKIM/signing as provided by SES for that identity.
5. On success: update status `SENT`, `sentAt`, folder `SENT`; store SES message ID if returned.
6. On failure: retry per Bull policy; final failure → `FAILED`, notifications.

Do **not** send product mail through Mailcow SMTP in this flow.

---

## Queue — `email:send` processor

- Worker builds MIME (or structured body) and calls **SES API**.
- Subscribe to **SES bounce/complaint** events (SNS → HTTPS webhook or SQS) and update suppression / `TrackingEvent_Log` / notifications.

---

## Standardized API Response, Auth, Routes, Socket.io, Rate limits, Logging, Tests, Checklist

**Unchanged** from your original full specification except wherever it mentioned:

- “Nodemailer + SMTP (Mailcow)” for sending → **Amazon SES**
- “Generate DKIM key pair locally” → **SES domain identity + SES DNS records**
- `mailer.ts` → **`ses.ts`**
- `.env` `SMTP_*` as primary → **AWS/SES variables**

---

## Final Checklist (additions)

- [ ] SES identities created/verified per tenant domain before enabling send
- [ ] No mailbox SMTP passwords used for application outbound (unless explicitly documented as optional test path)
- [ ] Bounce/complaint handling wired to SES event destinations
- [ ] `docs/API.md` updated to describe SES-based send and SES DNS onboarding

---

*This file is the authoritative correction layer. Merge with the remainder of your original Cursor prompt (all routes/modules not listed above) unchanged except for global substitution of outbound transport to SES.*
