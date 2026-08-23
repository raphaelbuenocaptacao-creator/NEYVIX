import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, readSession } from "@/lib/auth";
import { listEstateSites, saveEstateSite, type EstatePropertyInput } from "@/lib/estate-db";

const MAX_PROPERTIES = 50;
const MAX_IMAGES_PER_PROPERTY = 12;

async function getSession() {
  const store = await cookies();
  try { return readSession(store.get(SESSION_COOKIE)?.value); } catch { return null; }
}

function cleanSlug(value: string) {
  return value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Autenticação necessária" }, { status: 401 });
  try {
    const sites = await listEstateSites(session.email, 20);
    return NextResponse.json({ sites }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Falha ao listar projetos Estate", error);
    return NextResponse.json({ error: "Não foi possível carregar os projetos Estate" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Autenticação necessária" }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Corpo JSON inválido" }, { status: 400 }); }
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const data = body as Record<string, unknown>;
  const brand = String(data.brand ?? "").trim().slice(0, 80);
  const city = String(data.city ?? "").trim().slice(0, 100);
  const slug = cleanSlug(String(data.slug ?? brand));
  const whatsapp = String(data.whatsapp ?? "").trim().slice(0, 30);
  const creci = String(data.creci ?? "").trim().slice(0, 30);
  const headline = String(data.headline ?? "").trim().slice(0, 220);
  const status = data.status === "published" ? "published" : "draft";
  const customDomain = String(data.customDomain ?? "").trim().toLowerCase().slice(0, 200);
  const rawProperties = Array.isArray(data.properties) ? data.properties.slice(0, MAX_PROPERTIES) : [];

  if (!brand || !city || !slug) return NextResponse.json({ error: "Informe marca, cidade e endereço do site" }, { status: 400 });

  const properties: EstatePropertyInput[] = rawProperties.map((item) => {
    const row = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    const imageUrls = Array.isArray(row.imageUrls)
      ? row.imageUrls.map((value) => String(value).trim()).filter((value) => /^https:\/\//i.test(value)).slice(0, MAX_IMAGES_PER_PROPERTY)
      : [];
    return {
      title: String(row.title ?? "Imóvel").trim().slice(0, 120),
      price: String(row.price ?? "").trim().slice(0, 40),
      propertyType: String(row.propertyType ?? "").trim().slice(0, 40),
      location: String(row.location ?? city).trim().slice(0, 120),
      description: String(row.description ?? "").trim().slice(0, 1200),
      imageUrls,
    };
  }).filter((item) => item.title);

  try {
    const result = await saveEstateSite(session.email, { brand, slug, city, whatsapp, creci, headline, status, customDomain, properties });
    if (!result.ok) return NextResponse.json({ error: "Persistência do Estate ainda não está disponível", reason: result.reason }, { status: result.reason === "user_not_found" ? 403 : 503 });
    return NextResponse.json(result.site, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Falha ao salvar projeto Estate", error);
    return NextResponse.json({ error: "Não foi possível salvar o projeto Estate" }, { status: 503 });
  }
}
