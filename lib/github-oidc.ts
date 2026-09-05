import { createPublicKey, verify } from "node:crypto";

const GITHUB_OIDC_ISSUER = "https://token.actions.githubusercontent.com";
const GITHUB_OIDC_JWKS = `${GITHUB_OIDC_ISSUER}/.well-known/jwks`;
const EXPECTED_REPOSITORY = "raphaelbuenocaptacao-creator/NEYVIX";
const EXPECTED_REF = "refs/heads/main";
const EXPECTED_WORKFLOW_REF = `${EXPECTED_REPOSITORY}/.github/workflows/business-positive-e2e-smoke.yml@${EXPECTED_REF}`;
const JWKS_TTL_MS = 10 * 60 * 1000;

type JwtHeader = { alg?: unknown; kid?: unknown; typ?: unknown };
type JwtClaims = {
  iss?: unknown;
  aud?: unknown;
  exp?: unknown;
  nbf?: unknown;
  repository?: unknown;
  ref?: unknown;
  workflow_ref?: unknown;
  event_name?: unknown;
};
type Jwk = JsonWebKey & { kid?: string; alg?: string; use?: string };

let cachedKeys: { expiresAt: number; keys: Jwk[] } | null = null;

function decodeJsonPart<T>(part: string): T | null {
  try {
    return JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

function audienceIncludesVercel(aud: unknown) {
  return aud === "vercel" || (Array.isArray(aud) && aud.includes("vercel"));
}

async function getSigningKeys() {
  const now = Date.now();
  if (cachedKeys && cachedKeys.expiresAt > now) return cachedKeys.keys;

  const response = await fetch(GITHUB_OIDC_JWKS, {
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error("github_oidc_jwks_unavailable");

  const body = (await response.json()) as { keys?: unknown };
  const keys = Array.isArray(body.keys) ? (body.keys as Jwk[]) : [];
  if (keys.length === 0) throw new Error("github_oidc_jwks_empty");

  cachedKeys = { expiresAt: now + JWKS_TTL_MS, keys };
  return keys;
}

export async function verifyBusinessE2EOidc(token: string | null | undefined) {
  if (!token) return false;

  const parts = token.split(".");
  if (parts.length !== 3) return false;

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = decodeJsonPart<JwtHeader>(encodedHeader);
  const claims = decodeJsonPart<JwtClaims>(encodedPayload);
  if (!header || !claims || header.alg !== "RS256" || typeof header.kid !== "string") return false;

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (
    claims.iss !== GITHUB_OIDC_ISSUER ||
    !audienceIncludesVercel(claims.aud) ||
    typeof claims.exp !== "number" ||
    claims.exp <= nowSeconds ||
    (typeof claims.nbf === "number" && claims.nbf > nowSeconds + 30) ||
    claims.repository !== EXPECTED_REPOSITORY ||
    claims.ref !== EXPECTED_REF ||
    claims.workflow_ref !== EXPECTED_WORKFLOW_REF ||
    claims.event_name !== "deployment_status"
  ) {
    return false;
  }

  try {
    const keys = await getSigningKeys();
    const jwk = keys.find((key) => key.kid === header.kid && (!key.alg || key.alg === "RS256"));
    if (!jwk) return false;

    const publicKey = createPublicKey({ key: jwk, format: "jwk" });
    return verify(
      "RSA-SHA256",
      Buffer.from(`${encodedHeader}.${encodedPayload}`),
      publicKey,
      Buffer.from(encodedSignature, "base64url"),
    );
  } catch {
    return false;
  }
}
