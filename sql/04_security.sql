-- =====================================================================
-- LabTrace  |  04_security.sql
-- Role-Based Access Control INSIDE the database:
--   * three group roles  lt_student / lt_technician / lt_admin
--   * one login role     labtrace_app  (used by the Next.js backend)
--     - NOINHERIT: it has no table rights of its own.  For every request
--       the backend runs  SET LOCAL ROLE lt_<role>  so PostgreSQL itself
--       enforces what that user may see and change.
--   * column-level privileges (password_hash hidden)
--   * Row-Level Security policies (students see only their own data, ...)
-- Run as a superuser / role with CREATEROLE.
-- =====================================================================
SET search_path TO labtrace, public;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lt_student')    THEN CREATE ROLE lt_student    NOLOGIN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lt_technician') THEN CREATE ROLE lt_technician NOLOGIN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lt_admin')      THEN CREATE ROLE lt_admin      NOLOGIN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'labtrace_app')  THEN
        CREATE ROLE labtrace_app LOGIN NOINHERIT PASSWORD 'labtrace_app';
    END IF;
END $$;

GRANT lt_student, lt_technician, lt_admin TO labtrace_app;

-- ---------- schema & helper functions ----------
GRANT USAGE ON SCHEMA labtrace TO labtrace_app, lt_student, lt_technician, lt_admin;

