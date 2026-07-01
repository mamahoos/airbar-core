-- N2 Auth: extend users table and add sessions, otps, activity_logs.

-- Drop placeholder users without phone (N0 smoke rows only; fresh rewrite).
DELETE FROM "users";

CREATE TYPE "UserRole" AS ENUM ('USER', 'CARRIER', 'ADMIN', 'SUPER_ADMIN');
CREATE TYPE "KycLevel" AS ENUM (
  'NONE',
  'MOBILE_VERIFIED',
  'IDENTITY_VERIFIED',
  'DOCUMENT_VERIFIED',
  'FACE_VERIFIED',
  'FULLY_VERIFIED'
);

ALTER TABLE "users"
  ADD COLUMN "phone" TEXT NOT NULL,
  ADD COLUMN "email" TEXT,
  ADD COLUMN "password_hash" TEXT,
  ADD COLUMN "first_name" TEXT,
  ADD COLUMN "last_name" TEXT,
  ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'USER',
  ADD COLUMN "kyc_level" "KycLevel" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "is_banned" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "ban_reason" TEXT,
  ADD COLUMN "last_login_at" TIMESTAMP(3),
  ADD COLUMN "last_login_ip" TEXT;

CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

CREATE TABLE "sessions" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "device_info" JSONB,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

ALTER TABLE "sessions"
  ADD CONSTRAINT "sessions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "otps" (
  "id" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "verified" BOOLEAN NOT NULL DEFAULT false,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "otps_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "otps_phone_code_idx" ON "otps"("phone", "code");

CREATE TABLE "activity_logs" (
  "id" TEXT NOT NULL,
  "user_id" TEXT,
  "action" TEXT NOT NULL,
  "resource" TEXT NOT NULL,
  "resource_id" TEXT,
  "details" JSONB,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "activity_logs_user_id_idx" ON "activity_logs"("user_id");
CREATE INDEX "activity_logs_action_idx" ON "activity_logs"("action");
CREATE INDEX "activity_logs_resource_idx" ON "activity_logs"("resource");
CREATE INDEX "activity_logs_created_at_idx" ON "activity_logs"("created_at");

ALTER TABLE "activity_logs"
  ADD CONSTRAINT "activity_logs_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
