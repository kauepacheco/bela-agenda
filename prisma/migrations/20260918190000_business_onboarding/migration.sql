ALTER TABLE "Business" ADD COLUMN "onboardingCompletedAt" TIMESTAMP(3);

-- Contas anteriores a este fluxo já estavam operacionais e não devem ser bloqueadas.
UPDATE "Business" SET "onboardingCompletedAt" = CURRENT_TIMESTAMP;
