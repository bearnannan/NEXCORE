import { redirect } from "next/navigation";
import { MissionControlDashboard } from "@/components/mission-control/mission-control-dashboard";
import { getSafeSession, resetSessionUrl } from "@/lib/auth/session";

export default async function MissionControlPage() {
  const { session, hasInvalidSessionToken } = await getSafeSession();

  if (hasInvalidSessionToken) {
    redirect(resetSessionUrl("/sign-in"));
  }

  if (!session?.user) {
    redirect("/sign-in");
  }

  return (
    <MissionControlDashboard operatorName={session.user.name ?? "Operator"} />
  );
}
