CREATE TABLE "match_suggestions" (
    "id" TEXT NOT NULL,
    "shipment_id" TEXT NOT NULL,
    "trip_id" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "factors" JSONB NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUGGESTED',
    "suggested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "match_suggestions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "match_suggestions_shipment_id_trip_id_key" ON "match_suggestions"("shipment_id", "trip_id");
CREATE INDEX "match_suggestions_shipment_id_status_score_idx" ON "match_suggestions"("shipment_id", "status", "score");
CREATE INDEX "match_suggestions_trip_id_status_score_idx" ON "match_suggestions"("trip_id", "status", "score");
CREATE INDEX "match_suggestions_status_suggested_at_idx" ON "match_suggestions"("status", "suggested_at");

ALTER TABLE "match_suggestions"
ADD CONSTRAINT "match_suggestions_shipment_id_fkey"
FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "match_suggestions"
ADD CONSTRAINT "match_suggestions_trip_id_fkey"
FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;
