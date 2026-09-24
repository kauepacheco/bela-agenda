ALTER TABLE "Business" ADD COLUMN "bookingSettings" JSONB;

CREATE TABLE "AppointmentEvent" (
  "id" TEXT NOT NULL,
  "appointmentId" TEXT NOT NULL,
  "actorId" TEXT,
  "action" TEXT NOT NULL,
  "details" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AppointmentEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AppointmentEvent_appointmentId_createdAt_idx" ON "AppointmentEvent"("appointmentId", "createdAt");
ALTER TABLE "AppointmentEvent" ADD CONSTRAINT "AppointmentEvent_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
