CREATE TABLE "MembershipInvitation" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "invitedByMembershipId" TEXT,
    "email" TEXT NOT NULL,
    "role" "MembershipRole" NOT NULL DEFAULT 'EMPLOYEE',
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MembershipInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MembershipInvitation_tokenHash_key" ON "MembershipInvitation"("tokenHash");
CREATE INDEX "MembershipInvitation_businessId_email_idx" ON "MembershipInvitation"("businessId", "email");
CREATE INDEX "MembershipInvitation_expiresAt_idx" ON "MembershipInvitation"("expiresAt");

ALTER TABLE "MembershipInvitation" ADD CONSTRAINT "MembershipInvitation_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MembershipInvitation" ADD CONSTRAINT "MembershipInvitation_invitedByMembershipId_fkey"
  FOREIGN KEY ("invitedByMembershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;
