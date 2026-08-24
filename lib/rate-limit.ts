import { createHmac } from "node:crypto";
import { neon } from "@neondatabase/serverless";

function getSql() {
  const url = process.env.DATABASE_URL?.trim();
  return url ? neon(url) : null;
}

function keySecret() {
  return process.env.NEYVIX_SESSION_SECRET?.trim() || "neyvix-rate-limit";
}

export function clientAddress(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
}

export function rateLimitBucket(value: string) {
  return createHmac("sha256", keySecret()).update(value).digest("hex");
}

export async function isRateLimited(action: string, bucket: string, limit: number, windowMinutes: number) {
  const sql = getSql();
  if (!sql) return false;
  try {
    const rows = await sql`
      SELECT count(*)::int AS attempts
      FROM public.neyvix_rate_limit_events
      WHERE action = ${action}
        AND bucket_key = ${bucket}
        AND created_at > now() - (${windowMinutes} || ' minutes')::interval
    `;
    return Number(rows[0]?.attempts ?? 0) >= limit;
  } catch (error) {
    console.warn("NEYVIX rate limit unavailable", error);
    return false;
  }
}

export async function recordRateLimitEvent(action: string, bucket: string) {
  const sql = getSql();
  if (!sql) return;
  try {
    await sql`INSERT INTO public.neyvix_rate_limit_events (action, bucket_key) VALUES (${action}, ${bucket})`;
  } catch (error) {
    console.warn("NEYVIX rate limit event not recorded", error);
  }
}

export async function clearRateLimitBucket(action: string, bucket: string) {
  const sql = getSql();
  if (!sql) return;
  try {
    await sql`DELETE FROM public.neyvix_rate_limit_events WHERE action = ${action} AND bucket_key = ${bucket}`;
  } catch (error) {
    console.warn("NEYVIX rate limit bucket not cleared", error);
  }
}
