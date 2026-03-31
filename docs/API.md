## GET /health

**Description:** Health check endpoint.

**Auth required:** No

**Response 200**

```json
{
  "success": true,
  "data": {
    "ok": true
  }
}
```

## POST /v1/auth/register

**Description:** Register a new user and create first workspace.

**Auth required:** No

## POST /v1/auth/login

**Description:** Login and receive tokens.

**Auth required:** No

## POST /v1/auth/refresh

**Description:** Rotate refresh token and issue new access token.

**Auth required:** No

## GET /v1/auth/me

**Description:** Fetch current user profile and workspaces.

**Auth required:** Yes

## POST /v1/workspaces

**Description:** Create workspace.

**Auth required:** Yes

## GET /v1/workspaces

**Description:** List workspaces for authenticated user.

**Auth required:** Yes

## POST /v1/workspaces/:workspaceId/domains

**Description:** Add tenant domain and return Mailcow SMTP/inbound DNS instructions.

**Auth required:** Yes (ADMIN/OWNER)

## POST /v1/workspaces/:workspaceId/domains/:domainId/verify

**Description:** Verify MX/SPF/DKIM/DMARC status using DNS records.

**Auth required:** Yes (ADMIN/OWNER)

## DELETE /v1/workspaces/:workspaceId/domains/:domainId/reset?confirm=true

**Description:** Delete domain and all related data (mailboxes, emails, attachments) for a clean re-onboarding test.

**Auth required:** Yes (ADMIN/OWNER)

## DELETE /v1/workspaces/:workspaceId/domains/:domainId/reset?confirm=true

**Description:** Delete a domain and all related mailboxes/emails/attachments for a clean reset test.

**Auth required:** Yes (ADMIN/OWNER)

## POST /v1/workspaces/:workspaceId/mailboxes

**Description:** Create mailbox and provision in Mailcow.

**Auth required:** Yes (ADMIN/OWNER)

## GET /v1/workspaces/:workspaceId/mailboxes/mine

**Description:** List mailboxes assigned to current user.

**Auth required:** Yes

## POST /v1/mailboxes/:mailboxId/emails

**Description:** Save email draft.

**Auth required:** Yes

## POST /v1/mailboxes/:mailboxId/emails/:emailId/send

**Description:** Send or schedule draft via SMTP.

**Auth required:** Yes

## GET /v1/track/open/:trackingId

**Description:** Tracking pixel endpoint.

**Auth required:** No

## GET /v1/track/click/:trackingId

**Description:** Link click tracking and redirect.

**Auth required:** No

## Team & Invites

- `GET /v1/workspaces/:workspaceId/team`
- `GET /v1/workspaces/:workspaceId/team/:memberId`
- `PATCH /v1/workspaces/:workspaceId/team/:memberId`
- `DELETE /v1/workspaces/:workspaceId/team/:memberId`
- `POST /v1/workspaces/:workspaceId/team/invite`
- `GET /v1/workspaces/:workspaceId/team/invites`
- `DELETE /v1/workspaces/:workspaceId/team/invites/:inviteId`
- `POST /v1/workspaces/:workspaceId/team/invites/:inviteId/resend`
- `POST /v1/auth/accept-invite`

## Billing

- `GET /v1/workspaces/:workspaceId/billing`
- `GET /v1/workspaces/:workspaceId/billing/invoices`
- `GET /v1/workspaces/:workspaceId/billing/invoices/:invoiceId`
- `POST /v1/workspaces/:workspaceId/billing/payment-method`
- `DELETE /v1/workspaces/:workspaceId/billing/payment-method`
- `PATCH /v1/workspaces/:workspaceId/billing/storage`
- `POST /v1/workspaces/:workspaceId/billing/simulate-payment`

## Notifications

- `GET /v1/notifications`
- `PATCH /v1/notifications/:notificationId/read`
- `POST /v1/notifications/read-all`
- `DELETE /v1/notifications/:notificationId`
- `GET /v1/notifications/count`

## Settings

- `GET /v1/users/settings`
- `PATCH /v1/users/settings/profile`
- `POST /v1/users/settings/avatar`
- `DELETE /v1/users/settings/avatar`
- `PATCH /v1/users/settings/notifications`
- `GET /v1/users/settings/sessions`
- `DELETE /v1/users/settings/sessions/:sessionId`

## Folders and Attachments

- `GET /v1/mailboxes/:mailboxId/folders`
- `POST /v1/mailboxes/:mailboxId/folders`
- `PATCH /v1/mailboxes/:mailboxId/folders/:folderId`
- `DELETE /v1/mailboxes/:mailboxId/folders/:folderId`
- `POST /v1/mailboxes/:mailboxId/emails/:emailId/attachments`
- `GET /v1/mailboxes/:mailboxId/emails/:emailId/attachments/:attachmentId`
- `DELETE /v1/mailboxes/:mailboxId/emails/:emailId/attachments/:attachmentId`
