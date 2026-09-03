import fs from 'node:fs';

const route = fs.readFileSync('app/api/automation/approvals/route.ts', 'utf8');
const db = fs.readFileSync('lib/approval-db.ts', 'utf8');
const decisionDb = fs.readFileSync('lib/automation-db.ts', 'utf8');

const checks = [
  ['approval API requires active session', route.includes('readActiveSession') && route.includes('status: 401')],
  ['approval API requires approvals entitlement', route.includes('getProductAccess(session.email, "approvals")') && route.includes('upgradeRequiredPayload("approvals", "Business")')],
  ['GET exposes bounded self approval inbox', route.includes('export async function GET()') && route.includes('listSelfApprovals(auth.session.email)')],
  ['inbox filters by requester or assignee', db.includes('r.requested_by = u.id OR r.assigned_to = u.id')],
  ['inbox resolves active user by authenticated email', db.includes('lower(u.email) = ${normalizedEmail}') && db.includes('COALESCE(u.is_active, true) = true')],
  ['inbox is bounded to 50 rows', db.includes('Math.min(Math.trunc(limit) || 50, 50)') && db.includes('LIMIT ${boundedLimit}')],
  ['creation validates bounded title', route.includes('MAX_TITLE') && route.includes('!title || title.length > MAX_TITLE')],
  ['creation validates JSON object payload', route.includes('Payload deve ser um objeto JSON')],
  ['creation bounds payload size', route.includes('MAX_PAYLOAD_BYTES') && route.includes('Buffer.byteLength')],
  ['persistence resolves user by authenticated email', db.includes('lower(u.email) = ${normalizedEmail}')],
  ['self approval is assigned to requester', db.includes('u.id,\n      u.id,')],
  ['payload is typed jsonb', db.includes('${payloadJson}::jsonb')],
  ['decision only accepts pending approvals', decisionDb.includes("r.status = 'pending'")],
  ['decision enforces assignee or self-requester ownership', decisionDb.includes('r.assigned_to = u.id') && decisionDb.includes('r.requested_by = u.id')],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}`);
if (failed.length) process.exit(1);
console.log(`Approval inbox/create/decision contract: ${checks.length}/${checks.length} PASS`);
