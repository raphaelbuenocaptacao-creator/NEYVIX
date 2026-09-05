const GITHUB_OIDC_ISSUER = "https://token.actions.githubusercontent.com";
const GITHUB_OIDC_JWKS = `${GITHUB_OIDC_ISSUER}/.well-known/jwks`;
const EXPECTED_REPOSITORY = "raphaelbuenocaptacao-creator/NEYVIX";
const EXPECTED_REF = "refs/heads/main";
const EXPECTED_WORKFLOW_REF = `${EXPECTED_REPOSITORY}/.github/workflows/business-positive-e2e-smoke.yml@${EXPECTED_REF}`;
const EXPECTED_AUDIENCE = "vercel";
const MAX_TOKEN_AGE_SECONDS = 10 * 60;
const CLOCK_SKEW_SECONDS = 30;

type JwtHeader = {
  alg?: unknown;
  kid?: unknown;
  typ?: unknown;
};

type GitHubOidcClaims = {
  iss?: unknown;
  aud?: unknown;
  exp?: unknown;
  nbf?: unknown;
  iat?: unknown;
  repository?: unknown;
  ref?: unknown;
  workflow_ref?: unknown;
  event_name?: unknown;
};

type Jwk = JsonWebKey & { kid?: string; alg?: string; use?: string };

type JwksDocument = { keys?: Jwk[] };

let jwksCache: { expiresAt: number; keys: Jwk[] } | null = null;

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + padding, "base64");
}

function parseJsonSegment<T>(segment: string): T | null {
  try {
    return JSON.parse(decodeBase64Url(segment).toString("utf8")) as T;
  } catch {
    return null;
  }
}

function audienceMatches(aud: unknown) {
  if (typeof aud === "string") return aud === EXPECTED_AUDIENCE;
  return Array.isArray(aud) && aud.some((value) => value === EXPECTED_AUDIENCE);
}

function claimsAreAllowed(claims: GitHubOidcClaims) {
  const now = Math.floor(Date.now() / 1000);
  const exp = typeof claims.exp === "number" ? claims.exp : 0;
  const nbf = typeof claims.nbf === "number" ? claims.nbf : 0;
  const iat = typeof claims.iat === "number" ? claims.iat : 0;

  if (claims.iss !== GITHUB_OIDC_ISSUER || !audienceMatches(claims.aud)) return false;
  if (claims.repository !== EXPECTED_REPOSITORY || claims.ref !== EXPECTED_REF) return false;
  if (claims.workflow_ref !== EXPECTED_WORKFLOW_REF || claims.event_name !== "deployment_status") return false;
  if (!exp || !iat || exp < now - CLOCK_SKEW_SECONDS) return false;
  if (nbf && nbf > now + CLOCK_SKEW_SECONDS) return false;
  if (iat > now + CLOCK_SKEW_SECONDS || now - iat > MAX_TOKEN_AGE_SECONDS) return false;
  return true;
}

async function getSigningKey(kid: string) {
  const now = Date.now();
  if (!jwksCache || jwksCache.expiresAt <= now) {
    const response = await fetch(GITHUB_OIDC_JWKS, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return null;
    const document = (await response.json()) as JwksDocument;
    const keys = Array.isArray(document.keys) ? document.keys : [];
    jwksCache = { keys, expiresAt: now + 5 * 60_000 };
  }

  return jwksCache.keys.find((key) => key.kid === kid && (!key.alg || key.alg === "RS256")) ?? null;
}

export async function hasValidGitHubActionsOidc(request: Request) {
  const token = request.headers.get("x-neyvix-github-oidc")?.trim() ?? "";
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((part) => !part)) return false;

  const header = parseJsonSegment<JwtHeader>(parts[0]);
  const claims = parseJsonSegment<GitHubOidcClaims>(parts[1]);
  if (!header || !claims || header.alg !== "RS256" || typeof header.kid !== "string" || !claimsAreAllowed(claims)) {
    return false;
  }

  try {
    const jwk = await getSigningKey(header.kid);
    if (!jwk) return false;
    const key = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    return await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      decodeBase64Url(parts[2]),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
    );
  } catch {
    return false;
  }
}
