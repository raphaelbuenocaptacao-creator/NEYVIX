import type { ReactNode } from "react";
import { requireActiveSession } from "@/lib/require-active-session";

export default async function MailLayout({ children }: { children: ReactNode }) {
  await requireActiveSession("/mail");
  return children;
}
