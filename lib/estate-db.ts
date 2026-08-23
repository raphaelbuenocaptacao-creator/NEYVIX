import { neon } from "@neondatabase/serverless";

export type EstatePropertyInput = {
  title: string;
  price?: string;
  propertyType?: string;
  location?: string;
  description?: string;
  imageUrls?: string[];
};

export type EstateSiteInput = {
  brand: string;
  slug: string;
  city: string;
  whatsapp?: string;
  creci?: string;
  headline?: string;
  status?: "draft" | "published";
  customDomain?: string;
  properties: EstatePropertyInput[];
};

function getSql() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return null;
  return neon(url);
}

export async function listEstateSites(email: string, limit = 12) {
  const sql = getSql();
  if (!sql) return [];

  const registry = await sql`SELECT to_regclass('public.neyvix_estate_sites')::text AS sites_table`;
  if (!registry[0]?.sites_table) return [];

  return sql`
    SELECT s.id, s.brand, s.slug, s.city, s.whatsapp, s.creci, s.headline, s.status,
           s.custom_domain, s.published_at, s.created_at, s.updated_at,
           (SELECT count(*)::int FROM public.neyvix_estate_properties p WHERE p.site_id = s.id) AS properties_count
    FROM public.neyvix_estate_sites s
    JOIN public.users u ON u.id = s.user_id
    WHERE lower(u.email) = ${email.trim().toLowerCase()}
    ORDER BY s.updated_at DESC
    LIMIT ${Math.max(1, Math.min(limit, 50))}
  `;
}

export async function saveEstateSite(email: string, input: EstateSiteInput) {
  const sql = getSql();
  if (!sql) return { ok: false as const, reason: "database_not_configured" };

  const registry = await sql`SELECT to_regclass('public.neyvix_estate_sites')::text AS sites_table`;
  if (!registry[0]?.sites_table) return { ok: false as const, reason: "schema_not_ready" };

  const normalizedEmail = email.trim().toLowerCase();
  const rows = await sql`
    INSERT INTO public.neyvix_estate_sites
      (user_id, brand, slug, city, whatsapp, creci, headline, status, custom_domain, published_at, updated_at)
    SELECT id, ${input.brand}, ${input.slug}, ${input.city}, ${input.whatsapp || null}, ${input.creci || null},
           ${input.headline || null}, ${input.status || "draft"}, ${input.customDomain || null},
           ${input.status === "published" ? new Date().toISOString() : null}, now()
    FROM public.users
    WHERE lower(email) = ${normalizedEmail} AND is_active = true
    ON CONFLICT (user_id, slug) DO UPDATE SET
      brand = excluded.brand,
      city = excluded.city,
      whatsapp = excluded.whatsapp,
      creci = excluded.creci,
      headline = excluded.headline,
      status = excluded.status,
      custom_domain = excluded.custom_domain,
      published_at = CASE WHEN excluded.status = 'published' THEN COALESCE(public.neyvix_estate_sites.published_at, now()) ELSE public.neyvix_estate_sites.published_at END,
      updated_at = now()
    RETURNING id, brand, slug, city, status, custom_domain, published_at, created_at, updated_at
  `;

  const site = rows[0];
  if (!site) return { ok: false as const, reason: "user_not_found" };

  await sql`DELETE FROM public.neyvix_estate_properties WHERE site_id = ${String(site.id)}`;
  for (const property of input.properties.slice(0, 50)) {
    await sql`
      INSERT INTO public.neyvix_estate_properties
        (site_id, title, price, property_type, location, description, image_urls)
      VALUES (${String(site.id)}, ${property.title}, ${property.price || null}, ${property.propertyType || null},
              ${property.location || null}, ${property.description || null}, ${JSON.stringify((property.imageUrls || []).slice(0, 12))}::jsonb)
    `;
  }

  return { ok: true as const, site };
}
