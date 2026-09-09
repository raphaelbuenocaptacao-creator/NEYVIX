import type { ReactNode } from "react";
import { requireActiveSession } from "@/lib/require-active-session";
export default async function ChatLayout({children}:{children:ReactNode}){await requireActiveSession('/chat');return children;}
