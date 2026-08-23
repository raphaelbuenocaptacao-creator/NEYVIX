import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { readActiveSession } from "@/lib/session";
import { createAutomation, listAutomationWorkspace } from "@/lib/automation-db";

const MAX_NAME = 120;
const MAX_DESCRIPTION = 1000;
const ALLOWED_TRIGGER_TYPES = new Set(["manual", "schedule", "event", "webhook"]);
const ALLOWED_ACTION_TYPES = new Set(["workflow", "ai", "mail", "content", "studio"]);

async function getSession() {
  const store = await cookies();
  return readActiveSession(store.get(SESSION_COOKIE)?.value);
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Autenticação necessária ou conta inativa" }, { status: 401, headers: { "Cache-Control": "no-store" } });

  try {
    const workspace = await listAutomationWorkspace(session.email);
    return NextResponse.json(workspace, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Falha ao listar automações", error);
    return NextResponse.json({ error: "Não foi possível carregar as automações" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Autenticação necessária ou conta inativa" }, { status: 401, headers: { "Cache-Control": "no-store" } });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo JSON inválido" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Dados da automação inválidos" }, { status: 400 });
  }

  const data = body as Record<string, unknown>;
  const name = String(data.name ?? "").trim();
  const description = String(data.description ?? "").trim();
  const triggerType = String(data.triggerType ?? "manual").trim().toLowerCase();
  const actionType = String(data.actionType ?? "workflow").trim().toLowerCase();

  if (!name) return NextResponse.json({ error: "Informe um nome para a automação" }, { status: 400 });
  if (name.length > MAX_NAME || description.length > MAX_DESCRIPTION) {
    return NextResponse.json({ error: "A automação excede os limites permitidos" }, { status: 413 });
  }
  if (!ALLOWED_TRIGGER_TYPES.has(triggerType) || !ALLOWED_ACTION_TYPES.has(actionType)) {
    return NextResponse.json({ error: "Tipo de automação não permitido" }, { status: 400 });
  }

  try {
    const result = await createAutomation(session.email, { name, description, triggerType, actionType });
    if (!result.ok) {
      const status = result.reason === "user_not_found" ? 403 : 503;
      return NextResponse.json({ error: "A criação da automação não está disponível neste momento", reason: result.reason }, { status });
    }
    return NextResponse.json(result.automation, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Falha ao criar automação", error);
    return NextResponse.json({ error: "Não foi possível criar a automação" }, { status: 503 });
  }
}
