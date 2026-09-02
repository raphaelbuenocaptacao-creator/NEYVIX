import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { readActiveSession } from "@/lib/session";
import { getUserRole } from "@/lib/user-role";
import { inspectDriveDocsRepair, repairDriveDocsSchema } from "@/lib/schema-repair";

const PRIVATE_HEADERS = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
const CONFIRMATION = "REPAIR_DRIVE_DOCS";

async function requireSuperadmin() {
  const store = await cookies();
  const session = await readActiveSession(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const role = await getUserRole(session.email);
  return role === "superadmin" ? session : null;
}

export async function GET() {
  const session = await requireSuperadmin();
  if (!session) return NextResponse.json({ error: "Acesso restrito ao superadministrador" }, { status: 403, headers: PRIVATE_HEADERS });
  try {
    const status = await inspectDriveDocsRepair();
    return NextResponse.json({ status, executable: status.database === "connected" && status.repairRequired.length > 0 }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    console.error("Falha ao inspecionar schema Drive/Docs", error);
    return NextResponse.json({ error: "Não foi possível inspecionar o schema agora" }, { status: 503, headers: PRIVATE_HEADERS });
  }
}

export async function POST(request: Request) {
  const session = await requireSuperadmin();
  if (!session) return NextResponse.json({ error: "Acesso restrito ao superadministrador" }, { status: 403, headers: PRIVATE_HEADERS });

  const body = await request.json().catch(() => null) as { confirmation?: unknown } | null;
  if (body?.confirmation !== CONFIRMATION) {
    return NextResponse.json({ error: "Confirmação explícita necessária", requiredConfirmation: CONFIRMATION }, { status: 400, headers: PRIVATE_HEADERS });
  }

  try {
    const before = await inspectDriveDocsRepair();
    if (before.repairRequired.length === 0) {
      return NextResponse.json({ changed: false, before, after: before }, { headers: PRIVATE_HEADERS });
    }
    const after = await repairDriveDocsSchema();
    return NextResponse.json({ changed: true, before, after }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    console.error("Falha ao reparar schema Drive/Docs", error);
    return NextResponse.json({ error: "O reparo não pôde ser concluído" }, { status: 503, headers: PRIVATE_HEADERS });
  }
}
