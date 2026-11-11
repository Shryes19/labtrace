// run async functions one after another and collect results
const seq = async (fns) => { const out = []; for (const f of fns) out.push(await f()); return out; };

// SQL queries used by pages and API routes.  `c` is a pg client obtained
// from withUser(), so Row-Level Security of the current user applies.

// ------------------------------------------------------------- incidents
export async function listIncidents(c, { status, severity, lab, q, mine, userId, limit = 100 } = {}) {
  const where = [];
  const p = [];
  if (status === 'active') where.push(`status IN ('open','assigned','in_progress','reopened')`);
  else if (status) { p.push(status); where.push(`status = $${p.length}`); }
  if (severity) { p.push(severity); where.push(`severity = $${p.length}`); }
  if (lab) { p.push(Number(lab)); where.push(`lab_id = $${p.length}`); }
  if (q) { p.push(`%${q}%`); where.push(`(title ILIKE $${p.length} OR description ILIKE $${p.length} OR asset_tag ILIKE $${p.length})`); }
  if (mine && userId) { p.push(userId); where.push(`technician_id = $${p.length}`); }
  p.push(limit);
  const { rows } = await c.query(
    `SELECT * FROM v_incident_overview
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY CASE status WHEN 'open' THEN 0 WHEN 'reopened' THEN 1 WHEN 'assigned' THEN 2
                          WHEN 'in_progress' THEN 3 WHEN 'resolved' THEN 4 ELSE 5 END,
              reported_at DESC
     LIMIT $${p.length}`, p);
  return rows;
}

export async function getIncidentDetail(c, id) {
  const { rows } = await c.query('SELECT * FROM v_incident_overview WHERE incident_id = $1', [id]);
  if (!rows[0]) return null;
  // run one after another (a pg client can only execute one query at a time)
  const [log, mr, asg] = await seq([
    () => c.query(`SELECT l.*, u.full_name AS changed_by_name, u.role AS changed_by_role
               FROM incident_status_log l LEFT JOIN users u ON u.user_id = l.changed_by
              WHERE l.incident_id = $1 ORDER BY l.log_seq`, [id]),
    () => c.query(`SELECT m.*, u.full_name AS technician_name,
                    COALESCE(json_agg(json_build_object('part_no', sp.part_no, 'part_name', sp.part_name,
                             'quantity', pu.quantity, 'unit_cost', pu.unit_cost_at_use))
                             FILTER (WHERE pu.part_id IS NOT NULL), '[]') AS parts
               FROM maintenance_records m
               JOIN users u ON u.user_id = m.technician_id
               LEFT JOIN part_usage pu ON pu.record_id = m.record_id
               LEFT JOIN spare_parts sp ON sp.part_id = pu.part_id
              WHERE m.incident_id = $1
              GROUP BY m.record_id, u.full_name ORDER BY m.started_at`, [id]),
    () => c.query(`SELECT a.*, t.full_name AS technician_name, b.full_name AS assigned_by_name
               FROM assignments a JOIN users t ON t.user_id = a.technician_id
               LEFT JOIN users b ON b.user_id = a.assigned_by
              WHERE a.incident_id = $1 ORDER BY a.assigned_at`, [id]),
  ]);
  return { ...rows[0], log: log.rows, maintenance: mr.rows, assignments: asg.rows };
}

/** Row shape needed by upsertIncidentKnowledge() (incident + latest repair). */
export async function incidentKnowledgeRow(c, id) {
  const rows = await incidentKnowledgeRows(c, id);
  return rows[0] || null;
}

/** id = null -> all incidents (used by the knowledge-base re-index). */
export async function incidentKnowledgeRows(c, id = null) {
  const { rows } = await c.query(
    `SELECT i.incident_id, i.title, i.description, i.severity, i.status, i.reported_at, i.resolved_at,
            e.equipment_id, e.asset_tag, e.equipment_name, cat.category_name, l.lab_code,
            m.diagnosis, m.root_cause, m.action_taken, m.outcome, t.full_name AS technician_name
       FROM incidents i
       JOIN equipment e ON e.equipment_id = i.equipment_id
       JOIN equipment_categories cat ON cat.category_id = e.category_id
       JOIN labs l ON l.lab_id = e.lab_id
       LEFT JOIN LATERAL (SELECT * FROM maintenance_records mm WHERE mm.incident_id = i.incident_id
                          ORDER BY mm.completed_at DESC LIMIT 1) m ON TRUE
       LEFT JOIN users t ON t.user_id = m.technician_id
      WHERE ($1::int IS NULL OR i.incident_id = $1)
      ORDER BY i.incident_id`, [id]);
  return rows;
}

