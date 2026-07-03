ALTER TABLE "trust_events"
  ADD COLUMN "review_status" TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "reviewed_by" TEXT,
  ADD COLUMN "reviewed_at" TIMESTAMP(3),
  ADD COLUMN "review_note" TEXT;

CREATE INDEX "trust_events_review_status_created_at_idx" ON "trust_events"("review_status", "created_at");
