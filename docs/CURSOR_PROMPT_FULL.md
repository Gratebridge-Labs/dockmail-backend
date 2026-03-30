# Dockmail — Backend API (Cursor Prompt) — **SES merged edition**

> **Merged:** Your full backend specification with `docs/BACKEND_SPEC.md` applied: **outbound = Amazon SES**; **inbound / mailboxes = Mailcow (API + IMAP)**; **no locally generated DKIM private keys** (SES manages outbound DKIM).

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
- **Outbound email (product / transactional):** **Amazon SES** via `@aws-sdk/client-sesv2` (`SendEmail` / `SendRawEmail`). Verified **SES domain identities** per tenant domain; DKIM/SPF for sending via SES (Easy DKIM, custom MAIL FROM). Optional **SES configuration sets** + SNS/EventBridge for bounces/complaints.
- **Inbound + mailbox hosting:** **Mailcow** on Contabo (receive/store mail; IMAP). **Mailcow HTTP API** for domain/mailbox provisioning. **Do not** use Mailcow SMTP as the primary outbound path for application sends.
- **Validation:** Zod (all request bodies and params)
- **File uploads:** Multer + local storage (profile images, attachments)
- **Real-time:** Socket.io (notifications, read receipts)
- **Queue:** Bull + Redis (email send jobs call **SES**; scheduled sends; billing; DNS re-check)
- **Rate limiting:** express-rate-limit
- **Logging:** Winston
- **Testing:** Jest + Supertest
- **Payment:** Simulated (no real payment gateway yet — mock Stripe-like flow)
- **DNS verification:** Node `dns` module + **SES `GetEmailIdentity` / identity status** for tenant domains
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
│   │   ├── ses.ts               ← Amazon SES client + send helpers (outbound)
│   │   ├── queue.ts             ← Bull queue setup
│   │   └── env.ts               ← Zod env validation
│   ├── middleware/
│   │   ├── auth.ts              ← JWT verify middleware
│   │   ├── role.ts              ← Role guard middleware
│   │   ├── validate.ts          ← Zod request validation
│   │   ├── rateLimit.ts         ← Rate limit configs
│   │   ├── upload.ts            ← Multer config
│   │   └── errorHandler.ts      ← Global error handler
│   ├── modules/
│   │   ├── auth/
│   │   ├── workspace/
│   │   ├── domain/
│   │   ├── mailbox/
│   │   ├── email/
│   │   ├── team/
│   │   ├── billing/
│   │   ├── notification/
│   │   ├── tracking/
│   │   └── settings/
│   ├── utils/
│   │   ├── jwt.ts
│   │   ├── password.ts
│   │   ├── dns.ts               ← DNS + SES identity checks
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
├── .env
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

# Amazon SES (outbound — required)
AWS_REGION=eu-north-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
SES_CONFIGURATION_SET=dockmail-default

# Mailcow (provisioning — not primary outbound)
MAILCOW_API_URL=https://mail.dockmail.app
MAILCOW_API_KEY=

# App
APP_DOMAIN=dockmail.app
API_URL=https://api.dockmail.app
INBOUND_MX_HOST=mail.dockmail.app

# Tracking
TRACKING_PIXEL_URL=https://api.dockmail.app/v1/track/open
TRACKING_LINK_URL=https://api.dockmail.app/v1/track/click

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

---

## Prisma Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── ENUMS ────────────────────────────────────────────────────────────────────

enum Role {
  OWNER
  ADMIN
  MEMBER
}

enum DomainStatus {
  PENDING
  VERIFIED
  FAILED
}

enum MailboxStatus {
  ACTIVE
  INACTIVE
  SUSPENDED
}

enum EmailFolder {
  INBOX
  SENT
  DRAFTS
  SPAM
  TRASH
  ARCHIVE
}

enum EmailStatus {
  DRAFT
  QUEUED
  SENT
  DELIVERED
  FAILED
  SCHEDULED
}

enum TrackingEvent {
  SENT
  DELIVERED
  OPENED
  CLICKED
  BOUNCED
  COMPLAINED
}

enum RequestStatus {
  PENDING
  APPROVED
  DECLINED
}

enum NotificationType {
  EMAIL_OPENED
  NEW_EMAIL
  TEAM_JOINED
  MAILBOX_REQUEST
  MAILBOX_APPROVED
  MAILBOX_DECLINED
  INVITE_ACCEPTED
  BILLING_ALERT
  DOMAIN_VERIFIED
  SYSTEM
}

enum BillingStatus {
  ACTIVE
  PAST_DUE
  CANCELLED
  TRIALING
}

enum InvoiceStatus {
  PENDING
  PAID
  FAILED
}