export async function technicianOptions(c, incidentId) {
  // technicians with skill match (recursive category chain) and workload
  const { rows } = await c.query(
    `WITH RECURSIVE chain AS (
        SELECT e.category_id, ec.parent_id, 0 AS depth
          FROM incidents i JOIN equipment e ON e.equipment_id = i.equipment_id
          JOIN equipment_categories ec ON ec.category_id = e.category_id
         WHERE i.incident_id = $1
        UNION ALL
        SELECT c.category_id, c.parent_id, ch.depth + 1
          FROM equipment_categories c JOIN chain ch ON c.category_id = ch.parent_id)
     SELECT w.technician_id, w.full_name, w.active_jobs,
            (SELECT MAX(s.proficiency) FROM technician_skills s JOIN chain ch ON ch.category_id = s.category_id
              WHERE s.technician_id = w.technician_id) AS skill_level
       FROM v_technician_workload w
      ORDER BY skill_level DESC NULLS LAST, active_jobs, full_name`, [incidentId]);
  return rows;
}

// ------------------------------------------------------------- dashboards
export async function dashboardCounts(c) {
  const { rows } = await c.query(`
    SELECT COUNT(*) FILTER (WHERE status IN ('open','reopened'))           AS open,
           COUNT(*) FILTER (WHERE status IN ('assigned','in_progress'))    AS in_work,
           COUNT(*) FILTER (WHERE status = 'resolved')                     AS resolved,
           COUNT(*) FILTER (WHERE status = 'closed')                       AS closed,
           COUNT(*)                                                        AS total
      FROM incidents`);
  return rows[0];
}

export async function equipmentStatusCounts(c) {
  const { rows } = await c.query(`SELECT status, COUNT(*) AS n FROM equipment GROUP BY status`);
  return Object.fromEntries(rows.map((r) => [r.status, r.n]));
}

// ------------------------------------------------------------- equipment
export async function listEquipment(c, { lab, category, status, q } = {}) {
  const where = [];
  const p = [];
  if (lab) { p.push(Number(lab)); where.push(`e.lab_id = $${p.length}`); }
  if (status) { p.push(status); where.push(`e.status = $${p.length}`); }
  if (category) {
    // include sub-categories (recursive)
    p.push(Number(category));
    where.push(`e.category_id IN (WITH RECURSIVE sub AS (
                  SELECT category_id FROM equipment_categories WHERE category_id = $${p.length}
                  UNION ALL SELECT c.category_id FROM equipment_categories c JOIN sub ON c.parent_id = sub.category_id)
                SELECT category_id FROM sub)`);
  }
  if (q) { p.push(`%${q}%`); where.push(`(e.asset_tag ILIKE $${p.length} OR e.equipment_name ILIKE $${p.length} OR e.model_no ILIKE $${p.length})`); }
  const { rows } = await c.query(
    `SELECT e.*, c.category_name, l.lab_code, l.lab_name,
            (SELECT COUNT(*) FROM incidents i WHERE i.equipment_id = e.equipment_id) AS failures,
            (SELECT COUNT(*) FROM incidents i WHERE i.equipment_id = e.equipment_id
               AND i.status IN ('open','assigned','in_progress','reopened')) AS active_incidents
       FROM equipment e
       JOIN equipment_categories c ON c.category_id = e.category_id
       JOIN labs l ON l.lab_id = e.lab_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY e.asset_tag`, p);
  return rows;
}

export async function getEquipment(c, id) {
  const { rows } = await c.query(
    `SELECT e.*, c.category_name, c.expected_life_years, l.lab_code, l.lab_name, l.building, l.room_no
       FROM equipment e JOIN equipment_categories c ON c.category_id = e.category_id
       JOIN labs l ON l.lab_id = e.lab_id WHERE e.equipment_id = $1`, [id]);
  return rows[0] || null;
}

export async function lookups(c) {
  const [labs, cats] = await seq([
    () => c.query('SELECT lab_id, lab_code, lab_name FROM labs ORDER BY lab_code'),
    () => c.query(`WITH RECURSIVE t AS (
               SELECT category_id, category_name, parent_id, 0 AS depth, ARRAY[category_id] AS path
                 FROM equipment_categories WHERE parent_id IS NULL
               UNION ALL
               SELECT c.category_id, c.category_name, c.parent_id, t.depth + 1, t.path || c.category_id
                 FROM equipment_categories c JOIN t ON c.parent_id = t.category_id)
             SELECT category_id, category_name, depth FROM t ORDER BY path`),
  ]);
  return { labs: labs.rows, categories: cats.rows };
}

