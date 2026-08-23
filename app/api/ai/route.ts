import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, readSession } from "@/lib/auth";
import { saveAiMessage } from "@/lib/db";

const MAX_PROMPT_LENGTH = 4000;
const MAX_RESPONSE_LENGTH = 24000;
const TIMEOUT_MS = 45_000;

function getGatewayUrl() {
  const url = process.env.NEYVIX_AI_GATEWAY_URL?.trim();
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const store = await cookies();
  let session;

  try {
    session = readSession(store.get(SESSION_COOKIE)?.value);
  } catch {
    session = null;
  }

  if (!session) return NextResponse.json({ error: "Autenticação necessária" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo JSON inválido" }, { status: 400 });
  }

  const prompt = typeof body === "object" && body !== null && "prompt" in body
    ? String((body as { prompt?: unknown }).prompt ?? "").trim()
    : "";

  if (!prompt) return NextResponse.json({ error: "Digite uma solicitação" }, { status: 400 });
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return NextResponse.json({ error: `A solicitação deve ter no máximo ${MAX_PROMPT_LENGTH} caracteres` }, { status: 413 });
  }

  const gatewayUrl = getGatewayUrl();
  if (!gatewayUrl) return NextResponse.json({ error: "O gateway da NEYVIX AI não está configurado" }, { status: 503 });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const gatewaySecret = process.env.NEYVIX_AI_GATEWAY_SECRET?.trim();

  try {
    try { await saveAiMessage(session.email, "user", prompt); }
    catch (dbError) { console.warn("Unable to persist NEYVIX AI user message", dbError); }

    const upstream = await fetch(gatewayUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "text/plain, application/json",
        ...(gatewaySecret ? { "Authorization": `Bearer ${gatewaySecret}` } : {}),
      },
      body: JSON.stringify({ prompt, context: { product: "NEYVIX AI", user: session.email } }),
      signal: controller.signal,
      cache: "no-store",
    });

    const text = await upstream.text();
    if (!upstream.ok) {
      console.error("NEYVIX AI gateway error", upstream.status, text.slice(0, 500));
      return NextResponse.json({ error: "A NEYVIX AI está temporariamente indisponível" }, { status: 502 });
    }

    if (!text.trim()) {
      return NextResponse.json({ error: "A NEYVIX AI retornou uma resposta vazia" }, { status: 502 });
    }
    if (text.length > MAX_RESPONSE_LENGTH) {
      console.error("NEYVIX AI gateway response exceeded limit", text.length);
      return NextResponse.json({ error: "A resposta da NEYVIX AI excedeu o limite permitido" }, { status: 502 });
    }

    try { await saveAiMessage(session.email, "assistant", text); }
    catch (dbError) { console.warn("Unable to persist NEYVIX AI assistant message", dbError); }

    return NextResponse.json({ answer: text }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError";
    return NextResponse.json({ error: timedOut ? "A solicitação da IA excedeu o tempo limite" : "Não foi possível conectar à NEYVIX AI" }, { status: timedOut ? 504 : 502 });
  } finally {
    clearTimeout(timeout);
  }
}
