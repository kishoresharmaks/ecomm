-- CreateEnum
CREATE TYPE "ShippingPricingType" AS ENUM ('FLAT', 'DISTANCE');

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "weight_kg" DECIMAL(10,3) DEFAULT 0;

-- AlterTable
ALTER TABLE "shipping_rate_cards" ADD COLUMN     "max_weight_kg" DECIMAL(10,3),
ADD COLUMN     "pricing_config" JSONB,
ADD COLUMN     "pricing_type" "ShippingPricingType" NOT NULL DEFAULT 'FLAT';

