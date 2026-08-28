import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "neyvix_session";

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodePayload<T>(value: string): T | null {
  try {
    return JSON.parse(new TextDecoder().decode(fromBase64Url(value))) as T;
  } catch {
    return null;
  }
}

async function sha256Base64Url(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return toBase64Url(new Uint8Array(digest));
}

async function getSessionSecret() {
  const configured = process.env.NEYVIX_SESSION_SECRET?.trim();
  if (configured) return configured;

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (databaseUrl) {
    return sha256Base64Url(`NEYVIX_SESSION_KEY_V1\0${databaseUrl}`);
  }

  if (process.env.NODE_ENV !== "production") {
    return "neyvix-development-only-secret-change-me";
  }

  return null;
}

async function hasValidSession(token?: string) {
  if (!token) return false;
  const secret = await getSessionSecret();
  if (!secret) return false;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      fromBase64Url(signature),
      new TextEncoder().encode(payload),
    );
    if (!valid) return false;

    const session = decodePayload<{ exp?: number }>(payload);
    return Boolean(session?.exp && session.exp >= Math.floor(Date.now() / 1000));
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (await hasValidSession(token)) return NextResponse.next();

  const login = new URL("/login", request.url);
  login.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  login.searchParams.set("reason", "session");
  const response = NextResponse.redirect(login);
  response.cookies.delete(SESSION_COOKIE);
  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/ai/:path*",
    "/memory/:path*",
    "/studio/:path*",
    "/content/:path*",
    "/automation/:path*",
    "/estate/:path*",
    "/mail/:path*",
    "/deploy/:path*",
    "/billing/:path*",
    "/admin/:path*",
  ],
};
