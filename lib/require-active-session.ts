import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE } from "@/lib/auth";
import { readActiveSession } from "@/lib/session";

export async function requireActiveSession(returnTo: string) {
  const store = await cookies();
  const session = await readActiveSession(store.get(SESSION_COOKIE)?.value);
  if (!session) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  return session;
}
