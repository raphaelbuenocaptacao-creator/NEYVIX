import fs from "node:fs";

const route = fs.readFileSync("app/api/ai/route.ts", "utf8");
const health = fs.readFileSync("app/api/health/intelligence/route.ts", "utf8");
const memory = fs.readFileSync("lib/memory-db.ts", "utf8");
const aiMemoryContext = fs.readFileSync("lib/ai-memory-context.ts", "utf8");
const workspace = fs.readFileSync("app/ai/page.tsx", "utf8");

const checks = [
  ["gateway requires HTTPS", route.includes('parsed.protocol !== "https:"')],
  ["gateway secret is mandatory", route.includes("if (!url || !secret) return null")],
  ["gateway always authenticates upstream", route.includes('"Authorization": `Bearer ${gateway!.secret}`')],
  ["private AI responses disable caching", route.includes('"Cache-Control": "no-store, max-age=0"')],
  ["AI responses suppress referrer leakage", route.includes('"Referrer-Policy": "no-referrer"')],
  ["gateway errors do not log upstream body", route.includes('console.error("NEYVIX AI gateway error", upstream.status);') && !route.includes("text.slice(0, 500)")],
  ["gateway JSON contract only accepts an answer field", route.includes('contentType.includes("application/json")') && route.includes('!("answer" in payload)') && route.includes("typeof answer === \"string\" && answer.trim()")],
  ["unsupported gateway response types fail closed", route.includes('contentType && !contentType.startsWith("text/plain")') && route.includes('gateway returned an invalid response contract')],
  ["only normalized gateway answer is persisted", route.includes("saveAiExchange(session.email, prompt, answer)") && !route.includes("saveAiExchange(session.email, prompt, text)")],
  ["health readiness requires URL and secret", health.includes("gatewayConfigured = gatewayUrlConfigured && gatewaySecretConfigured")],
  ["health never claims provider verification from configuration alone", health.includes('providerReachability: "not_probed"') && health.includes("providerVerified: false") && health.includes("operational: false")],
  ["health uses configured-unverified until a provider is actually proven", health.includes('configured ? "configured_unverified"') && health.includes('readinessEvidence: "configuration_and_schema_only"')],
  ["memory context request is explicit opt-in", route.includes('(body as { useMemory?: unknown }).useMemory === true') && route.includes("loadAiMemoryContext(session.email, useMemory, 8)")],
  ["requested memory failure aborts generation instead of silently dropping context", route.includes("if (useMemory)") && route.includes('code: "memory_context_unavailable"') && route.includes("A solicitação não foi enviada sem o contexto solicitado")],
  ["memory context feature gate is explicit opt-in", aiMemoryContext.includes('process.env.NEYVIX_MEMORY_AI_CONTEXT === "true"') && aiMemoryContext.includes("if (!useMemory || !isAiMemoryContextEnabled()) return [];")],
  ["AI memory excludes private records", memory.includes("AND m.is_private = false")],
  ["AI memory is scoped to the active user", memory.includes("WHERE lower(u.email) = ${email.trim().toLowerCase()}") && memory.includes("AND u.is_active = true")],
  ["workspace starts in checking state", workspace.includes('useState<IntelligenceStatus>("checking")')],
  ["workspace allows configured gateway to perform first real verification", workspace.includes('intelligenceStatus === "configured_unverified" || intelligenceStatus === "ready"') && workspace.includes('data.status === "configured_unverified"')],
  ["workspace only marks provider verified after a successful answer", workspace.includes('setIntelligenceStatus("ready");') && workspace.includes("if (!response.ok || !data.answer) throw new Error")],
  ["workspace validates intelligence health without cache", workspace.includes('fetch("/api/health/intelligence", { cache: "no-store" })')],
  ["workspace blocks direct submit while configuration is unavailable", workspace.includes("if (generationUnavailable)") && workspace.includes("disabled={loading || historyLoading || generationUnavailable || !prompt.trim()}")],
];

let failed = false;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
  if (!ok) failed = true;
}

if (failed) process.exit(1);
console.log(`NEYVIX intelligence contract: ${checks.length}/${checks.length} PASS`);