enum StorageTier {
  GB_5
  GB_20
  GB_50
  GB_100
}

// ─── MODELS ───────────────────────────────────────────────────────────────────

model User {
  id                String    @id @default(cuid())
  email             String    @unique
  passwordHash      String
  fullName          String
  displayName       String?
  avatarUrl         String?
  timezone          String    @default("UTC")
  emailVerified     Boolean   @default(false)
  emailVerifyToken  String?
  resetToken        String?
  resetTokenExpiry  DateTime?
  twoFactorEnabled  Boolean   @default(false)
  twoFactorSecret   String?
  lastLoginAt       DateTime?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  workspaceMembers  WorkspaceMember[]
  refreshTokens     RefreshToken[]
  notifications     Notification[]
  sessions          Session[]

  @@map("users")
}

model RefreshToken {
  id          String   @id @default(cuid())
  token       String   @unique
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  deviceInfo  String?
  ipAddress   String?
  expiresAt   DateTime
  createdAt   DateTime @default(now())

  @@map("refresh_tokens")
}

model Session {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  deviceName  String?
  deviceType  String?
  ipAddress   String?
  location    String?
  userAgent   String?
  lastActiveAt DateTime @default(now())
  createdAt   DateTime @default(now())

  @@map("sessions")
}

model Workspace {
  id          String   @id @default(cuid())
  name        String
  slug        String   @unique
  logoUrl     String?
  signature   String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  members     WorkspaceMember[]
  domains     Domain[]
  mailboxes   Mailbox[]
  invites     Invite[]
  billing     Billing?
  requests    MailboxRequest[]
  apiKeys     ApiKey[]
  notifications Notification[]

  @@map("workspaces")
}

model WorkspaceMember {
  id          String    @id @default(cuid())
  userId      String
  workspaceId String
  role        Role      @default(MEMBER)
  joinedAt    DateTime  @default(now())

  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  notifyEmailOpened   Boolean @default(true)
  notifyNewEmail      Boolean @default(true)
  notifyTeamActivity  Boolean @default(true)
  notifyMailboxReq    Boolean @default(true)
  notifyBilling       Boolean @default(true)

  @@unique([userId, workspaceId])
  @@map("workspace_members")
}

model Invite {
  id          String    @id @default(cuid())
  workspaceId String
  email       String
  role        Role      @default(MEMBER)
  token       String    @unique @default(cuid())
  invitedById String
  message     String?
  expiresAt   DateTime
  acceptedAt  DateTime?
  createdAt   DateTime  @default(now())

  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@map("invites")
}

// Outbound DKIM is owned by SES — do not store DKIM private keys in DB.
model Domain {
  id                String       @id @default(cuid())
  workspaceId       String
  domain            String       @unique
  status            DomainStatus @default(PENDING)
  mxVerified        Boolean      @default(false)
  spfVerified       Boolean      @default(false)
  dkimVerified      Boolean      @default(false)
  dmarcVerified     Boolean      @default(false)
  sesIdentityArn    String?
  sesMailFromDomain String?
  lastCheckedAt     DateTime?
  verifiedAt        DateTime?
  createdAt         DateTime     @default(now())
  updatedAt         DateTime     @updatedAt

  workspace         Workspace    @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  mailboxes         Mailbox[]

  @@map("domains")
}

model Mailbox {
  id             String        @id @default(cuid())
  workspaceId    String
  domainId       String
  localPart      String
  email          String        @unique
  displayName    String?
  status         MailboxStatus @default(ACTIVE)
  storageLimitMb Int           @default(5120)
  storageUsedMb  Int           @default(0)
  password       String
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt

  workspace      Workspace     @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  domain         Domain        @relation(fields: [domainId], references: [id], onDelete: Cascade)
  assignments    MailboxAssignment[]
  emails         Email[]
  folders        Folder[]

  @@unique([localPart, domainId])
  @@map("mailboxes")
}

model MailboxAssignment {
  id           String   @id @default(cuid())
  mailboxId    String
  userId       String
  assignedById String
  assignedAt   DateTime @default(now())

  mailbox      Mailbox  @relation(fields: [mailboxId], references: [id], onDelete: Cascade)

  @@unique([mailboxId, userId])
  @@map("mailbox_assignments")
}

model MailboxRequest {
  id            String        @id @default(cuid())
  workspaceId   String
  requestedById String
  localPart     String
  domainId      String
  reason        String?
  status        RequestStatus @default(PENDING)
  reviewedById  String?
  reviewedAt    DateTime?
  reviewNote    String?
  createdAt     DateTime      @default(now())

  workspace     Workspace     @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@map("mailbox_requests")
}

