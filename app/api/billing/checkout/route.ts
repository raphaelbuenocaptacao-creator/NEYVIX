import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { readActiveSession } from "@/lib/session";

const checkoutEnv: Record<string, string | undefined> = {
  start: process.env.NEYVIX_CHECKOUT_START_URL,
  pro: process.env.NEYVIX_CHECKOUT_PRO_URL,
  business: process.env.NEYVIX_CHECKOUT_BUSINESS_URL,
};

function safeCheckoutUrl(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const store = await cookies();
  const session = await readActiveSession(store.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.redirect(new URL("/login", request.url), 303);

  const form = await request.formData();
  const plan = String(form.get("plan") ?? "").trim().toLowerCase();
  if (!["start", "pro", "business"].includes(plan)) {
    return NextResponse.redirect(new URL("/plans", request.url), 303);
  }

  const checkout = safeCheckoutUrl(checkoutEnv[plan]);
  if (!checkout) {
    return NextResponse.redirect(new URL("/billing?error=checkout_unavailable", request.url), 303);
  }

  checkout.searchParams.set("plan", plan);
  checkout.searchParams.set("email", session.email);
  return NextResponse.redirect(checkout, 303);
}
