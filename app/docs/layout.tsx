import type { ReactNode } from "react";
import { requireActiveSession } from "@/lib/require-active-session";
export default async function DocsLayout({children}:{children:ReactNode}){await requireActiveSession('/docs');return children;}
