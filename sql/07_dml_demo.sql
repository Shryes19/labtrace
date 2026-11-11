-- =====================================================================
-- LabTrace  |  07_dml_demo.sql
-- DML operations (INSERT / UPDATE / DELETE) that exercise the triggers,
-- procedures and Row-Level Security.  Each block runs inside a
-- transaction and is ROLLED BACK so the demo can be repeated.
-- Run:  psql -U labtrace_app -d labtrace -f 07_dml_demo.sql
-- =====================================================================
SET search_path TO labtrace, public;
\set ON_ERROR_STOP off
\echo '================ 1. STUDENT reports an incident (INSERT + trigger) ================'
BEGIN;
SET LOCAL ROLE lt_student;
SELECT set_config('app.user_id', '9', true);           -- Aarav Sharma (student)
INSERT INTO incidents (equipment_id, reported_by, title, description, severity)
VALUES (5, 9, 'Workstation switches off', 'The computer gets too hot and turns off during compilation', 'high')
RETURNING incident_id, status, reported_at;
-- trigger trg_incident_after_insert wrote the first log row and marked equipment faulty
SELECT log_seq, old_status, new_status, remarks FROM incident_status_log
 WHERE incident_id = currval('incidents_incident_id_seq');
SELECT asset_tag, status FROM equipment WHERE equipment_id = 5;
\echo '--- RLS: the student only sees his own incidents'
SELECT COUNT(*) AS my_incidents FROM incidents;
\echo '--- RLS: reporting on behalf of another student is rejected'
SAVEPOINT s1;
INSERT INTO incidents (equipment_id, reported_by, title, description, severity)
VALUES (5, 10, 'Fake', 'Trying to report as someone else', 'low');
ROLLBACK TO s1;
\echo '--- Column privilege: password_hash is not readable'
SAVEPOINT s2;
SELECT password_hash FROM users LIMIT 1;
ROLLBACK TO s2;
ROLLBACK;

\echo '================ 2. ADMIN assigns automatically (PROCEDURE + recursive CTE) ================'
BEGIN;
SET LOCAL ROLE lt_admin;
SELECT set_config('app.user_id', '1', true);
INSERT INTO incidents (equipment_id, reported_by, title, description, severity)
VALUES (12, 9, 'GPU not detected', 'nvidia-smi shows no devices were found after reboot', 'high')
RETURNING incident_id \gset
CALL sp_assign_technician(:incident_id, NULL, 'Auto assigned by procedure');
SELECT a.incident_id, u.full_name AS technician, i.status
  FROM assignments a JOIN users u ON u.user_id = a.technician_id
  JOIN incidents i ON i.incident_id = a.incident_id
 WHERE a.incident_id = :incident_id AND a.is_active;
SELECT log_seq, old_status, new_status, changed_by FROM incident_status_log
 WHERE incident_id = :incident_id ORDER BY log_seq;
ROLLBACK;

\echo '================ 3. TECHNICIAN completes job (PROCEDURE + stock trigger) ================'
BEGIN;
SET LOCAL ROLE lt_admin;
SELECT set_config('app.user_id', '1', true);
INSERT INTO incidents (equipment_id, reported_by, title, description, severity)
VALUES (3, 9, 'PC overheating', 'System suddenly powers off during heavy processing', 'high')
RETURNING incident_id \gset
CALL sp_assign_technician(:incident_id, 3, 'Ravi please check');
SET LOCAL ROLE lt_technician;
SELECT set_config('app.user_id', '3', true);           -- Ravi Kumar (technician)
SELECT part_no, qty_in_stock FROM spare_parts WHERE part_id IN (1, 2);
CALL sp_complete_maintenance(:incident_id, 'Heat sink clogged, CPU at 97C', 'Thermal / cooling',
     'Cleaned heat sink, replaced fan and thermal paste', 'fixed', now() - INTERVAL '90 minutes',
     '[{"part_id":1,"quantity":1},{"part_id":2,"quantity":1}]');
SELECT part_no, qty_in_stock FROM spare_parts WHERE part_id IN (1, 2);      -- stock decremented
SELECT record_id, labour_hours, outcome FROM maintenance_records WHERE incident_id = :incident_id;
SELECT status, resolved_at IS NOT NULL AS has_resolved_time FROM incidents WHERE incident_id = :incident_id;
\echo '--- Trigger blocks using more parts than available'
SAVEPOINT s3;
INSERT INTO part_usage (record_id, part_id, quantity)
SELECT record_id, 8, 99 FROM maintenance_records WHERE incident_id = :incident_id;
ROLLBACK TO s3;
\echo '--- Technician may not close an incident (RLS WITH CHECK)'
SAVEPOINT s4;
UPDATE incidents SET status = 'closed' WHERE incident_id = :incident_id;
ROLLBACK TO s4;
\echo '--- Invalid status jump is rejected by trigger'
SET LOCAL ROLE lt_admin;
SAVEPOINT s5;
UPDATE incidents SET status = 'open' WHERE incident_id = :incident_id;
ROLLBACK TO s5;
ROLLBACK;

\echo '================ 4. ADMIN DML on master data ================'
BEGIN;
SET LOCAL ROLE lt_admin;
SELECT set_config('app.user_id', '1', true);
INSERT INTO labs (lab_code, lab_name, building, floor_no, room_no, capacity)
VALUES ('VLSI-210', 'VLSI Design Lab', 'MRD Block', 2, 'M-210', 30) RETURNING lab_id \gset
INSERT INTO equipment (asset_tag, equipment_name, category_id, lab_id, manufacturer, model_no,
                       serial_no, purchase_date, purchase_cost, warranty_expiry, specifications)
VALUES ('LT-VLSI-900', 'FPGA Workstation #1', 2, :lab_id, 'Dell', 'Precision 3660',
        'SNDEMO900', CURRENT_DATE, 145000, CURRENT_DATE + 1095, '{"fpga":"Xilinx Zynq"}');
UPDATE spare_parts SET unit_cost = unit_cost * 1.05 WHERE part_category = 'Cables';
CALL sp_restock_part(8, 3);
UPDATE users SET is_active = FALSE WHERE institution_id = 'PES1UG24AM220';
DELETE FROM equipment WHERE asset_tag = 'LT-VLSI-900';
\echo '--- Foreign key protects equipment that has incidents'
SAVEPOINT s6;
DELETE FROM equipment WHERE equipment_id = 3;
ROLLBACK TO s6;
\echo '--- CHECK constraint protects data quality'
SAVEPOINT s7;
INSERT INTO spare_parts (part_no, part_name, part_category, unit_cost, qty_in_stock)
VALUES ('BAD-1', 'Negative stock part', 'Test', 10, -5);
ROLLBACK TO s7;
ROLLBACK;
