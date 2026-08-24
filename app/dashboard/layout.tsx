import type { ReactNode } from "react";
import { requireActiveSession } from "@/lib/require-active-session";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  await requireActiveSession("/dashboard");
  return children;
}
