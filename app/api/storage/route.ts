import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { readActiveSession } from "@/lib/session";
import { createPrivateDriveFile } from "@/lib/storage-db";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRIVATE_HEADERS = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};
const MAX_FILE_BYTES = 1024 * 1024;
const MAX_NAME_LENGTH = 160;
const MAX_MIME_LENGTH = 160;
const BASE64_RE = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

async function getSession() {
  const store = await cookies();
  return readActiveSession(store.get(SESSION_COOKIE)?.value);
}

function parseParent(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !UUID_RE.test(value.trim())) return undefined;
  return value.trim();
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Autenticação necessária ou conta inativa" }, { status: 401, headers: PRIVATE_HEADERS });
  }

  const body = await request.json().catch(() => null) as {
    name?: unknown;
    mimeType?: unknown;
    contentBase64?: unknown;
    parentId?: unknown;
  } | null;

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const mimeType = typeof body?.mimeType === "string" ? body.mimeType.trim() : "application/octet-stream";
  const contentBase64 = typeof body?.contentBase64 === "string" ? body.contentBase64.trim() : "";
  const parentId = parseParent(body?.parentId);

  if (!name) return NextResponse.json({ error: "Nome do arquivo é obrigatório" }, { status: 400, headers: PRIVATE_HEADERS });
  if (name.length > MAX_NAME_LENGTH) return NextResponse.json({ error: "Nome excede o limite permitido" }, { status: 413, headers: PRIVATE_HEADERS });
  if (mimeType.length > MAX_MIME_LENGTH) return NextResponse.json({ error: "Tipo de conteúdo excede o limite permitido" }, { status: 413, headers: PRIVATE_HEADERS });
  if (parentId === undefined) return NextResponse.json({ error: "Pasta pai inválida" }, { status: 400, headers: PRIVATE_HEADERS });
  if (!contentBase64 || !BASE64_RE.test(contentBase64)) {
    return NextResponse.json({ error: "Conteúdo base64 inválido" }, { status: 400, headers: PRIVATE_HEADERS });
  }

  const content = Buffer.from(contentBase64, "base64");
  if (!content.length) return NextResponse.json({ error: "Arquivo vazio não é permitido" }, { status: 400, headers: PRIVATE_HEADERS });
  if (content.length > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "Arquivo excede o limite atual de 1 MB" }, { status: 413, headers: PRIVATE_HEADERS });
  }

  try {
    const file = await createPrivateDriveFile({
      email: session.email,
      name,
      mimeType,
      content,
      parentId,
    });
    return file
      ? NextResponse.json({ file }, { status: 201, headers: PRIVATE_HEADERS })
      : NextResponse.json({ error: "Não foi possível armazenar o arquivo" }, { status: 503, headers: PRIVATE_HEADERS });
  } catch (error) {
    console.error("Falha ao persistir arquivo privado no NEYVIX Storage", error);
    return NextResponse.json({ error: "NEYVIX Storage temporariamente indisponível" }, { status: 503, headers: PRIVATE_HEADERS });
  }
}
