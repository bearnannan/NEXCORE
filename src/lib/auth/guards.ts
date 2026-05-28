import { getSafeSession } from "@/lib/auth/session";

export async function requireOperatorSession() {
  const { session } = await getSafeSession();

  if (!session?.user || session.user.role !== "operations_operator") {
    return null;
  }

  return session;
}
