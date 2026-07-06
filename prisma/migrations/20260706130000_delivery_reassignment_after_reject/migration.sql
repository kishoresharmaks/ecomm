-- Capture delivery partner rejection reasons for automatic reassignment analysis.

CREATE TYPE "DeliveryAssignmentRejectionReason" AS ENUM (
  'CAPACITY_FULL',
  'AREA_TOO_FAR',
  'VEHICLE_UNAVAILABLE',
  'COD_LIMIT_RISK',
  'PERSONAL_EMERGENCY',
  'OTHER'
);

ALTER TABLE "delivery_assignment_attempts"
  ADD COLUMN "rejection_reason" "DeliveryAssignmentRejectionReason";
