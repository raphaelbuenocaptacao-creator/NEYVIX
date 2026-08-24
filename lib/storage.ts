export type StoredAsset = { url: string; providerId?: string | null };

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxBytes = 8 * 1024 * 1024;
const STORAGE_TIMEOUT_MS = 20_000;

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
  form.set("owner", owner.slice(0, 240));
  form.set("scope", "neyvix-estate");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), STORAGE_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Authorization": `Bearer ${secret}`, "X-NEYVIX-Source": "estate" },
      body: form,
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) return { ok: false, reason: "storage_failed" };
    const data = await response.json().catch(() => ({})) as { url?: unknown; id?: unknown; assetId?: unknown };
    if (typeof data.url !== "string" || data.url.length > 2048) return { ok: false, reason: "storage_invalid_response" };

    let publicUrl: URL;
    try { publicUrl = new URL(data.url); } catch { return { ok: false, reason: "storage_invalid_response" }; }
    if (publicUrl.protocol !== "https:") return { ok: false, reason: "storage_invalid_response" };

    const rawProviderId = typeof data.id === "string" ? data.id : typeof data.assetId === "string" ? data.assetId : null;
    return { ok: true, asset: { url: publicUrl.toString(), providerId: rawProviderId?.slice(0, 240) ?? null } };
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError";
    return { ok: false, reason: timedOut ? "storage_timeout" : "storage_failed" };
  } finally {
    clearTimeout(timeout);
  }
}
