import Link from 'next/link';
import { requirePageUser } from '@/lib/auth';
import { withUser } from '@/lib/db';
import { analytics } from '@/lib/queries';
import { RiskBadge, ScoreMeter } from '@/components/Badges';
import { fmtDate, inr } from '@/components/format';
import BarChart from '@/components/BarChart';
import ReindexButton from './ReindexButton';

export const dynamic = 'force-dynamic';

function HBars({ rows, label, value, fmt = (v) => v }) {
  const max = Math.max(1, ...rows.map((r) => Number(r[value]) || 0));
  return rows.map((r, i) => (
    <div className="hbar" key={i} title={`${r[label]}: ${fmt(r[value])}`}>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r[label] || 'Unspecified'}</span>
      <div className="track"><div className="fill" style={{ width: `${(Number(r[value]) / max) * 100}%` }} /></div>
      <span className="num" style={{ textAlign: 'right' }}>{fmt(r[value])}</span>
    </div>));
}

export default async function AnalyticsPage() {
  const user = await requirePageUser('admin');
  const a = await withUser(user, (c) => analytics(c));
  return (
    <>
      <div className="page-head">
        <div><h1>Reliability analytics</h1><div className="sub">Computed live in PostgreSQL with views, stored functions, CTEs, recursive and correlated queries.</div></div>
        <ReindexButton />
      </div>
      <div className="grid g4">
        <div className="card stat"><div className="label">Mean time to repair</div><div className="value">{a.kpi.mttr_hours} h</div><div className="hint">report → resolved, all incidents</div></div>
        <div className="card stat"><div className="label">Incidents (30 days)</div><div className="value">{a.kpi.last_30d}</div></div>
        <div className="card stat"><div className="label">High-risk assets</div><div className="value">{a.kpi.high_risk}</div><div className="hint">reliability score below 40</div></div>
        <div className="card stat"><div className="label">Spare parts spent</div><div className="value">{inr(a.kpi.parts_cost)}</div><div className="hint">all recorded repairs</div></div>
      </div>
      <div className="spacer" />
      <div className="grid g2">
        <div className="card"><h2>Incidents per month</h2><BarChart data={a.monthly} labelKey="label" valueKey="incidents" /></div>
        <div className="card"><h2>Spare-parts cost per month (₹)</h2><BarChart data={a.monthly} labelKey="label" valueKey="parts_cost" format={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} /></div>
      </div>
      <div className="spacer" />
      <div className="card">
        <div className="card-head"><h2>Least reliable equipment - candidates for preventive maintenance or replacement</h2></div>
        <div className="table-wrap"><table>
          <thead><tr><th>Asset</th><th>Lab</th><th className="num">Failures</th><th className="num">Last 180 d</th><th className="num">Repeat</th><th className="num">MTBF (days)</th><th className="num">MTTR (h)</th><th>Reliability</th><th>Risk</th><th>Next failure (est.)</th></tr></thead>
          <tbody>{a.reliability.map((r) => (
            <tr key={r.equipment_id}>
              <td><Link className="cell-title" href={`/equipment/${r.equipment_id}`}>{r.asset_tag}</Link><div className="cell-sub">{r.equipment_name}</div></td>
              <td>{r.lab_code}</td>
              <td className="num">{r.total_failures}</td><td className="num">{r.failures_180d}</td><td className="num">{r.repeat_failures}</td>
              <td className="num">{r.mtbf_hours ? Math.round(r.mtbf_hours / 24) : '-'}</td><td className="num">{r.mttr_hours ?? '-'}</td>
              <td><ScoreMeter score={r.reliability_score} /></td><td><RiskBadge value={r.risk_level} /></td>
              <td>{r.predicted_next_failure ? fmtDate(r.predicted_next_failure, false) : '-'}</td>
            </tr>))}</tbody></table></div>
      </div>
      <div className="grid g2" style={{ marginTop: 16 }}>
        <div className="card"><h2>Breakdowns by laboratory</h2><HBars rows={a.labs} label="lab_code" value="incidents" />
          <div className="table-wrap" style={{ marginTop: 10 }}><table>
            <thead><tr><th>Lab</th><th className="num">Incidents</th><th className="num">High / critical</th><th className="num">Avg resolution (h)</th></tr></thead>
            <tbody>{a.labs.map((l) => <tr key={l.lab_code}><td>{l.lab_name}</td><td className="num">{l.incidents}</td><td className="num">{l.serious}</td><td className="num">{l.avg_resolution_hrs ?? '-'}</td></tr>)}</tbody>
          </table></div></div>
        <div className="card"><h2>Top root causes</h2><HBars rows={a.rootCauses} label="root_cause" value="n" />
          <p className="muted small">Average repair effort: {a.rootCauses.map((r) => `${r.root_cause || 'Unspecified'} ${r.avg_hours} h`).join(' · ')}</p></div>
      </div>
      <div className="grid g2" style={{ marginTop: 16 }}>
        <div className="card"><h2>Equipment category tree (recursive CTE)</h2>
          <table><thead><tr><th>Category</th><th className="num">Assets</th><th className="num">Incidents</th></tr></thead>
            <tbody>{a.tree.map((t) => (
              <tr key={t.category_name}><td style={{ paddingLeft: 10 + t.depth * 22, fontWeight: t.depth === 0 ? 700 : 400 }}>{t.depth > 0 && '└ '}{t.category_name}</td>
                <td className="num">{t.assets}</td><td className="num">{t.incidents}</td></tr>))}</tbody></table></div>
        <div>
          <div className="card"><h2>Repeat failures (within 30 days of a repair)</h2>
            {a.repeat.map((r) => (
              <div key={r.incident_id} className="small" style={{ marginBottom: 6 }}>
                <Link href={`/incidents/${r.incident_id}`}>INC-{r.incident_id}</Link> · <b>{r.asset_tag}</b> - {r.title} <span className="muted">({fmtDate(r.reported_at, false)})</span>
              </div>))}</div>
          <div className="card"><h2>Technician performance</h2>
            <table><thead><tr><th>Technician</th><th className="num">Active</th><th className="num">Completed</th><th className="num">Avg hours</th></tr></thead>
              <tbody>{a.techs.map((t) => <tr key={t.technician_id}><td>{t.full_name}</td><td className="num">{t.active_jobs}</td><td className="num">{t.jobs_completed}</td><td className="num">{t.avg_labour_hours ?? '-'}</td></tr>)}</tbody></table></div>
        </div>
      </div>
    </>
  );
}
