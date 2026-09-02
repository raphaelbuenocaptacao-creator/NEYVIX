import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { readActiveSession } from "@/lib/session";
import { createDriveFolder, deleteEmptyDriveFolder, listDriveItems, renameDriveItem } from "@/lib/drive-db";
import { inspectDriveDocsRepair } from "@/lib/schema-repair";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRIVATE_HEADERS = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
const MAX_NAME_LENGTH = 160;

async function getSession() {
  const store = await cookies();
  return readActiveSession(store.get(SESSION_COOKIE)?.value);
}

function validParent(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !UUID_RE.test(value.trim())) return undefined;
  return value.trim();
}

async function unavailable(error: unknown, fallback: string) {
  console.error("Falha operacional no NEYVIX Drive", error);
  try {
    const readiness = await inspectDriveDocsRepair();
    if (readiness.drive !== "ready") {
      return NextResponse.json({
        error: "NEYVIX Drive está temporariamente indisponível enquanto a persistência é preparada",
        code: "SCHEMA_NOT_READY",
        module: "drive",
        repairRequired: readiness.repairRequired,
      }, { status: 503, headers: { ...PRIVATE_HEADERS, "Retry-After": "60" } });
    }
  } catch (inspectionError) {
    console.error("Falha ao confirmar readiness do NEYVIX Drive", inspectionError);
  }
  return NextResponse.json({ error: fallback, code: "SERVICE_UNAVAILABLE", module: "drive" }, { status: 503, headers: PRIVATE_HEADERS });
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Autenticação necessária ou conta inativa" }, { status: 401, headers: PRIVATE_HEADERS });
  const url = new URL(request.url);
  const parent = validParent(url.searchParams.get("parent"));
  if (parent === undefined) return NextResponse.json({ error: "Pasta inválida" }, { status: 400, headers: PRIVATE_HEADERS });
  try {
    const items = await listDriveItems(session.email, parent);
    return NextResponse.json({ items, parentId: parent }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    return unavailable(error, "Não foi possível carregar o Drive agora");
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Autenticação necessária ou conta inativa" }, { status: 401, headers: PRIVATE_HEADERS });
  const body = await request.json().catch(() => null) as { name?: unknown; parentId?: unknown } | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const parent = validParent(body?.parentId);
  if (!name) return NextResponse.json({ error: "Nome da pasta é obrigatório" }, { status: 400, headers: PRIVATE_HEADERS });
  if (name.length > MAX_NAME_LENGTH) return NextResponse.json({ error: "Nome da pasta excede o limite permitido" }, { status: 413, headers: PRIVATE_HEADERS });
  if (parent === undefined) return NextResponse.json({ error: "Pasta pai inválida" }, { status: 400, headers: PRIVATE_HEADERS });
  try {
    const item = await createDriveFolder(session.email, name, parent);
    return item
      ? NextResponse.json({ item }, { status: 201, headers: PRIVATE_HEADERS })
      : NextResponse.json({ error: "Não foi possível criar a pasta" }, { status: 404, headers: PRIVATE_HEADERS });
  } catch (error) {
    return unavailable(error, "Não foi possível criar a pasta agora");
  }
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Autenticação necessária ou conta inativa" }, { status: 401, headers: PRIVATE_HEADERS });
  const body = await request.json().catch(() => null) as { id?: unknown; name?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Item inválido" }, { status: 400, headers: PRIVATE_HEADERS });
  if (!name) return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400, headers: PRIVATE_HEADERS });
  if (name.length > MAX_NAME_LENGTH) return NextResponse.json({ error: "Nome excede o limite permitido" }, { status: 413, headers: PRIVATE_HEADERS });
  try {
    const item = await renameDriveItem(session.email, id, name);
    return item
      ? NextResponse.json({ item }, { headers: PRIVATE_HEADERS })
      : NextResponse.json({ error: "Item não encontrado" }, { status: 404, headers: PRIVATE_HEADERS });
  } catch (error) {
    return unavailable(error, "Não foi possível renomear o item agora");
  }
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Autenticação necessária ou conta inativa" }, { status: 401, headers: PRIVATE_HEADERS });
  const body = await request.json().catch(() => null) as { id?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Pasta inválida" }, { status: 400, headers: PRIVATE_HEADERS });
  try {
    const deleted = await deleteEmptyDriveFolder(session.email, id);
    return deleted
      ? NextResponse.json({ ok: true }, { headers: PRIVATE_HEADERS })
      : NextResponse.json({ error: "Pasta não encontrada ou não está vazia" }, { status: 409, headers: PRIVATE_HEADERS });
  } catch (error) {
    return unavailable(error, "Não foi possível excluir a pasta agora");
  }
}
