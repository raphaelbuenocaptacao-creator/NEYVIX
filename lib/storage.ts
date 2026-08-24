export type StoredAsset = { url: string; providerId?: string | null };

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxBytes = 8 * 1024 * 1024;

export function validateImage(file: File) {
  if (!allowedTypes.has(file.type)) return { ok: false as const, reason: "unsupported_type" };
  if (file.size < 1 || file.size > maxBytes) return { ok: false as const, reason: "invalid_size" };
  return { ok: true as const };
}

export async function uploadImage(file: File, owner: string): Promise<{ ok: true; asset: StoredAsset } | { ok: false; reason: string }> {
  const endpoint = process.env.STORAGE_UPLOAD_URL?.trim();
  const secret = process.env.STORAGE_UPLOAD_SECRET?.trim() || process.env.STORAGE_TOKEN?.trim();
  if (!endpoint || !secret) return { ok: false, reason: "storage_not_configured" };

  let url: URL;
  try { url = new URL(endpoint); } catch { return { ok: false, reason: "storage_invalid" }; }
  if (url.protocol !== "https:") return { ok: false, reason: "storage_invalid" };

  const validation = validateImage(file);
  if (!validation.ok) return validation;

  const form = new FormData();
  form.set("file", file, file.name.slice(0, 120));
  form.set("owner", owner);
  form.set("scope", "neyvix-estate");

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Authorization": `Bearer ${secret}`, "X-NEYVIX-Source": "estate" },
      body: form,
      cache: "no-store",
    });
    if (!response.ok) return { ok: false, reason: "storage_failed" };
    const data = await response.json().catch(() => ({})) as { url?: string; id?: string; assetId?: string };
    if (!data.url) return { ok: false, reason: "storage_invalid_response" };
    const publicUrl = new URL(data.url);
    if (publicUrl.protocol !== "https:") return { ok: false, reason: "storage_invalid_response" };
    return { ok: true, asset: { url: publicUrl.toString(), providerId: data.id ?? data.assetId ?? null } };
  } catch {
    return { ok: false, reason: "storage_failed" };
  }
}
