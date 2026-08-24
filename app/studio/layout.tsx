import type { ReactNode } from "react";
import { requireActiveSession } from "@/lib/require-active-session";

export default async function StudioLayout({ children }: { children: ReactNode }) {
  await requireActiveSession("/studio");
  return children;
}
