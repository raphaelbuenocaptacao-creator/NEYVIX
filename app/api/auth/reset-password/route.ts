import { NextResponse } from "next/server";
import { resetAuthorizedAdminPassword } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const password = String(form.get("password") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");
    if (password !== confirmPassword) return NextResponse.redirect(new URL("/reset-password?status=mismatch", request.url), 303);
    if (password.length < 10) return NextResponse.redirect(new URL("/reset-password?status=invalid", request.url), 303);
    const updated = await resetAuthorizedAdminPassword(email, password);
    if (!updated) return NextResponse.redirect(new URL("/reset-password?status=invalid", request.url), 303);
    return NextResponse.redirect(new URL("/login?reset=success", request.url), 303);
  } catch (error) {
    console.error("NEYVIX password reset failed", error);
    return NextResponse.redirect(new URL("/reset-password?status=invalid", request.url), 303);
  }
}
