import { getMemoryContext } from "@/lib/memory-db";

export type AiMemoryContextItem = {
  key: string;
  category: string;
  value: string;
};

const DEFAULT_MEMORY_LIMIT = 8;
const MAX_MEMORY_VALUE_LENGTH = 800;

export function isAiMemoryContextEnabled() {
  return process.env.NEYVIX_MEMORY_AI_CONTEXT === "true";
}

export async function loadAiMemoryContext(
  email: string,
  useMemory: boolean,
  limit = DEFAULT_MEMORY_LIMIT,
): Promise<AiMemoryContextItem[]> {
  if (!useMemory || !isAiMemoryContextEnabled()) return [];

  const recalled = await getMemoryContext(email, limit);
  return recalled.map((item) => ({
    key: item.key,
    category: item.category,
    value: item.value.slice(0, MAX_MEMORY_VALUE_LENGTH),
  }));
}
