import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { readActiveSession } from "@/lib/session";
import { listChatMessages, sendChatMessage } from "@/lib/chat-db";

const HEADERS={"Cache-Control":"no-store","Referrer-Policy":"no-referrer"};
const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
async function session(){const store=await cookies();return readActiveSession(store.get(SESSION_COOKIE)?.value);}
function unavailable(error:unknown){console.error("Falha operacional no NEYVIX Chat",error);return NextResponse.json({error:"NEYVIX Chat está temporariamente indisponível",code:"SERVICE_UNAVAILABLE",module:"chat"},{status:503,headers:{...HEADERS,"Retry-After":"30"}});}
export async function GET(){const s=await session();if(!s)return NextResponse.json({error:"Autenticação necessária ou conta inativa"},{status:401,headers:HEADERS});try{return NextResponse.json({messages:await listChatMessages(s.email)},{headers:HEADERS});}catch(e){return unavailable(e);}}
export async function POST(request:Request){const s=await session();if(!s)return NextResponse.json({error:"Autenticação necessária ou conta inativa"},{status:401,headers:HEADERS});const b=await request.json().catch(()=>null) as {recipientEmail?:unknown;text?:unknown}|null;const recipientEmail=typeof b?.recipientEmail==='string'?b.recipientEmail.trim().toLowerCase():'';const text=typeof b?.text==='string'?b.text.trim():'';if(!EMAIL.test(recipientEmail)||recipientEmail.length>320)return NextResponse.json({error:"Destinatário inválido"},{status:400,headers:HEADERS});if(!text)return NextResponse.json({error:"Mensagem vazia"},{status:400,headers:HEADERS});if(text.length>4000)return NextResponse.json({error:"Mensagem excede 4.000 caracteres"},{status:413,headers:HEADERS});try{const message=await sendChatMessage(s.email,recipientEmail,text);return message?NextResponse.json({message},{status:201,headers:HEADERS}):NextResponse.json({error:"Destinatário não encontrado ou inativo"},{status:404,headers:HEADERS});}catch(e){return unavailable(e);}}
