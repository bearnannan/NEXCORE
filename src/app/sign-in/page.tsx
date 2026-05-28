import { redirect } from "next/navigation";
import { SignInForm } from "@/components/auth/sign-in-form";
import { getSafeSession, resetSessionUrl } from "@/lib/auth/session";

export default async function SignInPage() {
  const { session, hasInvalidSessionToken } = await getSafeSession();

  if (hasInvalidSessionToken) {
    redirect(resetSessionUrl("/sign-in"));
  }

  if (session?.user) {
    redirect("/mission-control");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,rgb(45_212_191_/_0.16),transparent_36%),linear-gradient(135deg,#111827,#0f172a_45%,#111827)] px-4">
      <SignInForm />
    </main>
  );
}
