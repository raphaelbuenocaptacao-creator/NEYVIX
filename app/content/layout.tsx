import type { ReactNode } from "react";
import { requireActiveSession } from "@/lib/require-active-session";

export default async function ContentLayout({ children }: { children: ReactNode }) {
  await requireActiveSession("/content");
  return children;
}
