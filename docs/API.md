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

**Description:** Add tenant domain and return SES + inbound DNS instructions.

**Auth required:** Yes (ADMIN/OWNER)

## POST /v1/workspaces/:workspaceId/domains/:domainId/verify

**Description:** Verify MX/SPF/DKIM/DMARC status using DNS + SES identity.

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

**Description:** Send or schedule draft via Amazon SES.

**Auth required:** Yes

## GET /v1/track/open/:trackingId

**Description:** Tracking pixel endpoint.

**Auth required:** No

## GET /v1/track/click/:trackingId

**Description:** Link click tracking and redirect.

**Auth required:** No
