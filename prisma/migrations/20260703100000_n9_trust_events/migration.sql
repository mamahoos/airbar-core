CREATE TABLE "trust_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "shipment_id" TEXT,
    "chat_id" TEXT,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trust_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "trust_events_user_id_idx" ON "trust_events"("user_id");
CREATE INDEX "trust_events_shipment_id_idx" ON "trust_events"("shipment_id");
CREATE INDEX "trust_events_chat_id_idx" ON "trust_events"("chat_id");
CREATE INDEX "trust_events_type_created_at_idx" ON "trust_events"("type", "created_at");

ALTER TABLE "trust_events"
ADD CONSTRAINT "trust_events_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
