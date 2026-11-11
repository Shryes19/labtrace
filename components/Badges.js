const STATUS = {
  open: ['b-bad', 'Open'], reopened: ['b-bad', 'Reopened'], assigned: ['b-violet', 'Assigned'],
  in_progress: ['b-warn', 'In progress'], resolved: ['b-good', 'Resolved'], closed: ['b-muted', 'Closed'],
};
const SEVERITY = { low: ['b-muted', 'Low'], medium: ['b-info', 'Medium'], high: ['b-warn', 'High'], critical: ['b-bad', 'Critical'] };
const EQUIP = {
  operational: ['b-good', 'Operational'], faulty: ['b-bad', 'Faulty'],
  under_maintenance: ['b-warn', 'Under maintenance'], retired: ['b-muted', 'Retired'],
};
const RISK = { Low: ['b-good', 'Low risk'], Medium: ['b-warn', 'Medium risk'], High: ['b-bad', 'High risk'], Unknown: ['b-muted', 'Unknown'] };

const make = (map) => function Badge({ value }) {
  const [cls, label] = map[value] || ['b-muted', value];
  return <span className={`badge ${cls}`}>{label}</span>;
};
export const StatusBadge = make(STATUS);
export const SeverityBadge = make(SEVERITY);
export const EquipmentBadge = make(EQUIP);
export const RiskBadge = make(RISK);

export function ScoreMeter({ score }) {
  if (score === null || score === undefined) return <span className="muted">-</span>;
  const color = score >= 70 ? 'var(--good)' : score >= 40 ? '#d08a00' : 'var(--bad)';
  return (
    <span>
      <span className="risk-meter"><span style={{ width: `${score}%`, background: color }} /></span>
      <b>{Number(score).toFixed(0)}</b><span className="muted">/100</span>
    </span>
  );
}