model Folder {
  id          String   @id @default(cuid())
  mailboxId   String
  name        String
  color       String?
  order       Int      @default(0)
  createdAt   DateTime @default(now())

  mailbox     Mailbox  @relation(fields: [mailboxId], references: [id], onDelete: Cascade)
  emails      EmailFolder_Assignment[]

  @@unique([mailboxId, name])
  @@map("folders")
}

model Email {
  id              String      @id @default(cuid())
  mailboxId       String
  messageId       String?     @unique
  folder          EmailFolder @default(INBOX)
  status          EmailStatus @default(DRAFT)

  fromAddress     String
  fromName        String?
  toAddresses     String[]
  ccAddresses     String[]    @default([])
  bccAddresses    String[]    @default([])
  replyTo         String?

  subject         String
  bodyHtml        String
  bodyText        String?
  snippet         String?

  threadId        String?
  inReplyTo       String?
  references      String[]    @default([])

  isRead          Boolean     @default(false)
  isStarred       Boolean     @default(false)
  isDraft         Boolean     @default(false)
  isScheduled     Boolean     @default(false)
  scheduledAt     DateTime?
  sentAt          DateTime?
  receivedAt      DateTime?
  deletedAt       DateTime?

  trackingId      String?     @unique
  readReceiptEnabled Boolean  @default(true)

  sizeBytes       Int         @default(0)

  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  mailbox         Mailbox     @relation(fields: [mailboxId], references: [id], onDelete: Cascade)
  attachments     Attachment[]
  trackingEvents  TrackingEvent_Log[]
  folderAssignments EmailFolder_Assignment[]

  @@index([mailboxId, folder])
  @@index([threadId])
  @@index([trackingId])
  @@map("emails")
}

model EmailFolder_Assignment {
  id        String  @id @default(cuid())
  emailId   String
  folderId  String

  email     Email   @relation(fields: [emailId], references: [id], onDelete: Cascade)
  folder    Folder  @relation(fields: [folderId], references: [id], onDelete: Cascade)

  @@unique([emailId, folderId])
  @@map("email_folder_assignments")
}

model Attachment {
  id          String   @id @default(cuid())
  emailId     String
  filename    String
  mimeType    String
  sizeBytes   Int
  storagePath String
  createdAt   DateTime @default(now())

  email       Email    @relation(fields: [emailId], references: [id], onDelete: Cascade)

  @@map("attachments")
}

model TrackingEvent_Log {
  id          String        @id @default(cuid())
  emailId     String
  event       TrackingEvent
  ipAddress   String?
  userAgent   String?
  device      String?
  os          String?
  location    String?
  clickedUrl  String?
  occurredAt  DateTime      @default(now())

  email       Email         @relation(fields: [emailId], references: [id], onDelete: Cascade)

  @@map("tracking_events")
}

model Notification {
  id          String           @id @default(cuid())
  userId      String
  workspaceId String?
  type        NotificationType
  title       String
  body        String?
  data        Json?
  isRead      Boolean          @default(false)
  readAt      DateTime?
  createdAt   DateTime         @default(now())

  user        User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  workspace   Workspace?       @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@index([userId, isRead])
  @@map("notifications")
}

model Billing {
  id                 String        @id @default(cuid())
  workspaceId        String        @unique
  status             BillingStatus @default(TRIALING)
  storageTier        StorageTier   @default(GB_5)
  trialEndsAt        DateTime?
  currentPeriodStart DateTime?
  currentPeriodEnd   DateTime?
  cancelledAt        DateTime?

  cardLast4          String?
  cardBrand          String?
  cardExpiry         String?

  createdAt          DateTime      @default(now())
  updatedAt          DateTime      @updatedAt

  workspace          Workspace     @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  invoices           Invoice[]

  @@map("billing")
}

model Invoice {
  id            String        @id @default(cuid())
  billingId     String
  amount        Float
  mailboxCount  Int
  storageCost   Float
  status        InvoiceStatus @default(PENDING)
  paidAt        DateTime?
  periodStart   DateTime
  periodEnd     DateTime
  createdAt     DateTime      @default(now())

  billing       Billing       @relation(fields: [billingId], references: [id], onDelete: Cascade)

  @@map("invoices")
}

model ApiKey {
  id            String   @id @default(cuid())
  workspaceId   String
  name          String
  keyHash       String   @unique
  keyPrefix     String
  permissions   String[]
  lastUsedAt    DateTime?
  revokedAt     DateTime?
  createdAt     DateTime @default(now())

  workspace     Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@map("api_keys")
}
```

---

## Standardized API Response Format

Same as your original spec (success wrapper + error codes). No change.

---

## Authentication Middleware

Same as your original spec (`req.user`, `req.workspaceId`, `req.workspaceMember`, role guards).

---

## API Routes — Full Specification (SES deltas)

**Base URL:** `https://api.dockmail.app/v1`

