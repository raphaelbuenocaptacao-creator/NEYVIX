import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { readActiveSession } from "@/lib/session";
import { createDocument, deleteDocument, listDocuments, updateDocument } from "@/lib/docs-db";
import { inspectDriveDocsRepair } from "@/lib/schema-repair";

const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEADERS={"Cache-Control":"no-store","Referrer-Policy":"no-referrer"};
async function session(){const store=await cookies();return readActiveSession(store.get(SESSION_COOKIE)?.value);}

async function unavailable(error: unknown, fallback: string) {
  console.error("Falha operacional no NEYVIX Docs", error);
  try {
    const readiness = await inspectDriveDocsRepair();
    if (readiness.docs !== "ready") {
      return NextResponse.json({
        error: "NEYVIX Docs está temporariamente indisponível enquanto a persistência é preparada",
        code: "SCHEMA_NOT_READY",
        module: "docs",
        repairRequired: readiness.repairRequired,
      }, { status: 503, headers: { ...HEADERS, "Retry-After": "60" } });
    }
  } catch (inspectionError) {
    console.error("Falha ao confirmar readiness do NEYVIX Docs", inspectionError);
  }
  return NextResponse.json({ error: fallback, code: "SERVICE_UNAVAILABLE", module: "docs" }, { status: 503, headers: HEADERS });
}

export async function GET(){const s=await session();if(!s)return NextResponse.json({error:"Autenticação necessária ou conta inativa"},{status:401,headers:HEADERS});try{return NextResponse.json({documents:await listDocuments(s.email)},{headers:HEADERS});}catch(e){return unavailable(e,"Não foi possível carregar seus documentos");}}
export async function POST(request:Request){const s=await session();if(!s)return NextResponse.json({error:"Autenticação necessária ou conta inativa"},{status:401,headers:HEADERS});const b=await request.json().catch(()=>null) as {title?:unknown}|null;const title=typeof b?.title==='string'?b.title.trim():'';if(title.length>160)return NextResponse.json({error:"Título excede 160 caracteres"},{status:413,headers:HEADERS});try{const document=await createDocument(s.email,title||'Sem título');return document?NextResponse.json({document},{status:201,headers:HEADERS}):NextResponse.json({error:"Não foi possível criar o documento"},{status:404,headers:HEADERS});}catch(e){return unavailable(e,"Não foi possível criar o documento agora");}}
export async function PUT(request:Request){const s=await session();if(!s)return NextResponse.json({error:"Autenticação necessária ou conta inativa"},{status:401,headers:HEADERS});const b=await request.json().catch(()=>null) as {id?:unknown;title?:unknown;text?:unknown;version?:unknown}|null;const id=typeof b?.id==='string'?b.id.trim():'';const title=typeof b?.title==='string'?b.title.trim():'';const text=typeof b?.text==='string'?b.text:'';const version=Number(b?.version);if(!UUID_RE.test(id)||!Number.isInteger(version)||version<1)return NextResponse.json({error:"Documento ou versão inválida"},{status:400,headers:HEADERS});if(!title||title.length>160)return NextResponse.json({error:"Título inválido"},{status:400,headers:HEADERS});if(text.length>200000)return NextResponse.json({error:"Documento excede o limite de 200.000 caracteres"},{status:413,headers:HEADERS});try{const document=await updateDocument(s.email,id,title,text,version);return document?NextResponse.json({document},{headers:HEADERS}):NextResponse.json({error:"Documento alterado em outra sessão ou não encontrado. Recarregue antes de salvar."},{status:409,headers:HEADERS});}catch(e){return unavailable(e,"Não foi possível salvar agora");}}
export async function DELETE(request:Request){const s=await session();if(!s)return NextResponse.json({error:"Autenticação necessária ou conta inativa"},{status:401,headers:HEADERS});const b=await request.json().catch(()=>null) as {id?:unknown}|null;const id=typeof b?.id==='string'?b.id.trim():'';if(!UUID_RE.test(id))return NextResponse.json({error:"Documento inválido"},{status:400,headers:HEADERS});try{return await deleteDocument(s.email,id)?NextResponse.json({ok:true},{headers:HEADERS}):NextResponse.json({error:"Documento não encontrado"},{status:404,headers:HEADERS});}catch(e){return unavailable(e,"Não foi possível excluir agora");}}
