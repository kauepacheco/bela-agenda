import { ResetPasswordForm } from "@/components/password-reset-form";
import { isPasswordResetTokenValid } from "@/lib/auth-service";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const rawToken = (await searchParams).token;
  const token = typeof rawToken === "string" ? rawToken : "";
  const valid = await isPasswordResetTokenValid(token);

  return <ResetPasswordForm token={token} valid={valid} />;
}
