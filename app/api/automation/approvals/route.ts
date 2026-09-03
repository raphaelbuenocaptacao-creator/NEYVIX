import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { readActiveSession } from "@/lib/session";
import { createSelfApproval } from "@/lib/approval-db";
import { getProductAccess, upgradeRequiredPayload } from "@/lib/product-access";

const MAX_TITLE = 180;
const MAX_PAYLOAD_BYTES = 8_000;

export async function POST(request: Request) {
  const store = await cookies();
  const session = await readActiveSession(store.get(SESSION_COOKIE)?.value);

  if (!session) {
    return NextResponse.json(
      { error: "Autenticação necessária ou conta inativa" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const access = await getProductAccess(session.email, "approvals");
  if (!access.allowed) {
    return NextResponse.json(
      upgradeRequiredPayload("approvals", "Business"),
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo JSON inválido" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: "Dados de aprovação inválidos" }, { status: 400 });
  }

  const data = body as Record<string, unknown>;
  const title = String(data.title ?? "").trim();
  const payload = data.payload ?? {};

  if (!title || title.length > MAX_TITLE) {
    return NextResponse.json({ error: "Título de aprovação inválido" }, { status: 400 });
  }
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return NextResponse.json({ error: "Payload deve ser um objeto JSON" }, { status: 400 });
  }

  const serialized = JSON.stringify(payload);
  if (Buffer.byteLength(serialized, "utf8") > MAX_PAYLOAD_BYTES) {
    return NextResponse.json({ error: "Payload excede o limite permitido" }, { status: 413 });
  }

  try {
    const result = await createSelfApproval(session.email, {
      title,
      payload: payload as Record<string, unknown>,
    });
    if (!result.ok) {
      return NextResponse.json(
        { error: "Não foi possível criar a aprovação", reason: result.reason },
        { status: 503 },
      );
    }

    return NextResponse.json(result.approval, {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Falha ao criar aprovação", error);
    return NextResponse.json({ error: "Não foi possível criar a aprovação" }, { status: 503 });
  }
}
