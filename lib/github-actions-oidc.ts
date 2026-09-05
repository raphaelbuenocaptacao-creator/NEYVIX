const GITHUB_OIDC_ISSUER = "https://token.actions.githubusercontent.com";
const GITHUB_OIDC_JWKS = `${GITHUB_OIDC_ISSUER}/.well-known/jwks`;
const EXPECTED_REPOSITORY = "raphaelbuenocaptacao-creator/NEYVIX";
const EXPECTED_REF = "refs/heads/main";
const EXPECTED_WORKFLOW_PATH = `${EXPECTED_REPOSITORY}/.github/workflows/business-positive-e2e-smoke.yml`;
const EXPECTED_WORKFLOW_REF = `${EXPECTED_WORKFLOW_PATH}@${EXPECTED_REF}`;
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
type WorkflowRefMatch = "main-ref" | "immutable-sha" | null;

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

function repositoryMatches(repository: unknown) {
  return typeof repository === "string" && repository.toLowerCase() === EXPECTED_REPOSITORY.toLowerCase();
}

function workflowRefMatch(workflowRef: unknown): WorkflowRefMatch {
  if (typeof workflowRef !== "string") return null;
  if (workflowRef.toLowerCase() === EXPECTED_WORKFLOW_REF.toLowerCase()) return "main-ref";

  const separator = workflowRef.lastIndexOf("@");
  if (separator <= 0) return null;
  const path = workflowRef.slice(0, separator);
  const revision = workflowRef.slice(separator + 1);

  // GitHub can represent workflow_ref using the immutable workflow commit SHA.
  // In that form we additionally require the separate signed ref claim to pin
  // the run to main. This prevents a SHA-only workflow identity from widening
  // authorization to another branch.
  if (path.toLowerCase() === EXPECTED_WORKFLOW_PATH.toLowerCase() && /^[0-9a-f]{40}$/i.test(revision)) {
    return "immutable-sha";
  }

  return null;
}

function claimsAreAllowed(claims: GitHubOidcClaims) {
  const now = Math.floor(Date.now() / 1000);
  const exp = typeof claims.exp === "number" ? claims.exp : 0;
  const nbf = typeof claims.nbf === "number" ? claims.nbf : 0;
  const iat = typeof claims.iat === "number" ? claims.iat : 0;
  const workflowMatch = workflowRefMatch(claims.workflow_ref);

  if (claims.iss !== GITHUB_OIDC_ISSUER || !audienceMatches(claims.aud)) return false;
  if (!repositoryMatches(claims.repository) || !workflowMatch) return false;
  if (claims.event_name !== "deployment_status") return false;

  // For deployment_status runs GitHub may omit the standalone ref claim. The
  // signed workflow_ref still pins the workflow itself to refs/heads/main. If
  // ref is present it must agree with main. If workflow_ref is SHA-based, ref
  // is mandatory so an immutable workflow revision cannot authorize another
  // branch by itself.
  if (workflowMatch === "main-ref") {
    if (claims.ref != null && claims.ref !== EXPECTED_REF) return false;
  } else if (claims.ref !== EXPECTED_REF) {
    return false;
  }

  if (!exp || !iat || exp < now - CLOCK_SKEW_SECONDS) return false;
  if (nbf && nbf > now + CLOCK_SKEW_SECONDS) return false;
  if (iat > now + CLOCK_SKEW_SECONDS || now - iat > MAX_TOKEN_AGE_SECONDS) return false;
  return true;
}

function findSigningKey(keys: Jwk[], kid: string) {
  return keys.find((key) => key.kid === kid && (!key.alg || key.alg === "RS256")) ?? null;
}

async function refreshSigningKeys(now = Date.now()) {
  const response = await fetch(GITHUB_OIDC_JWKS, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) return null;

  const document = (await response.json()) as JwksDocument;
  const keys = Array.isArray(document.keys) ? document.keys : [];
  if (!keys.length) return null;

  jwksCache = { keys, expiresAt: now + 5 * 60_000 };
  return keys;
}

async function getSigningKey(kid: string) {
  const now = Date.now();
  let refreshed = false;
  let keys: Jwk[] | null = null;

  if (jwksCache && jwksCache.expiresAt > now) {
    keys = jwksCache.keys;
  } else {
    keys = await refreshSigningKeys(now);
    refreshed = true;
  }

  if (!keys) return null;
  const cachedMatch = findSigningKey(keys, kid);
  if (cachedMatch) return cachedMatch;

  // A signer can rotate before our short cache expires. Refresh once on a kid
  // miss, but still fail closed unless the key is present in GitHub's official
  // JWKS and the JWT signature verifies below.
  if (!refreshed) {
    const freshKeys = await refreshSigningKeys();
    if (!freshKeys) return null;
    return findSigningKey(freshKeys, kid);
  }

  return null;
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
