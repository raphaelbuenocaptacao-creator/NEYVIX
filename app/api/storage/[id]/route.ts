import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { readActiveSession } from "@/lib/session";
import { deletePrivateDriveFile, readPrivateDriveFile } from "@/lib/storage-db";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRIVATE_HEADERS = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

async function getSession() {
  const store = await cookies();
  return readActiveSession(store.get(SESSION_COOKIE)?.value);
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Autenticação necessária ou conta inativa" }, { status: 401, headers: PRIVATE_HEADERS });
  const { id } = await context.params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Arquivo inválido" }, { status: 400, headers: PRIVATE_HEADERS });

  try {
    const file = await readPrivateDriveFile(session.email, id);
    if (!file) return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404, headers: PRIVATE_HEADERS });
    const bytes = Buffer.from(file.contentBase64, "base64");
    return new Response(bytes, {
      status: 200,
      headers: {
        ...PRIVATE_HEADERS,
        "Content-Type": file.mimeType || "application/octet-stream",
        "Content-Length": String(bytes.length),
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
        "X-NEYVIX-SHA256": file.checksumSha256,
      },
    });
  } catch (error) {
    console.error("Falha ao ler arquivo privado no NEYVIX Storage", error);
    return NextResponse.json({ error: "NEYVIX Storage temporariamente indisponível" }, { status: 503, headers: PRIVATE_HEADERS });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Autenticação necessária ou conta inativa" }, { status: 401, headers: PRIVATE_HEADERS });
  const { id } = await context.params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Arquivo inválido" }, { status: 400, headers: PRIVATE_HEADERS });

  try {
    const deleted = await deletePrivateDriveFile(session.email, id);
    return deleted
      ? NextResponse.json({ ok: true }, { headers: PRIVATE_HEADERS })
      : NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404, headers: PRIVATE_HEADERS });
  } catch (error) {
    console.error("Falha ao excluir arquivo privado no NEYVIX Storage", error);
    return NextResponse.json({ error: "NEYVIX Storage temporariamente indisponível" }, { status: 503, headers: PRIVATE_HEADERS });
  }
}
