-- Drafts were created with default folder INBOX; list API uses folder=DRAFTS.
UPDATE "emails"
SET "folder" = 'DRAFTS'::"EmailFolder"
WHERE "isDraft" = true
  AND "folder" = 'INBOX'::"EmailFolder"
  AND "status" IN ('DRAFT', 'SCHEDULED', 'QUEUED');
