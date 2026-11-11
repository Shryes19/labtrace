import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePageUser } from '@/lib/auth';
import { withUser } from '@/lib/db';
import { getIncidentDetail, technicianOptions } from '@/lib/queries';
import { semanticSearch, getIncidentKnowledge, safely } from '@/lib/knowledge';
import { StatusBadge, SeverityBadge, EquipmentBadge } from '@/components/Badges';
import { fmtDate, inr, titleCase } from '@/components/format';
import SimilarList from '@/components/SimilarList';
import { AssignPanel, TechnicianPanel, ReporterPanel, AdminStatusPanel, NotesPanel, KnowledgeAdmin } from './Actions';

export const dynamic = 'force-dynamic';

export default async function IncidentPage({ params, searchParams }) {
  const user = await requirePageUser();
  const { id } = await params;
  const sp = await searchParams;
  const data = await withUser(user, async (c) => {
    const inc = await getIncidentDetail(c, Number(id));
    if (!inc) return null;
    const techs = user.role === 'admin' ? await technicianOptions(c, inc.incident_id) : [];
    const parts = user.role === 'technician'
      ? (await c.query('SELECT part_id, part_no, part_name, qty_in_stock FROM spare_parts WHERE qty_in_stock > 0 ORDER BY part_name')).rows : [];
    return { inc, techs, parts };
  });
  if (!data) notFound();
  const { inc, techs, parts } = data;

  const text = `${inc.title}. ${inc.description}`;
  const [similar, articles, kdoc] = await Promise.all([
    safely(() => semanticSearch(text, { scope: 'incidents', k: 4, onlyResolved: true, excludeIncidentId: inc.incident_id }), null),
    safely(() => semanticSearch(text, { scope: 'articles', k: 2 }), []),
    safely(() => getIncidentKnowledge(inc.incident_id), null),
  ]);

  const activeTech = inc.assignments.find((a) => a.is_active);
  const isMyJob = user.role === 'technician' && activeTech?.technician_id === user.id;
  const isReporter = inc.reporter_id === user.id;

  return (
    <>
      {sp.created && <div className="alert ok">Incident reported. The lab administrator will assign a technician.</div>}
      <div className="page-head">
        <div>
          <div className="muted small"><Link href="/incidents">Incidents</Link> / INC-{inc.incident_id}</div>
          <h1>{inc.title}</h1>
          <div className="sub" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <StatusBadge value={inc.status} /> <SeverityBadge value={inc.severity} />
            <span>reported by {inc.reporter_name} · {fmtDate(inc.reported_at)}</span>
          </div>
        </div>
      </div>

      <div className="grid g-main">
        <div>
          <div className="card">
            <h2>Problem description</h2>
            <p style={{ marginTop: 0, whiteSpace: 'pre-wrap' }}>{inc.description}</p>
            <dl className="kv">
              <dt>Equipment</dt><dd><Link href={`/equipment/${inc.equipment_id}`}>{inc.asset_tag}</Link> - {inc.equipment_name} <EquipmentBadge value={inc.equipment_status} /></dd>
              <dt>Category</dt><dd>{inc.category_name}</dd>
              <dt>Laboratory</dt><dd>{inc.lab_code} - {inc.lab_name}</dd>
              <dt>Technician</dt><dd>{inc.technician_name || <span className="muted">Not assigned yet</span>}</dd>
              <dt>{inc.resolved_at ? 'Resolution time' : 'Open for'}</dt><dd>{inc.age_or_resolution_hours} hours</dd>
              {inc.closed_at && (<><dt>Closed</dt><dd>{fmtDate(inc.closed_at)}</dd></>)}
            </dl>
          </div>

          {user.role === 'admin' && !['resolved', 'closed'].includes(inc.status) && (
            <AssignPanel incidentId={inc.incident_id} techs={techs} current={activeTech?.technician_id} />
          )}
          {isMyJob && <TechnicianPanel inc={inc} parts={parts} />}
          {isReporter && ['resolved', 'closed'].includes(inc.status) && <ReporterPanel inc={inc} />}
          {user.role === 'admin' && <AdminStatusPanel inc={inc} />}

          <div className="card">
            <h2>Maintenance records</h2>
            {inc.maintenance.length === 0 ? <div className="muted">No repair work recorded yet.</div> : inc.maintenance.map((m) => (
              <div key={m.record_id} className="result">
                <div className="result-head">
                  <b>{m.technician_name}</b>
                  <span className={`badge ${m.outcome === 'fixed' || m.outcome === 'replaced' ? 'b-good' : 'b-warn'}`}>{titleCase(m.outcome)}</span>
                </div>
                <dl className="kv" style={{ marginTop: 8 }}>
                  <dt>Diagnosis</dt><dd>{m.diagnosis}</dd>
                  <dt>Root cause</dt><dd>{m.root_cause || '-'}</dd>
                  <dt>Action taken</dt><dd>{m.action_taken}</dd>
                  <dt>Work time</dt><dd>{fmtDate(m.started_at)} → {fmtDate(m.completed_at)} ({m.labour_hours} h)</dd>
                  {m.parts.length > 0 && (<><dt>Parts used</dt><dd>{m.parts.map((p) => (
                    <div key={p.part_no}>{p.quantity} × {p.part_name} <span className="muted">({inr(p.unit_cost)} each)</span></div>))}</dd></>)}
                </dl>
              </div>))}
          </div>

          <NotesPanel incidentId={inc.incident_id} notes={kdoc?.notes || []} available={!!kdoc} />
        </div>

        <div>
          <div className="card">
            <h2>Status history</h2>
            <ul className="timeline">
              {inc.log.map((l) => (
                <li key={l.log_seq}>
                  <div><b>{titleCase(l.new_status)}</b>{l.old_status && <span className="muted"> from {titleCase(l.old_status)}</span>}</div>
                  <div className="cell-sub">{fmtDate(l.changed_at)}{l.changed_by_name && ` · ${l.changed_by_name}`}</div>
                  {l.remarks && <div className="small">{l.remarks}</div>}
                </li>))}
            </ul>
          </div>
          <div className="card">
            <h2>Similar resolved incidents</h2>
            <p className="muted small" style={{ marginTop: -6 }}>Found by vector similarity of the problem description (MongoDB).</p>
            {similar === null ? <div className="alert info">Knowledge base is not reachable right now.</div>
              : <SimilarList data={{ incidents: similar, articles }} role={user.role} />}
          </div>
          {user.role !== 'student' && kdoc && <KnowledgeAdmin incidentId={inc.incident_id} tags={kdoc.tags || []} role={user.role} />}
        </div>
      </div>
    </>
  );
}
