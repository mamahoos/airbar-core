-- CreateEnum
CREATE TYPE "CampaignType" AS ENUM ('PROMO_CREDIT', 'REFERRAL', 'CAMPAIGN_BONUS', 'DISCOUNT_SUBSIDY');

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "CampaignType" NOT NULL DEFAULT 'PROMO_CREDIT',
    "amount_rials" INTEGER NOT NULL,
    "expires_at" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "max_grants" INTEGER,
    "grant_count" INTEGER NOT NULL DEFAULT 0,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "campaigns_slug_key" ON "campaigns"("slug");
