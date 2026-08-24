import type { ReactNode } from "react";
import { requireActiveSession } from "@/lib/require-active-session";

export default async function AiLayout({ children }: { children: ReactNode }) {
  await requireActiveSession("/ai");
  return children;
}
