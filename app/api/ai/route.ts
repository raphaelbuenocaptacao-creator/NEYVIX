import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, readSession } from "@/lib/auth";
import { saveAiMessage } from "@/lib/db";

const MAX_PROMPT_LENGTH = 4000;
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

  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const prompt =
    typeof body === "object" && body !== null && "prompt" in body
      ? String((body as { prompt?: unknown }).prompt ?? "").trim()
      : "";

  if (!prompt) {
    return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
  }

  if (prompt.length > MAX_PROMPT_LENGTH) {
    return NextResponse.json(
      { error: `Prompt must be ${MAX_PROMPT_LENGTH} characters or fewer` },
      { status: 413 },
    );
  }

  const gatewayUrl = getGatewayUrl();
  if (!gatewayUrl) {
    return NextResponse.json(
      { error: "NEYVIX AI gateway is not configured" },
      { status: 503 },
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    try {
      await saveAiMessage(session.email, "user", prompt);
    } catch (dbError) {
      console.warn("Unable to persist NEYVIX AI user message", dbError);
    }

    const upstream = await fetch(gatewayUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        context: {
          product: "NEYVIX AI",
          user: session.email,
        },
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    const text = await upstream.text();

    if (!upstream.ok) {
      console.error("NEYVIX AI gateway error", upstream.status, text.slice(0, 500));
      return NextResponse.json(
        { error: "AI service is temporarily unavailable" },
        { status: 502 },
      );
    }

    try {
      await saveAiMessage(session.email, "assistant", text);
    } catch (dbError) {
      console.warn("Unable to persist NEYVIX AI assistant message", dbError);
    }

    return NextResponse.json({ answer: text });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError";
    return NextResponse.json(
      { error: timedOut ? "AI request timed out" : "Unable to reach AI service" },
      { status: timedOut ? 504 : 502 },
    );
  } finally {
    clearTimeout(timeout);
  }
}