REVOKE ALL ON FUNCTION fn_auth_lookup(TEXT)                          FROM PUBLIC;
REVOKE ALL ON FUNCTION fn_register_student(TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_auth_lookup(TEXT)                          TO labtrace_app;
GRANT EXECUTE ON FUNCTION fn_register_student(TEXT,TEXT,TEXT,TEXT,TEXT) TO labtrace_app;

REVOKE ALL ON PROCEDURE sp_assign_technician(INT, INT, TEXT) FROM PUBLIC;
REVOKE ALL ON PROCEDURE sp_complete_maintenance(INT,TEXT,TEXT,TEXT,TEXT,TIMESTAMPTZ,JSONB,INT) FROM PUBLIC;
REVOKE ALL ON PROCEDURE sp_restock_part(INT, INT) FROM PUBLIC;
GRANT EXECUTE ON PROCEDURE sp_assign_technician(INT, INT, TEXT) TO lt_admin;
GRANT EXECUTE ON PROCEDURE sp_complete_maintenance(INT,TEXT,TEXT,TEXT,TEXT,TIMESTAMPTZ,JSONB,INT) TO lt_technician, lt_admin;
GRANT EXECUTE ON PROCEDURE sp_restock_part(INT, INT) TO lt_admin;

-- ---------- common read access (all roles) ----------
GRANT SELECT ON labs, equipment_categories, equipment, spare_parts, technician_skills
      TO lt_student, lt_technician;
-- column-level privilege: password_hash is NOT readable by students / technicians
GRANT SELECT (user_id, institution_id, full_name, email, role, department, is_active, created_at)
      ON users TO lt_student, lt_technician;
GRANT SELECT, INSERT, DELETE ON user_phones TO lt_student, lt_technician;

-- ---------- STUDENT ----------
GRANT SELECT                                                    ON incidents TO lt_student;
GRANT INSERT (equipment_id, reported_by, title, description, severity) ON incidents TO lt_student;
GRANT UPDATE (status)                                           ON incidents TO lt_student;
GRANT USAGE ON SEQUENCE incidents_incident_id_seq               TO lt_student;
GRANT SELECT ON incident_status_log, assignments, maintenance_records, part_usage TO lt_student;
GRANT SELECT ON v_incident_overview                             TO lt_student;

-- ---------- TECHNICIAN ----------
GRANT SELECT          ON incidents                              TO lt_technician;
GRANT UPDATE (status) ON incidents                              TO lt_technician;
GRANT SELECT          ON incident_status_log, assignments       TO lt_technician;
GRANT SELECT, INSERT, UPDATE (diagnosis, root_cause, action_taken, outcome)
                      ON maintenance_records                    TO lt_technician;
GRANT USAGE ON SEQUENCE maintenance_records_record_id_seq       TO lt_technician;
GRANT SELECT, INSERT  ON part_usage                             TO lt_technician;
GRANT SELECT ON v_incident_overview, v_equipment_reliability, v_technician_workload, v_low_stock_parts
      TO lt_technician;

-- ---------- ADMIN ----------
GRANT ALL ON ALL TABLES    IN SCHEMA labtrace TO lt_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA labtrace TO lt_admin;

-- =====================================================================
-- ROW-LEVEL SECURITY
-- =====================================================================
ALTER TABLE incidents           ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_status_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE part_usage          ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_phones         ENABLE ROW LEVEL SECURITY;

-- ----- incidents -----
CREATE POLICY p_inc_admin_all      ON incidents FOR ALL    TO lt_admin      USING (true) WITH CHECK (true);
CREATE POLICY p_inc_tech_select    ON incidents FOR SELECT TO lt_technician USING (true);
CREATE POLICY p_inc_tech_update    ON incidents FOR UPDATE TO lt_technician
    USING      (EXISTS (SELECT 1 FROM assignments a
                         WHERE a.incident_id = incidents.incident_id
                           AND a.technician_id = app_uid() AND a.is_active))
    WITH CHECK (status IN ('in_progress','resolved')          -- technicians cannot close
                AND EXISTS (SELECT 1 FROM assignments a
                         WHERE a.incident_id = incidents.incident_id
                           AND a.technician_id = app_uid() AND a.is_active));
CREATE POLICY p_inc_student_select ON incidents FOR SELECT TO lt_student USING (reported_by = app_uid());
CREATE POLICY p_inc_student_insert ON incidents FOR INSERT TO lt_student WITH CHECK (reported_by = app_uid());
-- a student may only CLOSE or REOPEN his/her own resolved/closed incident
CREATE POLICY p_inc_student_update ON incidents FOR UPDATE TO lt_student
    USING      (reported_by = app_uid() AND status IN ('resolved','closed'))
    WITH CHECK (reported_by = app_uid() AND status IN ('closed','reopened'));

-- ----- incident_status_log -----
CREATE POLICY p_log_admin   ON incident_status_log FOR ALL    TO lt_admin      USING (true) WITH CHECK (true);
CREATE POLICY p_log_tech    ON incident_status_log FOR SELECT TO lt_technician USING (true);
CREATE POLICY p_log_student ON incident_status_log FOR SELECT TO lt_student
    USING (incident_id IN (SELECT incident_id FROM incidents));   -- incidents RLS applies here

-- ----- assignments -----
CREATE POLICY p_asg_admin   ON assignments FOR ALL    TO lt_admin      USING (true) WITH CHECK (true);
CREATE POLICY p_asg_tech    ON assignments FOR SELECT TO lt_technician USING (true);
CREATE POLICY p_asg_student ON assignments FOR SELECT TO lt_student
    USING (incident_id IN (SELECT incident_id FROM incidents));

-- ----- maintenance_records -----
CREATE POLICY p_mr_admin        ON maintenance_records FOR ALL    TO lt_admin      USING (true) WITH CHECK (true);
CREATE POLICY p_mr_tech_select  ON maintenance_records FOR SELECT TO lt_technician USING (true);
CREATE POLICY p_mr_tech_insert  ON maintenance_records FOR INSERT TO lt_technician
    WITH CHECK (technician_id = app_uid()
                AND EXISTS (SELECT 1 FROM assignments a
                             WHERE a.incident_id = maintenance_records.incident_id
                               AND a.technician_id = app_uid() AND a.is_active));
CREATE POLICY p_mr_tech_update  ON maintenance_records FOR UPDATE TO lt_technician
    USING (technician_id = app_uid()) WITH CHECK (technician_id = app_uid());
CREATE POLICY p_mr_student      ON maintenance_records FOR SELECT TO lt_student
    USING (incident_id IN (SELECT incident_id FROM incidents));

-- ----- part_usage -----
CREATE POLICY p_pu_admin       ON part_usage FOR ALL    TO lt_admin      USING (true) WITH CHECK (true);
CREATE POLICY p_pu_tech_select ON part_usage FOR SELECT TO lt_technician USING (true);
CREATE POLICY p_pu_tech_insert ON part_usage FOR INSERT TO lt_technician
    WITH CHECK (record_id IN (SELECT record_id FROM maintenance_records WHERE technician_id = app_uid()));
CREATE POLICY p_pu_student     ON part_usage FOR SELECT TO lt_student
    USING (record_id IN (SELECT record_id FROM maintenance_records));

-- ----- user_phones -----
CREATE POLICY p_ph_admin ON user_phones FOR ALL TO lt_admin USING (true) WITH CHECK (true);
CREATE POLICY p_ph_self  ON user_phones FOR ALL TO lt_student, lt_technician
    USING (user_id = app_uid()) WITH CHECK (user_id = app_uid());
