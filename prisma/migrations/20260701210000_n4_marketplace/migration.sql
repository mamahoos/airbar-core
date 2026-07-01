-- CreateEnum
CREATE TYPE "TripStatus" AS ENUM ('DRAFT', 'ACTIVE', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('PENDING', 'MATCHED', 'ACCEPTED', 'PAYMENT_PENDING', 'PAID', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'CONFIRMED', 'DISPUTED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "CargoType" AS ENUM ('DOCUMENTS', 'ELECTRONICS', 'CLOTHING', 'FOOD', 'MEDICINE', 'COSMETICS', 'JEWELRY', 'OTHER');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('IRR', 'USD', 'EUR', 'USDT');

-- CreateTable
CREATE TABLE "trips" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "origin_city" TEXT NOT NULL,
    "origin_country" TEXT NOT NULL,
    "origin_airport" TEXT,
    "destination_city" TEXT NOT NULL,
    "destination_country" TEXT NOT NULL,
    "destination_airport" TEXT,
    "departure_date" TIMESTAMP(3) NOT NULL,
    "arrival_date" TIMESTAMP(3),
    "flight_number" TEXT,
    "available_weight" DOUBLE PRECISION NOT NULL,
    "max_weight" DOUBLE PRECISION NOT NULL,
    "available_volume" DOUBLE PRECISION,
    "accepted_cargo_types" "CargoType"[],
    "restrictions" TEXT[],
    "notes" TEXT,
    "base_price_per_kg" INTEGER NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'IRR',
    "status" "TripStatus" NOT NULL DEFAULT 'DRAFT',
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipments" (
    "id" TEXT NOT NULL,
    "tracking_code" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "carrier_id" TEXT,
    "trip_id" TEXT,
    "origin_city" TEXT NOT NULL,
    "origin_country" TEXT NOT NULL,
    "origin_address" TEXT,
    "origin_location" JSONB,
    "destination_city" TEXT NOT NULL,
    "destination_country" TEXT NOT NULL,
    "destination_address" TEXT,
    "destination_location" JSONB,
    "cargo_type" "CargoType" NOT NULL,
    "description" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "dimensions" JSONB,
    "declared_value" INTEGER,
    "photos" TEXT[],
    "pickup_date" TIMESTAMP(3),
    "delivery_date" TIMESTAMP(3),
    "sender_contact" JSONB,
    "receiver_contact" JSONB NOT NULL,
    "system_price" INTEGER NOT NULL,
    "agreed_price" INTEGER,
    "currency" "Currency" NOT NULL DEFAULT 'IRR',
    "status" "ShipmentStatus" NOT NULL DEFAULT 'PENDING',
    "current_location" JSONB,
    "tracking_history" JSONB[],
    "finance_escrow_id" TEXT,
    "payment_order_id" TEXT,
    "payment_method" TEXT,
    "picked_up_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "confirmed_at" TIMESTAMP(3),
    "dispute_reason" TEXT,
    "disputed_at" TIMESTAMP(3),
    "disputed_by_id" TEXT,
    "dispute_resolved_at" TIMESTAMP(3),
    "dispute_resolution" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_rules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "origin_country" TEXT,
    "destination_country" TEXT,
    "cargo_type" "CargoType",
    "base_price" INTEGER NOT NULL,
    "price_per_kg" INTEGER NOT NULL,
    "price_per_km" INTEGER,
    "risk_multiplier" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "platform_fee_percent" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "min_platform_fee" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricing_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cities" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "country_code" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "timezone" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "cities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "airports" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "country_code" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "airports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shipments_tracking_code_key" ON "shipments"("tracking_code");

-- CreateIndex
CREATE INDEX "trips_user_id_idx" ON "trips"("user_id");

-- CreateIndex
CREATE INDEX "trips_origin_city_destination_city_idx" ON "trips"("origin_city", "destination_city");

-- CreateIndex
CREATE INDEX "trips_departure_date_idx" ON "trips"("departure_date");

-- CreateIndex
CREATE INDEX "trips_status_idx" ON "trips"("status");

-- CreateIndex
CREATE INDEX "shipments_sender_id_idx" ON "shipments"("sender_id");

-- CreateIndex
CREATE INDEX "shipments_carrier_id_idx" ON "shipments"("carrier_id");

-- CreateIndex
CREATE INDEX "shipments_trip_id_idx" ON "shipments"("trip_id");

-- CreateIndex
CREATE INDEX "shipments_tracking_code_idx" ON "shipments"("tracking_code");

-- CreateIndex
CREATE INDEX "shipments_status_idx" ON "shipments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "cities_name_country_key" ON "cities"("name", "country");

-- CreateIndex
CREATE INDEX "cities_country_idx" ON "cities"("country");

-- CreateIndex
CREATE UNIQUE INDEX "airports_code_key" ON "airports"("code");

-- CreateIndex
CREATE INDEX "airports_city_idx" ON "airports"("city");

-- CreateIndex
CREATE INDEX "airports_country_idx" ON "airports"("country");

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_carrier_id_fkey" FOREIGN KEY ("carrier_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE SET NULL ON UPDATE CASCADE;