// ------------------------------------------------------------- analytics (admin)
export async function analytics(c) {
  const q = (sql, p = []) => c.query(sql, p).then((r) => r.rows);
  const [reliability, labs, monthly, rootCauses, repeat, tree, techs, kpi, lowStock] = await seq([
    () => q(`SELECT * FROM v_equipment_reliability ORDER BY reliability_score ASC, total_failures DESC LIMIT 12`),
    () => q(`SELECT l.lab_code, l.lab_name, COUNT(i.incident_id) AS incidents,
              COUNT(*) FILTER (WHERE i.severity IN ('high','critical')) AS serious,
              ROUND(AVG(EXTRACT(EPOCH FROM (i.resolved_at - i.reported_at))/3600)::numeric, 1) AS avg_resolution_hrs
         FROM labs l JOIN equipment e ON e.lab_id = l.lab_id
         LEFT JOIN incidents i ON i.equipment_id = e.equipment_id
        GROUP BY l.lab_id ORDER BY incidents DESC`),
    () => q(`WITH months AS (
          SELECT generate_series(date_trunc('month', now()) - INTERVAL '11 months', date_trunc('month', now()), INTERVAL '1 month')::date AS month),
        inc AS (SELECT date_trunc('month', reported_at)::date AS month, COUNT(*) AS incidents FROM incidents GROUP BY 1),
        cost AS (SELECT date_trunc('month', m.completed_at)::date AS month, SUM(pu.quantity * pu.unit_cost_at_use) AS parts_cost
                   FROM maintenance_records m JOIN part_usage pu ON pu.record_id = m.record_id GROUP BY 1)
       SELECT to_char(m.month, 'Mon YY') AS label, COALESCE(inc.incidents, 0) AS incidents, COALESCE(cost.parts_cost, 0) AS parts_cost
         FROM months m LEFT JOIN inc USING (month) LEFT JOIN cost USING (month) ORDER BY m.month`),
    () => q(`SELECT root_cause, COUNT(*) AS n, ROUND(AVG(labour_hours), 1) AS avg_hours
         FROM maintenance_records GROUP BY root_cause ORDER BY n DESC LIMIT 8`),
    () => q(`SELECT e.asset_tag, e.equipment_name, cur.incident_id, cur.title, cur.reported_at
         FROM incidents cur JOIN equipment e ON e.equipment_id = cur.equipment_id
        WHERE EXISTS (SELECT 1 FROM incidents prev
                       WHERE prev.equipment_id = cur.equipment_id AND prev.incident_id <> cur.incident_id
                         AND prev.resolved_at IS NOT NULL
                         AND cur.reported_at BETWEEN prev.resolved_at AND prev.resolved_at + INTERVAL '30 days')
        ORDER BY cur.reported_at DESC LIMIT 10`),
    () => q(`WITH RECURSIVE tree AS (
          SELECT category_id, category_name, parent_id, 0 AS depth, ARRAY[category_id] AS id_path
            FROM equipment_categories WHERE parent_id IS NULL
          UNION ALL
          SELECT c.category_id, c.category_name, c.parent_id, t.depth + 1, t.id_path || c.category_id
            FROM equipment_categories c JOIN tree t ON c.parent_id = t.category_id)
       SELECT t.category_name, t.depth,
              (SELECT COUNT(*) FROM equipment e JOIN tree d ON d.category_id = e.category_id
                WHERE t.category_id = ANY (d.id_path)) AS assets,
              (SELECT COUNT(*) FROM incidents i JOIN equipment e ON e.equipment_id = i.equipment_id
                 JOIN tree d ON d.category_id = e.category_id
                WHERE t.category_id = ANY (d.id_path)) AS incidents
         FROM tree t ORDER BY t.id_path`),
    () => q(`SELECT * FROM v_technician_workload ORDER BY jobs_completed DESC`),
    () => q(`SELECT ROUND(AVG(EXTRACT(EPOCH FROM (resolved_at - reported_at))/3600)::numeric, 1) AS mttr_hours,
              COUNT(*) FILTER (WHERE reported_at >= now() - INTERVAL '30 days') AS last_30d,
              (SELECT COALESCE(SUM(quantity * unit_cost_at_use), 0) FROM part_usage) AS parts_cost,
              (SELECT COUNT(*) FROM v_equipment_reliability WHERE risk_level = 'High') AS high_risk
         FROM incidents`),
    () => q(`SELECT * FROM v_low_stock_parts ORDER BY qty_in_stock`),
  ]);
  return { reliability, labs, monthly, rootCauses, repeat, tree, techs, kpi: kpi[0], lowStock };
}
