-- CreateEnum
CREATE TYPE "DraftType" AS ENUM ('TRIP', 'SHIPMENT');

-- CreateEnum
CREATE TYPE "DraftStatus" AS ENUM ('NEW', 'CLAIMED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "DraftSource" AS ENUM ('TELEGRAM', 'API');

-- CreateTable
CREATE TABLE "draft_requests" (
    "id" TEXT NOT NULL,
    "preview_token" TEXT NOT NULL,
    "type" "DraftType" NOT NULL,
    "status" "DraftStatus" NOT NULL DEFAULT 'NEW',
    "source" "DraftSource" NOT NULL DEFAULT 'TELEGRAM',
    "payload" JSONB NOT NULL,
    "raw_payload" JSONB,
    "confidence" DOUBLE PRECISION,
    "telegram_chat_id" TEXT,
    "telegram_user_id" TEXT,
    "telegram_username" TEXT,
    "telegram_message_id" TEXT,
    "source_channel" TEXT,
    "claimed_by_id" TEXT,
    "claimed_trip_id" TEXT,
    "claimed_shipment_id" TEXT,
    "claimed_at" TIMESTAMP(3),
    "notified_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "draft_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "draft_requests_preview_token_key" ON "draft_requests"("preview_token");

-- CreateIndex
CREATE INDEX "draft_requests_status_idx" ON "draft_requests"("status");

-- CreateIndex
CREATE INDEX "draft_requests_type_idx" ON "draft_requests"("type");
