import type { ReactNode } from "react";
import { requireActiveSession } from "@/lib/require-active-session";

export default async function DeployLayout({ children }: { children: ReactNode }) {
  await requireActiveSession("/deploy");
  return children;
}
