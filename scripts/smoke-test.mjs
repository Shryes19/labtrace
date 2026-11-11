// End-to-end API test of the main workflow and the role-based access rules.
// Start the app first (npm run dev / npm start), then:  npm run test:smoke
const BASE = process.env.BASE_URL || 'http://localhost:3000';
const PASSWORD = 'Password@123';
let passed = 0, failed = 0;

async function login(email) {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: PASSWORD }),
  });
  const cookie = r.headers.get('set-cookie')?.split(';')[0];
  if (!r.ok || !cookie) throw new Error(`login failed for ${email}`);
  return (path, opts = {}) => fetch(`${BASE}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', cookie, ...(opts.headers || {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  }).then(async (res) => ({ status: res.status, data: await res.json().catch(() => ({})) }));
}

function check(name, cond, extra = '') {
  if (cond) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name} ${extra}`); }
}

console.log(`LabTrace smoke test against ${BASE}\n`);
const anon = await fetch(`${BASE}/api/incidents`);
check('anonymous API call is rejected (401)', anon.status === 401);
const bad = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@labtrace.edu', password: 'wrong' }) });
check('wrong password is rejected (401)', bad.status === 401);

const student = await login('student@labtrace.edu');
const tech = await login('tech@labtrace.edu');
const admin = await login('admin@labtrace.edu');

// --- RBAC / RLS
const sList = await student('/api/incidents');
check('student sees only own incidents (RLS)', sList.status === 200 && sList.data.incidents.every((i) => i.reporter_id === 9), `n=${sList.data.incidents?.length}`);
const aList = await admin('/api/incidents?limit=500');
check('admin sees more incidents than student', aList.data.incidents.length > sList.data.incidents.length);
check('student cannot create equipment (403)', (await student('/api/equipment', { method: 'POST', body: {} })).status === 403);
check('technician cannot assign (403)', (await tech('/api/incidents/1/assign', { method: 'POST', body: {} })).status === 403);
check('student cannot delete KB article (403)', (await student('/api/knowledge/articles/000000000000000000000000', { method: 'DELETE' })).status === 403);
const other = aList.data.incidents.find((i) => i.reporter_id !== 9);
check('student cannot open another student\'s incident (404 via RLS)', (await student(`/api/incidents/${other.incident_id}`)).status === 404);

// --- full workflow
const created = await student('/api/incidents', { method: 'POST', body: {
  equipment_id: 4, title: 'Desktop powers off when compiling', description: 'The system becomes really hot and suddenly switches off after 15 minutes of compiling.', severity: 'high' } });
check('student reports an incident', created.status === 200 && created.data.incident_id, JSON.stringify(created.data));
const id = created.data.incident_id;

const sim = await student('/api/knowledge/similar', { method: 'POST', body: { text: 'computer gets too hot and turns off' } });
check('semantic search finds similar past incidents', sim.status === 200 && sim.data.incidents.length > 0);
check('students do not receive repair details', sim.data.incidents.every((r) => r.resolution === undefined));

const asg = await admin(`/api/incidents/${id}/assign`, { method: 'POST', body: { technician_id: 3, notes: 'smoke test' } });
check('admin assigns technician (stored procedure)', asg.status === 200 && asg.data.technician_id === 3, JSON.stringify(asg.data));
check('student cannot close an unresolved incident (RLS)', (await student(`/api/incidents/${id}/status`, { method: 'PATCH', body: { status: 'closed' } })).status === 403);

const parts = (await tech('/api/parts')).data.parts;
const paste = parts.find((p) => p.part_no === 'SP-TP-001');
const mr = await tech(`/api/incidents/${id}/maintenance`, { method: 'POST', body: {
  diagnosis: 'CPU reached 97 C, heat sink clogged', root_cause: 'Thermal / cooling',
  action_taken: 'Cleaned heat sink and re-applied thermal paste', outcome: 'fixed',
  started_at: new Date(Date.now() - 2 * 3600e3).toISOString(), parts: [{ part_id: paste.part_id, quantity: 1 }] } });
check('technician records maintenance (procedure + trigger)', mr.status === 200, JSON.stringify(mr.data));
const paste2 = (await tech('/api/parts')).data.parts.find((p) => p.part_no === 'SP-TP-001');
check('stock decremented by trigger', paste2.qty_in_stock === paste.qty_in_stock - 1);
const tooMany = await tech(`/api/incidents/${id}/maintenance`, { method: 'POST', body: { diagnosis: 'x again', action_taken: 'y again', outcome: 'fixed', parts: [] } });
check('cannot record maintenance on resolved incident', tooMany.status === 400);

const detail = (await student(`/api/incidents/${id}`)).data.incident;
check('incident is resolved', detail.status === 'resolved');
check('status log written by triggers (open→assigned→in_progress→resolved)', detail.log.map((l) => l.new_status).join(',') === 'open,assigned,in_progress,resolved');
check('technician cannot close (RLS WITH CHECK)', (await tech(`/api/incidents/${id}/status`, { method: 'PATCH', body: { status: 'closed' } })).status === 403);
check('reporter closes incident', (await student(`/api/incidents/${id}/status`, { method: 'PATCH', body: { status: 'closed', remark: 'works now' } })).status === 200);
check('invalid transition rejected by trigger', (await admin(`/api/incidents/${id}/status`, { method: 'PATCH', body: { status: 'in_progress' } })).status === 400);

// --- MongoDB knowledge base: create / read / update / delete
const note = await student(`/api/incidents/${id}/notes`, { method: 'POST', body: { text: 'Thanks, it works.' } });
check('add note to incident document ($push)', note.status === 200);
const kdoc = await tech(`/api/knowledge/incidents/${id}`);
check('incident knowledge document contains the resolution', kdoc.data.document?.resolution?.includes('thermal paste'));
const art = await tech('/api/knowledge/articles', { method: 'POST', body: { title: 'Smoke test article', body: 'This article is created by the automated smoke test.', category: 'Test', tags: 'test, smoke' } });
check('technician creates article', art.status === 200 && art.data.id);
check('read article', (await student(`/api/knowledge/articles/${art.data.id}`)).data.article?.title === 'Smoke test article');
check('update article', (await tech(`/api/knowledge/articles/${art.data.id}`, { method: 'PATCH', body: { title: 'Smoke test article (edited)' } })).status === 200);
check('technician cannot delete article (403)', (await tech(`/api/knowledge/articles/${art.data.id}`, { method: 'DELETE' })).status === 403);
check('admin deletes article', (await admin(`/api/knowledge/articles/${art.data.id}`, { method: 'DELETE' })).status === 200);
check('deleted article is gone (404)', (await admin(`/api/knowledge/articles/${art.data.id}`)).status === 404);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
