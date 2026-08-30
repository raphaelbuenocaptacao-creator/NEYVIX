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

    if (Number.isFinite(session.securityEpochMs)) {
      if (session.securityEpochMs !== securityEpoch) return null;
      return { ...session, isSuperadmin: account.isSuperadmin };
    }

    // Compatibility path for sessions created before database epoch binding.
    if (process.env.NODE_ENV === "production" && !session.iatMs) return null;
    const issuedAt = session.iatMs ?? session.iat * 1000;
    if (issuedAt < securityEpoch) return null;

    return { ...session, isSuperadmin: account.isSuperadmin };
  } catch (error) {
    console.error("NEYVIX session account verification failed", error);
    return null;
  }
}
