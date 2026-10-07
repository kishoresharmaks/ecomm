-- Add Admin TOTP MFA and recovery codes
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AdminMfaType') THEN
    CREATE TYPE "AdminMfaType" AS ENUM ('NONE', 'TOTP');
  END IF;
END $$;

ALTER TABLE "admin_credentials" ADD COLUMN IF NOT EXISTS "mfa_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "admin_credentials" ADD COLUMN IF NOT EXISTS "mfa_type" "AdminMfaType" NOT NULL DEFAULT 'NONE';
ALTER TABLE "admin_credentials" ADD COLUMN IF NOT EXISTS "mfa_secret_encrypted" TEXT;
ALTER TABLE "admin_credentials" ADD COLUMN IF NOT EXISTS "mfa_enforced_at" TIMESTAMP(3);
ALTER TABLE "admin_credentials" ADD COLUMN IF NOT EXISTS "failed_mfa_attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "admin_credentials" ADD COLUMN IF NOT EXISTS "mfa_locked_until" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "admin_credentials_mfa_locked_until_idx" ON "admin_credentials"("mfa_locked_until");

CREATE TABLE IF NOT EXISTS "admin_mfa_recovery_codes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "credential_id" UUID NOT NULL,
    "code_hash" TEXT NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_mfa_recovery_codes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "admin_mfa_recovery_codes_credential_id_used_at_idx" ON "admin_mfa_recovery_codes"("credential_id", "used_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'admin_mfa_recovery_codes_credential_id_fkey'
  ) THEN
    ALTER TABLE "admin_mfa_recovery_codes"
      ADD CONSTRAINT "admin_mfa_recovery_codes_credential_id_fkey"
      FOREIGN KEY ("credential_id") REFERENCES "admin_credentials"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
