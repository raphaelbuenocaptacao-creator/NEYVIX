import type { ReactNode } from "react";
import { requireActiveSession } from "@/lib/require-active-session";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireActiveSession("/admin");
  return children;
}
