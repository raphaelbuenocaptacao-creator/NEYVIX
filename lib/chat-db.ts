import { neon } from "@neondatabase/serverless";

export type ChatMessage={id:string;fromEmail:string;fromName:string;toEmail:string;toName:string;text:string;createdAt:string;direction:"sent"|"received"};
export type ChatMessagePage={messages:ChatMessage[];nextCursor:string|null;hasMore:boolean};
function getSql(){const url=process.env.DATABASE_URL?.trim();return url?neon(url):null;}
async function ready(sql:NonNullable<ReturnType<typeof getSql>>){const rows=await sql`SELECT to_regclass('public.realtime_events')::text AS events,to_regclass('public.projects')::text AS projects,to_regclass('public.users')::text AS users,to_regclass('public.project_users')::text AS project_users`;const r=rows[0] as Record<string,unknown>|undefined;return Boolean(r?.events&&r?.projects&&r?.users&&r?.project_users);}
function normalize(email:string){return email.trim().toLowerCase();}
function map(row:Record<string,unknown>,me:string):ChatMessage{return{id:String(row.id),fromEmail:String(row.from_email),fromName:String(row.from_name??row.from_email),toEmail:String(row.to_email),toName:String(row.to_name??row.to_email),text:String(row.text??""),createdAt:String(row.created_at),direction:normalize(String(row.from_email))===normalize(me)?"sent":"received"};}
function parseCursor(value?:string|null){const cursor=value?.trim();if(!cursor)return{createdAt:null as string|null,id:null as string|null};const split=cursor.lastIndexOf('|');if(split>0){const createdAt=cursor.slice(0,split);const id=cursor.slice(split+1);if(!Number.isNaN(Date.parse(createdAt))&&/^\d+$/.test(id))return{createdAt,id};}return{createdAt:cursor,id:null as string|null};}

export async function listChatMessages(email:string,options?:{limit?:number;before?:string|null}):Promise<ChatMessagePage>{
  const sql=getSql();
  if(!sql||!(await ready(sql)))throw new Error("CHAT_SCHEMA_NOT_READY");
  const me=normalize(email);
  const limit=Math.max(1,Math.min(100,Math.trunc(options?.limit??50)));
  const before=parseCursor(options?.before);
  const fetchLimit=limit+1;
  const rows=await sql`
    WITH identity AS MATERIALIZED (
      SELECT u.id AS user_id,p.id AS project_id,
        set_config('aureon.project_id',p.id::text,true) AS project_ctx,
        set_config('aureon.user_id',u.id::text,true) AS user_ctx
      FROM public.users u
      CROSS JOIN public.projects p
      WHERE lower(u.email)=${me} AND u.is_active=true AND p.slug='neyvix' AND p.is_active=true
      LIMIT 1
    ), membership AS MATERIALIZED (
      INSERT INTO public.project_users(project_id,user_id,role)
      SELECT project_id,user_id,'member' FROM identity
      ON CONFLICT (project_id,user_id) DO NOTHING
      RETURNING project_id,user_id
    ), context_ready AS MATERIALIZED (
      SELECT i.user_id,i.project_id,(SELECT count(*) FROM membership) AS membership_write_count
      FROM identity i
    )
    SELECT e.id,s.email AS from_email,COALESCE(NULLIF(s.name,''),s.email) AS from_name,
      r.email AS to_email,COALESCE(NULLIF(r.name,''),r.email) AS to_name,e.payload->>'text' AS text,e.created_at
    FROM public.realtime_events e
    JOIN context_ready ctx ON ctx.project_id=e.project_id AND ctx.membership_write_count>=0
    JOIN public.users s ON s.id=e.actor_user_id
    JOIN public.users r ON r.id::text=e.payload->>'recipientUserId'
    WHERE e.topic='chat:direct' AND e.event_type='chat.message.v1'
      AND (ctx.user_id=s.id OR ctx.user_id=r.id)
      AND (${before.createdAt}::timestamptz IS NULL OR e.created_at < ${before.createdAt}::timestamptz OR (${before.id}::bigint IS NOT NULL AND e.created_at = ${before.createdAt}::timestamptz AND e.id < ${before.id}::bigint))
    ORDER BY e.created_at DESC,e.id DESC
    LIMIT ${fetchLimit}`;
  const pageRows=(rows as Array<Record<string,unknown>>);
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
  const rows=await sql`
    WITH identity AS MATERIALIZED (
      SELECT u.id AS user_id,p.id AS project_id,
        set_config('aureon.project_id',p.id::text,true) AS project_ctx,
        set_config('aureon.user_id',u.id::text,true) AS user_ctx
      FROM public.users u
      CROSS JOIN public.projects p
      WHERE lower(u.email)=${sender} AND u.is_active=true AND p.slug='neyvix' AND p.is_active=true
      LIMIT 1
    ), membership AS MATERIALIZED (
      INSERT INTO public.project_users(project_id,user_id,role)
      SELECT project_id,user_id,'member' FROM identity
      ON CONFLICT (project_id,user_id) DO NOTHING
      RETURNING project_id,user_id
    ), recipient AS MATERIALIZED (
      SELECT id,email,name FROM public.users WHERE lower(email)=${recipient} AND is_active=true LIMIT 1
    ), context_ready AS MATERIALIZED (
      SELECT i.user_id,i.project_id,(SELECT count(*) FROM membership) AS membership_write_count FROM identity i
    ), inserted AS (
      INSERT INTO public.realtime_events(project_id,actor_user_id,topic,event_type,payload)
      SELECT ctx.project_id,ctx.user_id,'chat:direct','chat.message.v1',jsonb_build_object('recipientUserId',recipient.id::text,'text',${body})
      FROM context_ready ctx,recipient
      WHERE ctx.membership_write_count>=0
      RETURNING id,actor_user_id,payload,created_at
    )
    SELECT i.id,s.email AS from_email,COALESCE(NULLIF(s.name,''),s.email) AS from_name,
      r.email AS to_email,COALESCE(NULLIF(r.name,''),r.email) AS to_name,i.payload->>'text' AS text,i.created_at
    FROM inserted i
    JOIN public.users s ON s.id=i.actor_user_id
    JOIN public.users r ON r.id::text=i.payload->>'recipientUserId'`;
  return rows[0]?map(rows[0] as Record<string,unknown>,sender):null;
}
