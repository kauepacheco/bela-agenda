import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/onboarding-form";
import { requireAuthContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const context = await requireAuthContext({ allowIncompleteOnboarding: true });
  if (context.business.onboardingCompletedAt) redirect("/");

  return <OnboardingForm
    canManage={context.role === "OWNER"}
    business={{
      name: context.business.name,
      address: context.business.address ?? "",
      city: context.business.city,
      phone: context.business.phone ?? "",
    }}
    userName={context.user.name}
  />;
}
