import { neon } from "@neondatabase/serverless";

export type ChatMessage={id:string;fromEmail:string;fromName:string;toEmail:string;toName:string;text:string;createdAt:string;direction:"sent"|"received"};
export type ChatMessagePage={messages:ChatMessage[];nextCursor:string|null;hasMore:boolean};
type ChatIdentity={user_id:string;project_id:string;email:string;name:string};
function getSql(){const url=process.env.DATABASE_URL?.trim();return url?neon(url):null;}
async function ready(sql:NonNullable<ReturnType<typeof getSql>>){const rows=await sql`SELECT to_regclass('public.realtime_events')::text AS events,to_regclass('public.projects')::text AS projects,to_regclass('public.users')::text AS users,to_regclass('public.project_users')::text AS project_users`;const r=rows[0] as Record<string,unknown>|undefined;return Boolean(r?.events&&r?.projects&&r?.users&&r?.project_users);}
function normalize(email:string){return email.trim().toLowerCase();}
function map(row:Record<string,unknown>,me:string):ChatMessage{return{id:String(row.id),fromEmail:String(row.from_email),fromName:String(row.from_name??row.from_email),toEmail:String(row.to_email),toName:String(row.to_name??row.to_email),text:String(row.text??""),createdAt:String(row.created_at),direction:normalize(String(row.from_email))===normalize(me)?"sent":"received"};}
function parseCursor(value?:string|null){const cursor=value?.trim();if(!cursor)return{createdAt:null as string|null,id:null as string|null};const split=cursor.lastIndexOf('|');if(split>0){const createdAt=cursor.slice(0,split);const id=cursor.slice(split+1);if(!Number.isNaN(Date.parse(createdAt))&&/^\d+$/.test(id))return{createdAt,id};}return{createdAt:cursor,id:null as string|null};}
async function resolveIdentity(sql:NonNullable<ReturnType<typeof getSql>>,email:string){
  const rows=await sql`
    SELECT u.id::text AS user_id,p.id::text AS project_id,u.email,COALESCE(NULLIF(u.name,''),u.email) AS name
    FROM public.users u CROSS JOIN public.projects p
    WHERE lower(u.email)=${normalize(email)} AND u.is_active=true AND p.slug='neyvix' AND p.is_active=true
    LIMIT 1`;
  return (rows[0] as ChatIdentity|undefined)??null;
}

export async function listChatMessages(email:string,options?:{limit?:number;before?:string|null}):Promise<ChatMessagePage>{
  const sql=getSql();
  if(!sql||!(await ready(sql)))throw new Error("CHAT_SCHEMA_NOT_READY");
  const me=normalize(email);
  const identity=await resolveIdentity(sql,me);
  if(!identity)return{messages:[],nextCursor:null,hasMore:false};
  const limit=Math.max(1,Math.min(100,Math.trunc(options?.limit??50)));
  const before=parseCursor(options?.before);
  const fetchLimit=limit+1;
  const results=await sql.transaction([
    sql`SELECT set_config('aureon.project_id',${identity.project_id},true),set_config('aureon.user_id',${identity.user_id},true)`,
    sql`INSERT INTO public.project_users(project_id,user_id,role) VALUES (${identity.project_id}::uuid,${identity.user_id}::uuid,'member') ON CONFLICT (project_id,user_id) DO NOTHING`,
    sql`
      SELECT e.id,s.email AS from_email,COALESCE(NULLIF(s.name,''),s.email) AS from_name,
        r.email AS to_email,COALESCE(NULLIF(r.name,''),r.email) AS to_name,e.payload->>'text' AS text,e.created_at
      FROM public.realtime_events e
      JOIN public.users s ON s.id=e.actor_user_id
      JOIN public.users r ON r.id::text=e.payload->>'recipientUserId'
      WHERE e.project_id=${identity.project_id}::uuid AND e.topic='chat:direct' AND e.event_type='chat.message.v1'
        AND (${identity.user_id}::uuid=s.id OR ${identity.user_id}::uuid=r.id)
        AND (${before.createdAt}::timestamptz IS NULL OR e.created_at < ${before.createdAt}::timestamptz OR (${before.id}::bigint IS NOT NULL AND e.created_at = ${before.createdAt}::timestamptz AND e.id < ${before.id}::bigint))
      ORDER BY e.created_at DESC,e.id DESC
      LIMIT ${fetchLimit}`,
  ]);
  const pageRows=results[2] as Array<Record<string,unknown>>;
  const hasMore=pageRows.length>limit;
  const selected=pageRows.slice(0,limit);
  const last=selected[selected.length-1];
  const nextCursor=hasMore&&last?`${String(last.created_at)}|${String(last.id)}`:null;
  return{messages:selected.reverse().map((row)=>map(row,me)),nextCursor,hasMore};
}

export async function sendChatMessage(email:string,recipientEmail:string,text:string){
  const sql=getSql();
  if(!sql||!(await ready(sql)))throw new Error("CHAT_SCHEMA_NOT_READY");
  const sender=normalize(email);
  const recipient=normalize(recipientEmail);
  const body=text.trim();
  const identity=await resolveIdentity(sql,sender);
  if(!identity)return null;
  const recipientRows=await sql`SELECT id::text AS id,email,COALESCE(NULLIF(name,''),email) AS name FROM public.users WHERE lower(email)=${recipient} AND is_active=true LIMIT 1`;
  const recipientUser=recipientRows[0] as {id:string;email:string;name:string}|undefined;
  if(!recipientUser)return null;
  const results=await sql.transaction([
    sql`SELECT set_config('aureon.project_id',${identity.project_id},true),set_config('aureon.user_id',${identity.user_id},true)`,
    sql`INSERT INTO public.project_users(project_id,user_id,role) VALUES (${identity.project_id}::uuid,${identity.user_id}::uuid,'member') ON CONFLICT (project_id,user_id) DO NOTHING`,
    sql`INSERT INTO public.realtime_events(project_id,actor_user_id,topic,event_type,payload)
        VALUES (${identity.project_id}::uuid,${identity.user_id}::uuid,'chat:direct','chat.message.v1',jsonb_build_object('recipientUserId',${recipientUser.id}::text,'text',${body}::text))
        RETURNING id,created_at`,
  ]);
  const inserted=(results[2] as Array<Record<string,unknown>>)[0];
  if(!inserted)return null;
  return{
    id:String(inserted.id),fromEmail:identity.email,fromName:identity.name,toEmail:recipientUser.email,toName:recipientUser.name,
    text:body,createdAt:String(inserted.created_at),direction:"sent" as const,
  };
}