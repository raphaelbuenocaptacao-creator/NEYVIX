import { readSession, type SessionRecord } from "@/lib/auth";
import { getDatabaseUserByEmail, hasDatabase } from "@/lib/db";

export type ActiveSession = SessionRecord & {
  isSuperadmin: boolean;
};

export async function readActiveSession(token?: string | null): Promise<ActiveSession | null> {
  const session = readSession(token);
  if (!session) return null;

  if (!hasDatabase()) {
    if (process.env.NODE_ENV === "production") return null;
    return { ...session, isSuperadmin: false };
  }

  try {
    const account = await getDatabaseUserByEmail(session.email);
    if (!account?.is_active) return null;
    return { ...session, isSuperadmin: Boolean(account.is_superadmin) };
  } catch (error) {
    console.error("NEYVIX session account verification failed", error);
    return null;
  }
}
