import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { getDatabaseUserByEmail, getRecentActivity, getTrialStatus } from "@/lib/db";
import { listAiHistory } from "@/lib/ai-history";
import { readActiveSession } from "@/lib/session";

function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET() {
  const store = await cookies();
  const session = await readActiveSession(store.get(SESSION_COOKIE)?.value);
  if (!session) {
    return privateJson({ error: "Autenticação necessária ou conta inativa" }, 401);
  }

  try {
    // Identity is the hard requirement. Cross-module timeline sources are intentionally
    // soft dependencies so a partial module/schema cannot take User 360 offline.
    const user = await getDatabaseUserByEmail(session.email);
    if (!user || !user.is_active) {
      return privateJson({ error: "Identidade NEYVIX indisponível" }, 404);
    }

    const [subscriptionResult, activityResult, aiResult] = await Promise.allSettled([
      getTrialStatus(session.email),
      getRecentActivity(session.email, 12),
      listAiHistory(session.email, 12),
    ]);

    const subscription = subscriptionResult.status === "fulfilled" ? subscriptionResult.value : null;
    const recentActivity = activityResult.status === "fulfilled" ? activityResult.value : [];
    const recentAi = aiResult.status === "fulfilled" ? aiResult.value : [];
    const degradedSources = [
      subscriptionResult.status === "rejected" ? "subscription" : null,
      activityResult.status === "rejected" ? "activity" : null,
      aiResult.status === "rejected" ? "ai" : null,
    ].filter((source): source is string => Boolean(source));

    if (degradedSources.length > 0) {
      console.warn("NEYVIX User 360 loaded with degraded sources", degradedSources);
    }

    return privateJson({
      scope: "self",
      identity: {
        id: user.id,
        name: user.name || user.email.split("@")[0],
        email: user.email,
        active: user.is_active,
        createdAt: user.created_at,
      },
      subscription: subscription
        ? {
            status: String((subscription as Record<string, unknown>).status ?? ""),
            trialStartedAt: (subscription as Record<string, unknown>).trial_started_at ?? null,
            trialEndsAt: (subscription as Record<string, unknown>).trial_ends_at ?? null,
            project: (subscription as Record<string, unknown>).project_slug ?? "neyvix",
          }
        : null,
      recentActivity,
      recentAi,
      health: {
        degraded: degradedSources.length > 0,
        unavailableSources: degradedSources,
      },
    });
  } catch (error) {
    console.warn("Unable to load NEYVIX User 360 self view", error);
    return privateJson({ error: "Não foi possível carregar seu NEYVIX User 360" }, 503);
  }
}