All modules and paths from your original prompt **remain the same**, except the following **must** be implemented with SES + Mailcow as below.

### Global rules

1. **Transactional emails** (register verify, password reset, invites, notifications that send email): use **Amazon SES** (same as product outbound), not Mailcow SMTP, unless you explicitly document an exception for local dev.
2. **Tenant domain onboarding:** create **SES domain identity** via API; return **SES-provided** DKIM CNAMEs + MAIL FROM MX/TXT; inbound MX still points to `INBOUND_MX_HOST` (e.g. `mail.dockmail.app`).
3. **Send draft / queue:** Bull workers call **SES** (`SendRawEmail` recommended for MIME + attachments).
4. **Verification:** combine `dns.resolve*` checks with **SES identity status** for DKIM/SPF alignment as appropriate.

### DOMAIN MODULE — `POST /v1/workspaces/:workspaceId/domains` (replaces original step 3–5)

**Logic:**

1. Normalize domain (lowercase, trim).
2. Check domain not already used by another workspace.
3. **Create SES domain identity** (Easy DKIM); store `sesIdentityArn` if returned; set `sesMailFromDomain` if you use custom MAIL FROM per tenant.
4. Create `Domain` record with status `PENDING`.
5. Return DNS records: **inbound MX** + **SPF/DMARC** + **SES DKIM CNAMEs** + **SES MAIL FROM** records (exact strings from SES API — do not fabricate).

Example shape (values must come from SES for DKIM/MAIL FROM):

```json
{
  "domain": "acme.com",
  "dnsRecords": [
    { "type": "MX", "name": "@", "value": "mail.dockmail.app", "priority": 10 },
    { "type": "TXT", "name": "@", "value": "v=spf1 include:amazonses.com mx -all" },
    { "type": "TXT", "name": "_dmarc", "value": "v=DMARC1; p=none; rua=mailto:dmarc@acme.com; fo=1" },
    { "type": "CNAME", "name": "<ses>._domainkey", "value": "<ses>.dkim.amazonses.com" },
    { "type": "MX", "name": "bounce", "value": "feedback-smtp.<region>.amazonses.com", "priority": 10 },
    { "type": "TXT", "name": "bounce", "value": "v=spf1 include:amazonses.com ~all" }
  ]
}
```

### DOMAIN — `POST .../domains/:domainId/verify`

1. Node `dns` checks for MX/SPF/DMARC as designed.
2. **Also** refresh SES identity status until DKIM + domain verification match product rules.
3. Update `mxVerified`, `spfVerified`, `dkimVerified`, `dmarcVerified` accordingly; set `VERIFIED` when policy satisfied.

### EMAIL MODULE — `POST /v1/mailboxes/:mailboxId/emails/:emailId/send`

Replace original step 6 **“Send via Nodemailer SMTP using mailbox credentials”** with:

6. **Send via Amazon SES** using a From identity allowed for that domain (`SendRawEmail` or `SendEmail`). Persist SES message id if returned. Do **not** use Mailcow SMTP for this send path.

Steps 1–5 and 7–9 unchanged (tracking injection, queue, status `SENT`, storage usage).

### EMAIL Queue (`email:send` job)

Job processor calls **SES API**, not SMTP. On failure after retries: `FAILED`, notifications, Socket `email:failed`. Wire **SES bounce/complaint** events (e.g. SNS → HTTPS) into suppression + optional `TrackingEvent_Log` / notifications.

---

## Remaining API modules

The following are **unchanged** from your original full specification (copy them verbatim from your prompt): **Auth, Workspace, Mailbox, Folder, Attachment, Team, Billing, Notification, Tracking, Settings, API Keys**, Socket.io events, rate limits, error handling, Winston logging, `docs/API.md` template, and the **Final Checklist** — with these checklist adjustments:

- Replace “DKIM private keys never returned” with: **SES-managed DKIM; never store or return SES secrets; do not store outbound DKIM private material in the DB.**
- Add: **SES identities verified before enabling send; bounce/complaint handling implemented.**

---

## Reference

- Detailed SES/env/queue notes: [`docs/BACKEND_SPEC.md`](BACKEND_SPEC.md)

---

*End of merged prompt. Paste your original Auth → API Keys route sections after this file if you need a single printable document without opening two files; the only behavioral changes are listed under “API Routes — Full Specification (SES deltas)” and Prisma `Domain` model above.*
