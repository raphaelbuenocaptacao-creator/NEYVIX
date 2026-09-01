import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { readActiveSession } from "@/lib/session";
import { createAutomation, deleteAutomation, listAutomationWorkspace, updateAutomationStatus } from "@/lib/automation-db";
import { getProductAccess, upgradeRequiredPayload } from "@/lib/product-access";

const MAX_NAME = 120;
const MAX_DESCRIPTION = 1000;
const ALLOWED_TRIGGER_TYPES = new Set(["manual", "schedule", "event", "webhook"]);
const ALLOWED_ACTION_TYPES = new Set(["workflow", "ai", "mail", "content", "studio"]);
const ALLOWED_STATUS_UPDATES = new Set(["active", "paused"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function getSession() {
  const store = await cookies();
  return readActiveSession(store.get(SESSION_COOKIE)?.value);
}

async function checkAccess(email: string) {
  const access = await getProductAccess(email, "automation");
  return access.allowed ? null : NextResponse.json(upgradeRequiredPayload("automation", "Pro"), { status: 402, headers: { "Cache-Control": "no-store" } });
}

const privateHeaders = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Autenticação necessária ou conta inativa" }, { status: 401, headers: privateHeaders });
  const denied = await checkAccess(session.email);
  if (denied) return denied;

  try {
    const workspace = await listAutomationWorkspace(session.email);
    return NextResponse.json(workspace, { headers: privateHeaders });
  } catch (error) {
    console.error("Falha ao listar automações", error);
    return NextResponse.json({ error: "Não foi possível carregar as automações" }, { status: 503, headers: privateHeaders });
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Autenticação necessária ou conta inativa" }, { status: 401, headers: privateHeaders });
  const denied = await checkAccess(session.email);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo JSON inválido" }, { status: 400, headers: privateHeaders });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Dados da automação inválidos" }, { status: 400, headers: privateHeaders });
  }

  const data = body as Record<string, unknown>;
  const name = String(data.name ?? "").trim();
  const description = String(data.description ?? "").trim();
  const triggerType = String(data.triggerType ?? "manual").trim().toLowerCase();
  const actionType = String(data.actionType ?? "workflow").trim().toLowerCase();

  if (!name) return NextResponse.json({ error: "Informe um nome para a automação" }, { status: 400, headers: privateHeaders });
  if (name.length > MAX_NAME || description.length > MAX_DESCRIPTION) {
    return NextResponse.json({ error: "A automação excede os limites permitidos" }, { status: 413, headers: privateHeaders });
  }
  if (!ALLOWED_TRIGGER_TYPES.has(triggerType) || !ALLOWED_ACTION_TYPES.has(actionType)) {
    return NextResponse.json({ error: "Tipo de automação não permitido" }, { status: 400, headers: privateHeaders });
  }

  try {
    const result = await createAutomation(session.email, { name, description, triggerType, actionType });
    if (!result.ok) {
      const status = result.reason === "user_not_found" ? 403 : 503;
      return NextResponse.json({ error: "A criação da automação não está disponível neste momento", reason: result.reason }, { status, headers: privateHeaders });
    }
    return NextResponse.json(result.automation, { status: 201, headers: privateHeaders });
  } catch (error) {
    console.error("Falha ao criar automação", error);
    return NextResponse.json({ error: "Não foi possível criar a automação" }, { status: 503, headers: privateHeaders });
  }
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Autenticação necessária ou conta inativa" }, { status: 401, headers: privateHeaders });
  const denied = await checkAccess(session.email);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo JSON inválido" }, { status: 400, headers: privateHeaders });
  }
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Dados de atualização inválidos" }, { status: 400, headers: privateHeaders });
  }

  const data = body as Record<string, unknown>;
  const id = String(data.id ?? "").trim();
  const status = String(data.status ?? "").trim().toLowerCase();
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Identificador de automação inválido" }, { status: 400, headers: privateHeaders });
  }
  if (!ALLOWED_STATUS_UPDATES.has(status)) {
    return NextResponse.json({ error: "Estado de automação não permitido" }, { status: 400, headers: privateHeaders });
  }

  try {
    const result = await updateAutomationStatus(session.email, id, status as "active" | "paused");
    if (!result.ok) {
      const responseStatus = result.reason === "not_found_or_forbidden" ? 404 : 503;
      return NextResponse.json({ error: responseStatus === 404 ? "Automação não encontrada" : "Não foi possível atualizar a automação" }, { status: responseStatus, headers: privateHeaders });
    }
    return NextResponse.json(result.automation, { headers: privateHeaders });
  } catch (error) {
    console.error("Falha ao atualizar automação", error);
    return NextResponse.json({ error: "Não foi possível atualizar a automação" }, { status: 503, headers: privateHeaders });
  }
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Autenticação necessária ou conta inativa" }, { status: 401, headers: privateHeaders });
  const denied = await checkAccess(session.email);
  if (denied) return denied;

  const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Identificador de automação inválido" }, { status: 400, headers: privateHeaders });
  }

  try {
    const result = await deleteAutomation(session.email, id);
    if (!result.ok) {
      const status = result.reason === "not_found_or_forbidden" ? 404 : 503;
      return NextResponse.json({ error: status === 404 ? "Automação não encontrada" : "Não foi possível excluir a automação" }, { status, headers: privateHeaders });
    }
    return NextResponse.json({ ok: true, id: result.id }, { headers: privateHeaders });
  } catch (error) {
    console.error("Falha ao excluir automação", error);
    return NextResponse.json({ error: "Não foi possível excluir a automação" }, { status: 503, headers: privateHeaders });
  }
}
