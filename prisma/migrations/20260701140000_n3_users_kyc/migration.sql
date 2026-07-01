-- N3 Users + KYC: profile fields, identity, bank, payout, addresses, kyc documents.

CREATE TYPE "KycStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "users"
  ADD COLUMN "avatar_url" TEXT,
  ADD COLUMN "bio" TEXT,
  ADD COLUMN "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "total_trips" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "total_shipments" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "identity_pending_person_info" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "user_identity_profiles" (
  "user_id" TEXT NOT NULL,
  "national_id_hash" TEXT NOT NULL,
  "national_id_ciphertext" TEXT NOT NULL,
  "first_name_official" TEXT,
  "last_name_official" TEXT,
  "father_name" TEXT,
  "birth_date" TIMESTAMP(3),
  "birth_date_jalali" TEXT,
  "gender" TEXT,
  "is_alive" BOOLEAN,
  "person_info_raw" JSONB,
  "shahkar_verified_at" TIMESTAMP(3),
  "person_info_verified_at" TIMESTAMP(3),
  "person_image_storage_key" TEXT,
  "passport_number" TEXT,
  "passport_status_raw" JSONB,
  "identity_pending_person_info" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "user_identity_profiles_pkey" PRIMARY KEY ("user_id")
);

CREATE UNIQUE INDEX "user_identity_profiles_national_id_hash_key" ON "user_identity_profiles"("national_id_hash");

ALTER TABLE "user_identity_profiles"
  ADD CONSTRAINT "user_identity_profiles_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "user_bank_accounts" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "card_number_masked" TEXT NOT NULL,
  "card_number_hash" TEXT NOT NULL,
  "card_number_ciphertext" TEXT,
  "iban_hash" TEXT,
  "iban_ciphertext" TEXT,
  "bank_name" TEXT,
  "account_holder_name" TEXT,
  "card_match_verified_at" TIMESTAMP(3),
  "iban_match_verified_at" TIMESTAMP(3),
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "user_bank_accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_bank_accounts_user_id_card_number_hash_key" ON "user_bank_accounts"("user_id", "card_number_hash");
CREATE INDEX "user_bank_accounts_user_id_idx" ON "user_bank_accounts"("user_id");

ALTER TABLE "user_bank_accounts"
  ADD CONSTRAINT "user_bank_accounts_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "user_payout_profiles" (
  "user_id" TEXT NOT NULL,
  "iban_hash" TEXT NOT NULL,
  "iban_ciphertext" TEXT NOT NULL,
  "account_name" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "user_payout_profiles_pkey" PRIMARY KEY ("user_id")
);

CREATE UNIQUE INDEX "user_payout_profiles_iban_hash_key" ON "user_payout_profiles"("iban_hash");

ALTER TABLE "user_payout_profiles"
  ADD CONSTRAINT "user_payout_profiles_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "user_addresses" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "label" TEXT,
  "postal_code" TEXT NOT NULL,
  "full_address" TEXT,
  "province" TEXT,
  "city" TEXT,
  "district" TEXT,
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "user_addresses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "user_addresses_user_id_idx" ON "user_addresses"("user_id");
CREATE INDEX "user_addresses_postal_code_idx" ON "user_addresses"("postal_code");

ALTER TABLE "user_addresses"
  ADD CONSTRAINT "user_addresses_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "kyc_documents" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "file_url" TEXT NOT NULL,
  "status" "KycStatus" NOT NULL DEFAULT 'PENDING',
  "verified_by" TEXT,
  "verified_at" TIMESTAMP(3),
  "rejection_reason" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "kyc_documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "kyc_documents_user_id_idx" ON "kyc_documents"("user_id");

ALTER TABLE "kyc_documents"
  ADD CONSTRAINT "kyc_documents_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
