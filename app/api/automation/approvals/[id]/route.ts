import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { readActiveSession } from "@/lib/session";
import { decideApproval } from "@/lib/automation-db";

const MAX_NOTE = 1000;

type RouteContext = { params: Promise<{ id: string }> };

async function handleDecision(request: Request, context: RouteContext) {
  const store = await cookies();
  const session = await readActiveSession(store.get(SESSION_COOKIE)?.value);

  if (!session) return NextResponse.json({ error: "Autenticação necessária ou conta inativa" }, { status: 401, headers: { "Cache-Control": "no-store" } });

  const { id } = await context.params;
  if (!id || id.length > 100) return NextResponse.json({ error: "Aprovação inválida" }, { status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo JSON inválido" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Dados de decisão inválidos" }, { status: 400 });
  }

  const data = body as Record<string, unknown>;
  const decision = String(data.decision ?? "").trim().toLowerCase();
  const note = String(data.note ?? "").trim();

  if (decision !== "approved" && decision !== "rejected") {
    return NextResponse.json({ error: "Decisão deve ser approved ou rejected" }, { status: 400 });
  }
  if (note.length > MAX_NOTE) {
    return NextResponse.json({ error: "A observação excede o limite permitido" }, { status: 413 });
  }

  try {
    const result = await decideApproval(session.email, id, decision, note);
    if (!result.ok) {
      const status = result.reason === "not_found_or_forbidden" ? 404 : 503;
      return NextResponse.json({ error: "Não foi possível registrar a decisão", reason: result.reason }, { status });
    }
    return NextResponse.json(result.approval, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Falha ao decidir aprovação", error);
    return NextResponse.json({ error: "Não foi possível registrar a decisão" }, { status: 503 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  return handleDecision(request, context);
}

export async function POST(request: Request, context: RouteContext) {
  return handleDecision(request, context);
}
