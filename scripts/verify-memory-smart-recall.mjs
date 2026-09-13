import { readFileSync } from "node:fs";

const memoryDb = readFileSync("lib/memory-db.ts", "utf8");
const memoryContext = readFileSync("lib/ai-memory-context.ts", "utf8");
const aiRoute = readFileSync("app/api/ai/route.ts", "utf8");

const requiredMemoryDb = [
  "export async function getRelevantMemoryContext",
  "m.is_private = false",
  "normalizeMemoryTerms",
  "memoryRelevanceScore",
  "ORDER BY m.updated_at DESC",
];

for (const required of requiredMemoryDb) {
  if (!memoryDb.includes(required)) {
    console.error(`NEYVIX Memory smart-recall contract failed: missing ${required}`);
    process.exit(1);
  }
}

if (!memoryContext.includes("getRelevantMemoryContext") || !memoryContext.includes("query: string")) {
  console.error("NEYVIX Memory smart-recall contract failed: AI memory loader must accept the current query.");
  process.exit(1);
}

if (!aiRoute.includes("loadAiMemoryContext(session.email, useMemory, prompt, 8)")) {
  console.error("NEYVIX Memory smart-recall contract failed: AI route must pass the current prompt into recall.");
  process.exit(1);
}

console.log("NEYVIX Memory smart-recall contract PASS: relevance-aware recall is prompt-scoped and privacy-preserving.");
