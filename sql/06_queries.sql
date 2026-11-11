-- =====================================================================
-- LabTrace  |  06_queries.sql
-- Analytical SQL: JOIN, NESTED, CORRELATED, RECURSIVE, CTE, aggregate,
-- window functions and set operations.  (Most are used by the web app's
-- Analytics page - see web/lib/queries.js)
-- =====================================================================
SET search_path TO labtrace, public;

-- ---------------------------------------------------------------------
-- Q1 (JOIN - 5 tables) : full history of one asset
-- ---------------------------------------------------------------------
SELECT e.asset_tag, i.incident_id, i.title, i.severity, i.status,
       t.full_name AS technician, m.diagnosis, m.action_taken, m.labour_hours
FROM   equipment e
JOIN   incidents i                ON i.equipment_id = e.equipment_id
LEFT JOIN assignments a           ON a.incident_id  = i.incident_id AND a.is_active
LEFT JOIN users t                 ON t.user_id      = a.technician_id
LEFT JOIN maintenance_records m   ON m.incident_id  = i.incident_id
WHERE  e.asset_tag = 'LT-CSL-003'
ORDER  BY i.reported_at DESC;

-- ---------------------------------------------------------------------
-- Q2 (JOIN + GROUP BY + HAVING) : labs with the most breakdowns
-- ---------------------------------------------------------------------
SELECT l.lab_code, l.lab_name,
       COUNT(i.incident_id)                                   AS total_incidents,
       COUNT(*) FILTER (WHERE i.severity IN ('high','critical')) AS serious_incidents,
       ROUND(AVG(EXTRACT(EPOCH FROM (i.resolved_at - i.reported_at))/3600)::numeric, 1) AS avg_resolution_hrs
FROM   labs l
JOIN   equipment e ON e.lab_id = l.lab_id
JOIN   incidents i ON i.equipment_id = e.equipment_id
GROUP  BY l.lab_id, l.lab_code, l.lab_name
HAVING COUNT(i.incident_id) > 5
ORDER  BY total_incidents DESC;

-- ---------------------------------------------------------------------
-- Q3 (LEFT OUTER JOIN) : equipment that has NEVER failed
-- ---------------------------------------------------------------------
SELECT e.asset_tag, e.equipment_name, l.lab_code
FROM   equipment e
JOIN   labs l           ON l.lab_id = e.lab_id
LEFT JOIN incidents i   ON i.equipment_id = e.equipment_id
WHERE  i.incident_id IS NULL
ORDER  BY e.asset_tag;

-- ---------------------------------------------------------------------
-- Q4 (NESTED sub-query) : assets whose failure count is above the
--     average failure count of all assets
-- ---------------------------------------------------------------------
SELECT e.asset_tag, e.equipment_name, COUNT(*) AS failures
FROM   equipment e JOIN incidents i ON i.equipment_id = e.equipment_id
GROUP  BY e.equipment_id, e.asset_tag, e.equipment_name
HAVING COUNT(*) > (SELECT AVG(cnt)
                   FROM (SELECT COUNT(*) AS cnt FROM incidents GROUP BY equipment_id) x)
ORDER  BY failures DESC;

-- ---------------------------------------------------------------------
-- Q5 (NESTED with IN) : technicians who have used a 'Power' category part
-- ---------------------------------------------------------------------
SELECT user_id, full_name
FROM   users
WHERE  role = 'technician'
  AND  user_id IN (SELECT m.technician_id
                   FROM   maintenance_records m
                   WHERE  m.record_id IN (SELECT pu.record_id
                                          FROM   part_usage pu
                                          JOIN   spare_parts sp ON sp.part_id = pu.part_id
                                          WHERE  sp.part_category = 'Power'));

-- ---------------------------------------------------------------------
-- Q6 (CORRELATED sub-query) : for every equipment, its most recent
--     incident (incident whose reported_at is the max for that asset)
-- ---------------------------------------------------------------------
SELECT e.asset_tag, i.incident_id, i.title, i.reported_at
FROM   incidents i
JOIN   equipment e ON e.equipment_id = i.equipment_id
WHERE  i.reported_at = (SELECT MAX(i2.reported_at)
                        FROM   incidents i2
                        WHERE  i2.equipment_id = i.equipment_id)   -- correlated
ORDER  BY i.reported_at DESC
LIMIT  15;

-- ---------------------------------------------------------------------
-- Q7 (CORRELATED + EXISTS) : repeat failures - incidents reported within
--     30 days after an earlier incident on the same asset was resolved
-- ---------------------------------------------------------------------
SELECT e.asset_tag, cur.incident_id, cur.title, cur.reported_at
FROM   incidents cur
JOIN   equipment e ON e.equipment_id = cur.equipment_id
WHERE  EXISTS (SELECT 1 FROM incidents prev
               WHERE  prev.equipment_id = cur.equipment_id
                 AND  prev.incident_id <> cur.incident_id
                 AND  prev.resolved_at IS NOT NULL
                 AND  cur.reported_at BETWEEN prev.resolved_at AND prev.resolved_at + INTERVAL '30 days')
ORDER  BY e.asset_tag, cur.reported_at;

-- ---------------------------------------------------------------------
-- Q8 (CORRELATED in SELECT list) : technicians faster than the overall
--     average repair time
-- ---------------------------------------------------------------------
SELECT u.full_name,
       (SELECT ROUND(AVG(m.labour_hours),2) FROM maintenance_records m WHERE m.technician_id = u.user_id) AS avg_hours
