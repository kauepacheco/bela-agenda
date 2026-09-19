import { InvitationForm } from "@/components/invitation-form";
import { getMemberInvitation } from "@/lib/team-service";

export const dynamic = "force-dynamic";

export default async function AcceptInvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const rawToken = (await searchParams).token;
  const token = typeof rawToken === "string" ? rawToken : "";
  const invitation = await getMemberInvitation(token);
  return <InvitationForm token={token} invitation={invitation} />;
}
