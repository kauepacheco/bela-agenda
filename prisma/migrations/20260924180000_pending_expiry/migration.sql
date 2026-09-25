ALTER TABLE "Appointment" ADD COLUMN "pendingExpiresAt" TIMESTAMP(3);
UPDATE "Appointment" SET "pendingExpiresAt" = LEAST("startsAt", "createdAt" + INTERVAL '24 hours') WHERE "status" = 'PENDING';
CREATE INDEX "Appointment_status_pendingExpiresAt_idx" ON "Appointment"("status", "pendingExpiresAt");
