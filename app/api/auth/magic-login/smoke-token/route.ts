import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { readActiveSession } from "@/lib/session";
import { isSmokeAccountEmail } from "@/lib/smoke-user-db";

const MAGIC_LOGIN_TOKEN_NAMESPACE = "neyvix:magic-login:v1:";
const MAGIC_LOGIN_TTL_MINUTES = 5;
const PRIVATE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "Pragma": "no-cache",
  "Referrer-Policy": "no-referrer",
};

function getSql() {
  const url = process.env.DATABASE_URL?.trim();
  return url ? neon(url) : null;
}

function hashMagicLoginToken(token: string) {
  return createHash("sha256").update(`${MAGIC_LOGIN_TOKEN_NAMESPACE}${token}`).digest("hex");
}

export async function POST() {
  const store = await cookies();
  const session = await readActiveSession(store.get(SESSION_COOKIE)?.value);

  if (!session) {
    return NextResponse.json({ error: "Autenticação necessária" }, { status: 401, headers: PRIVATE_HEADERS });
  }

  // This endpoint exists only to prove the positive magic-login lifecycle in
  // production without sending an external email. It can never mint a token
  // for another account and is restricted to the disposable smoke namespace.
  if (!isSmokeAccountEmail(session.email)) {
    return NextResponse.json({ error: "Endpoint restrito a contas efêmeras de smoke" }, { status: 403, headers: PRIVATE_HEADERS });
  }

  const sql = getSql();
  if (!sql) {
    return NextResponse.json({ error: "Banco indisponível" }, { status: 503, headers: PRIVATE_HEADERS });
  }

  try {
    const users = await sql`
      SELECT id
      FROM public.users
      WHERE lower(email) = ${session.email.trim().toLowerCase()}
        AND is_active = true
        AND is_superadmin = false
      LIMIT 1
    ` as Array<{ id: string }>;

    const user = users[0];
    if (!user) {
      return NextResponse.json({ error: "Conta de smoke indisponível" }, { status: 409, headers: PRIVATE_HEADERS });
    }

    const token = randomBytes(32).toString("base64url");
    const tokenHash = hashMagicLoginToken(token);

    await sql`
      INSERT INTO public.password_reset_tokens (user_id, token_hash, expires_at)
      VALUES (${user.id}, ${tokenHash}, now() + (${MAGIC_LOGIN_TTL_MINUTES} || ' minutes')::interval)
    `;

    return NextResponse.json(
      { ok: true, token, expiresInSeconds: MAGIC_LOGIN_TTL_MINUTES * 60 },
      { headers: PRIVATE_HEADERS },
    );
  } catch (error) {
    console.error("NEYVIX magic-login smoke token issue failed", error);
    return NextResponse.json({ error: "Falha ao emitir token técnico" }, { status: 503, headers: PRIVATE_HEADERS });
  }
}