FROM   users u
WHERE  u.role = 'technician'
  AND  (SELECT AVG(m.labour_hours) FROM maintenance_records m WHERE m.technician_id = u.user_id)
       < (SELECT AVG(labour_hours) FROM maintenance_records);

-- ---------------------------------------------------------------------
-- Q9 (RECURSIVE CTE) : complete equipment category tree with path,
--     depth and number of assets under every node (including children)
-- ---------------------------------------------------------------------
WITH RECURSIVE tree AS (
    SELECT category_id, category_name, parent_id, 0 AS depth,
           category_name::TEXT AS path, ARRAY[category_id] AS id_path
    FROM   equipment_categories WHERE parent_id IS NULL
    UNION ALL
    SELECT c.category_id, c.category_name, c.parent_id, t.depth + 1,
           t.path || ' > ' || c.category_name, t.id_path || c.category_id
    FROM   equipment_categories c JOIN tree t ON c.parent_id = t.category_id
)
SELECT repeat('    ', t.depth) || t.category_name AS category, t.path, t.depth,
       (SELECT COUNT(*) FROM equipment e
          JOIN tree d ON d.category_id = e.category_id
         WHERE t.category_id = ANY (d.id_path))  AS assets_in_subtree
FROM   tree t
ORDER  BY t.id_path;

-- ---------------------------------------------------------------------
-- Q10 (RECURSIVE CTE) : status time-line of an incident walking the
--      weak entity incident_status_log seq -> seq+1
-- ---------------------------------------------------------------------
WITH RECURSIVE timeline AS (
    SELECT incident_id, log_seq, old_status, new_status, changed_at,
           INTERVAL '0' AS since_previous
    FROM   incident_status_log WHERE incident_id = 1 AND log_seq = 1
    UNION ALL
    SELECT l.incident_id, l.log_seq, l.old_status, l.new_status, l.changed_at,
           l.changed_at - t.changed_at
    FROM   incident_status_log l JOIN timeline t
      ON   l.incident_id = t.incident_id AND l.log_seq = t.log_seq + 1
)
SELECT * FROM timeline ORDER BY log_seq;

-- ---------------------------------------------------------------------
-- Q11 (multiple CTEs) : monthly incident trend + maintenance cost
-- ---------------------------------------------------------------------
WITH monthly_incidents AS (
    SELECT date_trunc('month', reported_at)::date AS month, COUNT(*) AS incidents
    FROM   incidents GROUP BY 1
),
monthly_cost AS (
    SELECT date_trunc('month', m.completed_at)::date AS month,
           SUM(pu.quantity * pu.unit_cost_at_use)     AS parts_cost
    FROM   maintenance_records m JOIN part_usage pu ON pu.record_id = m.record_id
    GROUP  BY 1
)
SELECT mi.month, mi.incidents, COALESCE(mc.parts_cost, 0) AS parts_cost
FROM   monthly_incidents mi LEFT JOIN monthly_cost mc USING (month)
ORDER  BY mi.month DESC
LIMIT  12;

-- ---------------------------------------------------------------------
-- Q12 (WINDOW functions) : rank root causes inside every category
-- ---------------------------------------------------------------------
SELECT category_name, root_cause, occurrences,
       RANK() OVER (PARTITION BY category_name ORDER BY occurrences DESC) AS rank_in_category
FROM (
    SELECT c.category_name, m.root_cause, COUNT(*) AS occurrences
    FROM   maintenance_records m
    JOIN   incidents i            ON i.incident_id = m.incident_id
    JOIN   equipment e            ON e.equipment_id = i.equipment_id
    JOIN   equipment_categories c ON c.category_id = e.category_id
    GROUP  BY c.category_name, m.root_cause
) s
ORDER  BY category_name, rank_in_category;

-- ---------------------------------------------------------------------
-- Q13 (SET operation - UNION) : everything that needs attention today
-- ---------------------------------------------------------------------
SELECT 'Unassigned incident' AS item, 'INC-' || incident_id AS ref, title AS detail
FROM   incidents WHERE status IN ('open','reopened')
UNION ALL
SELECT 'Low stock part', part_no, part_name || ' (stock ' || qty_in_stock || ')'
FROM   spare_parts WHERE qty_in_stock <= reorder_level
UNION ALL
SELECT 'High-risk asset', asset_tag, equipment_name || ' (score ' || reliability_score || ')'
FROM   v_equipment_reliability WHERE risk_level = 'High';

-- ---------------------------------------------------------------------
-- Q14 (SET operation - EXCEPT) : skilled technicians that currently have
--      no active job
-- ---------------------------------------------------------------------
SELECT DISTINCT technician_id FROM technician_skills
EXCEPT
SELECT technician_id FROM assignments a JOIN incidents i ON i.incident_id = a.incident_id
WHERE  a.is_active AND i.status IN ('assigned','in_progress','reopened');

-- ---------------------------------------------------------------------
-- Q15 (JSONB) : GPU workstations with at least 24 GB GPU memory listed
-- ---------------------------------------------------------------------
SELECT asset_tag, specifications->>'gpu' AS gpu, (specifications->>'ram_gb')::int AS ram_gb
FROM   equipment
WHERE  specifications ? 'gpu' AND specifications->>'gpu' LIKE '%24GB%';

-- ---------------------------------------------------------------------
-- Q16 Functions & views
-- ---------------------------------------------------------------------
SELECT asset_tag, total_failures, repeat_failures, mtbf_hours, mttr_hours,
       reliability_score, risk_level, predicted_next_failure
FROM   v_equipment_reliability
ORDER  BY reliability_score ASC
LIMIT  10;
