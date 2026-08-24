import { readSession, type SessionRecord } from "@/lib/auth";
import { hasDatabase } from "@/lib/db";
import { getAccountSecurityState } from "@/lib/account-state";

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
    const account = await getAccountSecurityState(session.email);
    if (!account?.isActive) return null;

    const securityEpoch = new Date(account.updatedAt).getTime();
    if (!Number.isFinite(securityEpoch)) return null;

    // Production sessions created before this hardening release do not carry
    // millisecond precision. Requiring iatMs forces a clean re-authentication
    // and guarantees password changes can revoke older sessions deterministically.
    if (process.env.NODE_ENV === "production" && !session.iatMs) return null;
    const issuedAt = session.iatMs ?? session.iat * 1000;
    if (issuedAt < securityEpoch) return null;

    return { ...session, isSuperadmin: account.isSuperadmin };
  } catch (error) {
    console.error("NEYVIX session account verification failed", error);
    return null;
  }
}
