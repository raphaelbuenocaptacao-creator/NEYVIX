import { NextResponse } from "next/server";
import { consumePasswordResetToken } from "@/lib/password-reset";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const token = String(form.get("token") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");

    if (password !== confirmPassword) {
      return NextResponse.redirect(new URL(`/reset-password?status=mismatch&token=${encodeURIComponent(token)}`, request.url), 303);
    }
    if (password.length < 10 || token.length < 20) {
      return NextResponse.redirect(new URL("/reset-password?status=invalid", request.url), 303);
    }

    const updated = await consumePasswordResetToken(token, password);
    if (!updated) return NextResponse.redirect(new URL("/reset-password?status=invalid", request.url), 303);

    return NextResponse.redirect(new URL("/login?reset=success", request.url), 303);
  } catch (error) {
    console.error("NEYVIX password reset failed", error);
    return NextResponse.redirect(new URL("/reset-password?status=invalid", request.url), 303);
  }
}
