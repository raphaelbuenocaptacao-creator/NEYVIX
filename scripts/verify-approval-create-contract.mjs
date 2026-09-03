import fs from 'node:fs';

const route = fs.readFileSync('app/api/automation/approvals/route.ts', 'utf8');
const db = fs.readFileSync('lib/approval-db.ts', 'utf8');
const decisionDb = fs.readFileSync('lib/automation-db.ts', 'utf8');

const checks = [
  ['creation requires active session', route.includes('readActiveSession') && route.includes('status: 401')],
  ['creation requires approvals entitlement', route.includes('getProductAccess(session.email, "approvals")') && route.includes('upgradeRequiredPayload("approvals", "Business")')],
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
console.log(`Approval create/decision contract: ${checks.length}/${checks.length} PASS`);
