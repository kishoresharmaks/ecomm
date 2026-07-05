-- Store customer-uploaded return quality proof asset keys.
-- Values are private storage asset keys created through the storage upload flow.

ALTER TABLE "return_requests"
  ADD COLUMN "quality_proof_keys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
