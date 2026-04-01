-- Any draft still filed as INBOX (e.g. created before folder=DRAFTS or missed by prior filter).
UPDATE "emails"
SET "folder" = 'DRAFTS'::"EmailFolder"
WHERE "isDraft" = true
  AND "folder" = 'INBOX'::"EmailFolder";
