ALTER TABLE "kyc_documents"
  ADD COLUMN "assigned_to" TEXT,
  ADD COLUMN "assigned_at" TIMESTAMP(3),
  ADD COLUMN "review_reason_code" TEXT,
  ADD COLUMN "review_note" TEXT;

CREATE INDEX "kyc_documents_status_assigned_to_idx" ON "kyc_documents"("status", "assigned_to");
