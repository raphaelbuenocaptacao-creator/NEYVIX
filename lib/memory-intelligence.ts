export type MemorySuggestion = {
  key: string;
  category: string;
  value: string;
  confidence: number;
  sensitive: boolean;
  reason: string;
};

const SENSITIVE_PATTERNS = [
  /senha/i, /password/i, /token/i, /secret/i, /cart[aã]o/i, /cvv/i,
  /cpf/i, /rg\b/i, /cnpj/i, /conta banc[aá]ria/i, /chave pix/i,
  /diagn[oó]stico/i, /medicamento/i, /sa[uú]de/i,
];

function normalizeValue(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 1000);
}

function isSensitive(value: string) {
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(value));
}

export function suggestMemoriesFromText(text: string): MemorySuggestion[] {
  const source = normalizeValue(text);
  if (!source) return [];

  const suggestions: MemorySuggestion[] = [];
  const patterns: Array<{ regex: RegExp; key: string; category: string; confidence: number; reason: string }> = [
    { regex: /(?:minha empresa|minha marca|meu neg[oó]cio) (?:se chama|é) ([^.!?\n]{2,100})/i, key: "business.name", category: "business", confidence: 0.94, reason: "Nome de negócio declarado pelo usuário" },
    { regex: /(?:eu moro|moro|minha cidade é) (?:em )?([^.!?\n]{2,100})/i, key: "profile.city", category: "profile", confidence: 0.88, reason: "Cidade declarada pelo usuário" },
    { regex: /(?:eu prefiro|prefiro) ([^.!?\n]{2,180})/i, key: "preference.general", category: "preference", confidence: 0.82, reason: "Preferência explícita declarada pelo usuário" },
    { regex: /(?:meu objetivo|meu foco) (?:é|e) ([^.!?\n]{2,220})/i, key: "goal.primary", category: "goal", confidence: 0.84, reason: "Objetivo explícito declarado pelo usuário" },
  ];

  for (const pattern of patterns) {
    const match = source.match(pattern.regex);
    if (!match?.[1]) continue;
    const value = normalizeValue(match[1]);
    if (!value) continue;
    suggestions.push({
      key: pattern.key,
      category: pattern.category,
      value,
      confidence: pattern.confidence,
      sensitive: isSensitive(value),
      reason: pattern.reason,
    });
  }

  return suggestions.slice(0, 5);
}
