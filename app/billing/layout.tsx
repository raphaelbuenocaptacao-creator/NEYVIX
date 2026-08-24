import type { ReactNode } from "react";
import { requireActiveSession } from "@/lib/require-active-session";

export default async function BillingLayout({ children }: { children: ReactNode }) {
  await requireActiveSession("/billing");
  return children;
}
