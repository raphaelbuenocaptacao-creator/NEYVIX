import { NextResponse } from "next/server";
import { consumePasswordResetToken } from "@/lib/password-reset";

function privateRedirect(url: URL) {
  const response = NextResponse.redirect(url, 303);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const token = String(form.get("token") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");

    if (password !== confirmPassword) {
      return privateRedirect(
        new URL(`/reset-password?status=mismatch&token=${encodeURIComponent(token)}`, request.url),
      );
    }
    if (password.length < 10 || token.length < 20) {
      return privateRedirect(new URL("/reset-password?status=invalid", request.url));
    }

    const updated = await consumePasswordResetToken(token, password);
    if (!updated) {
      return privateRedirect(new URL("/reset-password?status=invalid", request.url));
    }

    return privateRedirect(new URL("/login?reset=success", request.url));
  } catch (error) {
    console.error("NEYVIX password reset failed", error);
    return privateRedirect(new URL("/reset-password?status=invalid", request.url));
  }
}
