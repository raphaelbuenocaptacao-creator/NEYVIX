import type { ReactNode } from "react";
import { requireActiveSession } from "@/lib/require-active-session";

export default async function AutomationLayout({ children }: { children: ReactNode }) {
  await requireActiveSession("/automation");
  return children;
}
