ALTER TABLE "Professional" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Service" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Client" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true, ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Appointment" ADD COLUMN "serviceName" TEXT, ADD COLUMN "priceCents" INTEGER, ADD COLUMN "durationMin" INTEGER, ADD COLUMN "priceEstimated" BOOLEAN NOT NULL DEFAULT false;
-- Historical prices were not recorded. Mark the catalog-derived backfill explicitly.
UPDATE "Appointment" a SET "serviceName" = s."name", "priceCents" = s."priceCents", "durationMin" = GREATEST(1, ROUND(EXTRACT(EPOCH FROM (a."endsAt" - a."startsAt"))/60)::integer), "priceEstimated" = true FROM "Service" s WHERE s.id = a."serviceId";
ALTER TABLE "Appointment" ALTER COLUMN "serviceName" SET NOT NULL, ALTER COLUMN "priceCents" SET NOT NULL, ALTER COLUMN "durationMin" SET NOT NULL;
