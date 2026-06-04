-- Add a dedicated back-office role for courier and delivery operations.
ALTER TYPE "RoleCode" ADD VALUE IF NOT EXISTS 'COURIER_MANAGER';

INSERT INTO "roles" ("id", "code", "name", "description", "created_at", "updated_at")
VALUES (
  gen_random_uuid(),
  'COURIER_MANAGER',
  'Courier Manager',
  'Back-office logistics user for courier booking, labels, routing failures, and delivery operations.',
  now(),
  now()
)
ON CONFLICT ("code") DO UPDATE
SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "updated_at" = now();
