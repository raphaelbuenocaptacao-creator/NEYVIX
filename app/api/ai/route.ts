import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { readActiveSession } from "@/lib/session";
import { saveAiMessage } from "@/lib/db";
import { getProductAccess, upgradeRequiredPayload } from "@/lib/product-access";
import { isRateLimited, rateLimitBucket, recordRateLimitEvent } from "@/lib/rate-limit";
import { loadAiMemoryContext } from "@/lib/ai-memory-context";
import { listAiHistory } from "@/lib/ai-history";

const MAX_PROMPT_LENGTH = 4000;
const MAX_RESPONSE_LENGTH = 24000;
const TIMEOUT_MS = 45_000;

function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "Referrer-Policy": "no-referrer",
    },
  });
}

function getGatewayConfig() {
  const url = process.env.NEYVIX_AI_GATEWAY_URL?.trim();
  const secret = process.env.NEYVIX_AI_GATEWAY_SECRET?.trim();
  if (!url || !secret) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return null;
    return { url: parsed.toString(), secret };
  } catch {
    return null;
  }
}

function gatewayUserId(email: string) {
  return createHash("sha256").update(`neyvix-ai:${email.trim().toLowerCase()}`).digest("hex");
}

export async function GET() {
  const store = await cookies();
  const session = await readActiveSession(store.get(SESSION_COOKIE)?.value);
  if (!session) {
    return privateJson({ error: "Autenticação necessária ou conta inativa" }, 401);
  }

  const access = await getProductAccess(session.email, "ai");
  if (!access.allowed) {
    return privateJson(upgradeRequiredPayload("ai", "Start"), 403);
  }

  try {
    const messages = await listAiHistory(session.email, 40);
    return privateJson({ messages, count: messages.length });
  } catch (error) {
    console.warn("Unable to load NEYVIX AI history", error);
    return privateJson({ error: "Não foi possível carregar o histórico da NEYVIX AI" }, 503);
  }
}

export async function POST(request: Request) {
  const store = await cookies();
  const session = await readActiveSession(store.get(SESSION_COOKIE)?.value);

  if (!session) return privateJson({ error: "Autenticação necessária ou conta inativa" }, 401);

  const access = await getProductAccess(session.email, "ai");
  if (!access.allowed) {
    return privateJson(upgradeRequiredPayload("ai", "Start"), 403);
  }

  const aiBucket = rateLimitBucket(session.email);
  if (await isRateLimited("ai", aiBucket, 30, 10)) {
    return NextResponse.json(
      { error: "Muitas solicitações à NEYVIX AI em pouco tempo. Aguarde alguns minutos e tente novamente.", code: "rate_limited" },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store, max-age=0",
          "Referrer-Policy": "no-referrer",
          "Retry-After": "120",
        },
      },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return privateJson({ error: "Corpo JSON inválido" }, 400);
  }

  const prompt = typeof body === "object" && body !== null && "prompt" in body
    ? String((body as { prompt?: unknown }).prompt ?? "").trim()
    : "";
  const useMemory = typeof body === "object" && body !== null && "useMemory" in body
    ? (body as { useMemory?: unknown }).useMemory === true
    : false;

  if (!prompt) return privateJson({ error: "Digite uma solicitação" }, 400);
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return privateJson({ error: `A solicitação deve ter no máximo ${MAX_PROMPT_LENGTH} caracteres` }, 413);
  }

  const gateway = getGatewayConfig();
  if (!gateway) {
    return privateJson({ error: "O gateway seguro da NEYVIX AI não está configurado" }, 503);
  }

  await recordRateLimitEvent("ai", aiBucket);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    try { await saveAiMessage(session.email, "user", prompt); }
    catch (dbError) { console.warn("Unable to persist NEYVIX AI user message", dbError); }

    let memory: Array<{ key: string; category: string; value: string }> = [];
    try {
      memory = await loadAiMemoryContext(session.email, useMemory, 8);
    } catch (memoryError) {
      console.warn("Unable to load NEYVIX Memory context", memoryError);
    }

    const upstream = await fetch(gateway.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "text/plain, application/json",
        "Authorization": `Bearer ${gateway.secret}`,
      },
      body: JSON.stringify({ prompt, context: { product: "NEYVIX AI", user: gatewayUserId(session.email), memory } }),
      signal: controller.signal,
      cache: "no-store",
    });

    const text = await upstream.text();
    if (!upstream.ok) {
      console.error("NEYVIX AI gateway error", upstream.status);
      return privateJson({ error: "A NEYVIX AI está temporariamente indisponível" }, 502);
    }

    if (!text.trim()) {
      return privateJson({ error: "A NEYVIX AI retornou uma resposta vazia" }, 502);
    }
    if (text.length > MAX_RESPONSE_LENGTH) {
      console.error("NEYVIX AI gateway response exceeded limit", text.length);
      return privateJson({ error: "A resposta da NEYVIX AI excedeu o limite permitido" }, 502);
    }

    try { await saveAiMessage(session.email, "assistant", text); }
    catch (dbError) { console.warn("Unable to persist NEYVIX AI assistant message", dbError); }

    return privateJson({ answer: text, memoryUsed: memory.length });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError";
    return privateJson({ error: timedOut ? "A solicitação da IA excedeu o tempo limite" : "Não foi possível conectar à NEYVIX AI" }, timedOut ? 504 : 502);
  } finally {
    clearTimeout(timeout);
  }
}
