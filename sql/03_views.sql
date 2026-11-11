-- =====================================================================
-- LabTrace  |  03_views.sql
-- Views (security_invoker = true, so Row-Level Security of the caller
-- is applied to the underlying tables)
-- =====================================================================
SET search_path TO labtrace, public;

-- Incident overview: incident + equipment + lab + reporter + technician
CREATE OR REPLACE VIEW v_incident_overview WITH (security_invoker = true) AS
SELECT i.incident_id, i.title, i.description, i.severity, i.status,
       i.reported_at, i.resolved_at, i.closed_at,
       e.equipment_id, e.asset_tag, e.equipment_name, e.status AS equipment_status,
       c.category_name,
       l.lab_id, l.lab_code, l.lab_name,
       r.user_id  AS reporter_id,   r.full_name AS reporter_name,
       t.user_id  AS technician_id, t.full_name AS technician_name,
       ROUND((EXTRACT(EPOCH FROM (COALESCE(i.resolved_at, now()) - i.reported_at)) / 3600.0)::numeric, 1)
             AS age_or_resolution_hours
FROM   incidents i
JOIN   equipment e            ON e.equipment_id = i.equipment_id
JOIN   equipment_categories c ON c.category_id  = e.category_id
JOIN   labs l                 ON l.lab_id       = e.lab_id
JOIN   users r                ON r.user_id      = i.reported_by
LEFT JOIN assignments a       ON a.incident_id  = i.incident_id AND a.is_active
LEFT JOIN users t             ON t.user_id      = a.technician_id;

-- Equipment reliability (uses the stored functions)
CREATE OR REPLACE VIEW v_equipment_reliability WITH (security_invoker = true) AS
SELECT e.equipment_id, e.asset_tag, e.equipment_name, e.status,
       c.category_name, l.lab_code, l.lab_name, e.purchase_date,
       (SELECT COUNT(*) FROM incidents i WHERE i.equipment_id = e.equipment_id)              AS total_failures,
       (SELECT COUNT(*) FROM incidents i WHERE i.equipment_id = e.equipment_id
                                       AND i.reported_at >= now() - INTERVAL '180 days')      AS failures_180d,
       fn_repeat_failures(e.equipment_id)                                                     AS repeat_failures,
       fn_equipment_mtbf_hours(e.equipment_id)                                                AS mtbf_hours,
       fn_equipment_mttr_hours(e.equipment_id)                                                AS mttr_hours,
       fn_reliability_score(e.equipment_id)                                                   AS reliability_score,
       fn_risk_level(fn_reliability_score(e.equipment_id))                                    AS risk_level,
       fn_predicted_next_failure(e.equipment_id)                                              AS predicted_next_failure,
       COALESCE((SELECT SUM(pu.quantity * pu.unit_cost_at_use)
                   FROM part_usage pu
                   JOIN maintenance_records m ON m.record_id = pu.record_id
                   JOIN incidents i           ON i.incident_id = m.incident_id
                  WHERE i.equipment_id = e.equipment_id), 0)                                  AS parts_cost
FROM   equipment e
JOIN   equipment_categories c ON c.category_id = e.category_id
JOIN   labs l                 ON l.lab_id      = e.lab_id
WHERE  e.status <> 'retired';

-- Technician workload
CREATE OR REPLACE VIEW v_technician_workload WITH (security_invoker = true) AS
SELECT u.user_id AS technician_id, u.full_name,
       (SELECT COUNT(*) FROM assignments a JOIN incidents i ON i.incident_id = a.incident_id
         WHERE a.technician_id = u.user_id AND a.is_active
           AND i.status IN ('assigned','in_progress','reopened'))                 AS active_jobs,
       (SELECT COUNT(*) FROM maintenance_records m WHERE m.technician_id = u.user_id) AS jobs_completed,
       (SELECT ROUND(AVG(m.labour_hours), 2) FROM maintenance_records m
         WHERE m.technician_id = u.user_id)                                       AS avg_labour_hours
FROM   users u
WHERE  u.role = 'technician' AND u.is_active;

-- Spare parts at or below re-order level
CREATE OR REPLACE VIEW v_low_stock_parts WITH (security_invoker = true) AS
SELECT part_id, part_no, part_name, part_category, qty_in_stock, reorder_level,
       (reorder_level * 2 - qty_in_stock) AS suggested_order_qty
FROM   spare_parts
WHERE  qty_in_stock <= reorder_level;
