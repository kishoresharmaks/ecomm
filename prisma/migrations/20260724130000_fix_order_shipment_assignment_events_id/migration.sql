-- Fix order_shipment_assignment_events id column default and trigger function
ALTER TABLE "order_shipment_assignment_events"
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

CREATE OR REPLACE FUNCTION "record_order_shipment_assignment_event"()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."delivery_partner_user_id" IS NOT NULL
       OR NEW."assignment_status" <> 'UNASSIGNED' THEN
      INSERT INTO "order_shipment_assignment_events" (
        "id",
        "order_shipment_id",
        "order_id",
        "partner_user_id",
        "status",
        "assignment_note",
        "assigned_at",
        "accepted_at",
        "rejected_at",
        "assignment_expires_at"
      ) VALUES (
        gen_random_uuid(),
        NEW."id",
        NEW."order_id",
        NEW."delivery_partner_user_id",
        NEW."assignment_status",
        NEW."assignment_note",
        NEW."assigned_at",
        NEW."accepted_at",
        NEW."rejected_at",
        NEW."assignment_expires_at"
      );
    END IF;
    RETURN NEW;
  END IF;

  IF ROW(
    OLD."delivery_partner_user_id",
    OLD."assignment_status",
    OLD."assignment_note",
    OLD."assigned_at",
    OLD."accepted_at",
    OLD."rejected_at",
    OLD."assignment_expires_at"
  ) IS DISTINCT FROM ROW(
    NEW."delivery_partner_user_id",
    NEW."assignment_status",
    NEW."assignment_note",
    NEW."assigned_at",
    NEW."accepted_at",
    NEW."rejected_at",
    NEW."assignment_expires_at"
  ) THEN
    INSERT INTO "order_shipment_assignment_events" (
      "id",
      "order_shipment_id",
      "order_id",
      "previous_partner_user_id",
      "partner_user_id",
      "previous_status",
      "status",
      "assignment_note",
      "assigned_at",
      "accepted_at",
      "rejected_at",
      "assignment_expires_at"
    ) VALUES (
      gen_random_uuid(),
      NEW."id",
      NEW."order_id",
      OLD."delivery_partner_user_id",
      NEW."delivery_partner_user_id",
      OLD."assignment_status",
      NEW."assignment_status",
      NEW."assignment_note",
      NEW."assigned_at",
      NEW."accepted_at",
      NEW."rejected_at",
      NEW."assignment_expires_at"
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
