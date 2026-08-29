import { NextResponse } from "next/server";
import { consumePasswordResetToken } from "@/lib/password-reset";

function privateRedirect(url: URL) {
  const response = NextResponse.redirect(url, 303);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
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
      // Never echo a credential-bearing reset token into a redirect URL. A new
      // reset attempt must come from the original trusted link instead of
      // persisting the token in browser history, logs or copied URLs.
      return privateRedirect(new URL("/reset-password?status=mismatch", request.url));
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
