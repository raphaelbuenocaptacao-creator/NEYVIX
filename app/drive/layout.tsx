import type { ReactNode } from "react";
import { requireActiveSession } from "@/lib/require-active-session";

export default async function DriveLayout({ children }: { children: ReactNode }) {
  await requireActiveSession("/drive");
  return children;
}
