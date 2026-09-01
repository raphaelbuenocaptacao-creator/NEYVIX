import fs from 'node:fs';
const read=(p)=>fs.readFileSync(p,'utf8');
const files={db:read('lib/docs-db.ts'),api:read('app/api/docs/route.ts'),page:read('app/docs/page.tsx'),layout:read('app/docs/layout.tsx'),schema:read('database/002_ecosystem.sql')};
const checks=[
['documents schema foundation exists',/create table if not exists documents/i.test(files.schema)],
['docs list scopes by owner email and active account',/JOIN public\.users u[\s\S]*lower\(u\.email\)[\s\S]*u\.is_active=true/i.test(files.db)],
['docs create resolves active owner',/INSERT INTO public\.documents[\s\S]*public\.users[\s\S]*is_active=true/i.test(files.db)],
['docs update enforces ownership',/UPDATE public\.documents d[\s\S]*u\.id=d\.owner_user_id[\s\S]*lower\(u\.email\)/i.test(files.db)],
['docs update uses optimistic version lock',/d\.version=\$\{expectedVersion\}/i.test(files.db)&&/version=d\.version\+1/i.test(files.db)],
['docs delete enforces ownership',/DELETE FROM public\.documents d[\s\S]*u\.id=d\.owner_user_id/i.test(files.db)],
['docs API requires active session',/readActiveSession/.test(files.api)],
['docs API validates UUID',/UUID_RE\.test\(id\)/.test(files.api)],
['docs API caps title',/160/.test(files.api)],
['docs API caps body',/200000/.test(files.api)],
['docs API returns private headers',/Cache-Control.*no-store/.test(files.api)&&/Referrer-Policy.*no-referrer/.test(files.api)],
['docs conflict is explicit',/status:409/.test(files.api)],
['docs route protected before render',/requireActiveSession\('\/docs'\)/.test(files.layout)],
['docs UI can create',/method:'POST'/.test(files.page)],
['docs UI can save with version',/method:'PUT'[\s\S]*version:active\.version/.test(files.page)],
['docs UI can delete',/method:'DELETE'/.test(files.page)],
['docs UI exposes accessible error',/role="alert"[\s\S]*aria-live="assertive"/.test(files.page)],
['docs UI exposes accessible status',/role="status"[\s\S]*aria-live="polite"/.test(files.page)],
];
let failed=0;for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)failed++;}if(failed){console.error(`Docs contract failed: ${failed}/${checks.length}`);process.exit(1);}console.log(`Docs contract passed: ${checks.length}/${checks.length}`);
