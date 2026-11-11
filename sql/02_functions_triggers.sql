-- =====================================================================
-- LabTrace  |  02_functions_triggers.sql
-- Stored functions, stored procedures and triggers
-- =====================================================================
SET search_path TO labtrace, public;

-- ---------------------------------------------------------------------
-- Helper: id of the logged-in application user.
-- The web app runs  SELECT set_config('app.user_id', '<id>', true)
-- at the start of every transaction (see web/lib/db.js).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_uid() RETURNS INT
LANGUAGE sql STABLE AS $$
    SELECT NULLIF(current_setting('app.user_id', true), '')::INT
$$;

-- =====================================================================
-- A. AUTHENTICATION HELPERS  (SECURITY DEFINER - run with owner rights,
--    because before login we do not know the user's role yet)
-- =====================================================================
CREATE OR REPLACE FUNCTION fn_auth_lookup(p_email TEXT)
RETURNS TABLE (user_id INT, full_name VARCHAR, role VARCHAR, password_hash VARCHAR, is_active BOOLEAN)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = labtrace, public AS $$
    SELECT u.user_id, u.full_name, u.role, u.password_hash, u.is_active
    FROM   users u
    WHERE  lower(u.email) = lower(p_email);
$$;

CREATE OR REPLACE FUNCTION fn_register_student(
    p_institution_id TEXT, p_full_name TEXT, p_email TEXT,
    p_password_hash TEXT, p_department TEXT)
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = labtrace, public AS $$
DECLARE v_id INT;
BEGIN
    IF EXISTS (SELECT 1 FROM users WHERE lower(email) = lower(p_email)) THEN
        RAISE EXCEPTION 'Email % is already registered', p_email USING ERRCODE = 'unique_violation';
    END IF;
    IF EXISTS (SELECT 1 FROM users WHERE upper(institution_id) = upper(p_institution_id)) THEN
        RAISE EXCEPTION 'SRN % is already registered', p_institution_id USING ERRCODE = 'unique_violation';
    END IF;
    INSERT INTO users (institution_id, full_name, email, password_hash, role, department)
    VALUES (upper(p_institution_id), p_full_name, lower(p_email), p_password_hash, 'student', p_department)
    RETURNING user_id INTO v_id;
    RETURN v_id;
END $$;

-- =====================================================================
-- B. RELIABILITY ANALYTICS FUNCTIONS  ("predictive reliability")
-- =====================================================================

-- Mean Time Between Failures (hours) = time in service / number of failures
CREATE OR REPLACE FUNCTION fn_equipment_mtbf_hours(p_equipment_id INT)
RETURNS NUMERIC LANGUAGE plpgsql STABLE AS $$
DECLARE
    v_failures INT;
    v_service_hours NUMERIC;
BEGIN
    SELECT COUNT(*) INTO v_failures FROM incidents WHERE equipment_id = p_equipment_id;
    IF v_failures = 0 THEN
        RETURN NULL;                       -- never failed: MTBF undefined
    END IF;
    SELECT EXTRACT(EPOCH FROM (now() - purchase_date::timestamptz)) / 3600.0
      INTO v_service_hours
      FROM equipment WHERE equipment_id = p_equipment_id;
    RETURN ROUND(v_service_hours / v_failures, 1);
END $$;

-- Mean Time To Repair (hours) = average(resolved_at - reported_at)
CREATE OR REPLACE FUNCTION fn_equipment_mttr_hours(p_equipment_id INT)
RETURNS NUMERIC LANGUAGE sql STABLE AS $$
    SELECT ROUND(AVG(EXTRACT(EPOCH FROM (resolved_at - reported_at)) / 3600.0)::numeric, 1)
    FROM   incidents
    WHERE  equipment_id = p_equipment_id AND resolved_at IS NOT NULL;
$$;

-- Number of "repeat failures": a new incident reported within 30 days
-- after a previous incident on the same asset was resolved.
CREATE OR REPLACE FUNCTION fn_repeat_failures(p_equipment_id INT, p_window_days INT DEFAULT 30)
RETURNS INT LANGUAGE sql STABLE AS $$
    SELECT COUNT(*)::INT
    FROM   incidents cur
    WHERE  cur.equipment_id = p_equipment_id
      AND  EXISTS (SELECT 1                                  -- correlated sub-query
                   FROM   incidents prev
                   WHERE  prev.equipment_id = cur.equipment_id
                     AND  prev.incident_id <> cur.incident_id
                     AND  prev.resolved_at IS NOT NULL
                     AND  cur.reported_at >  prev.resolved_at
                     AND  cur.reported_at <= prev.resolved_at + make_interval(days => p_window_days));
$$;

-- Reliability score 0..100 (higher = more reliable)
CREATE OR REPLACE FUNCTION fn_reliability_score(p_equipment_id INT)
RETURNS NUMERIC LANGUAGE plpgsql STABLE AS $$
DECLARE
    v_recent      INT;
    v_repeat      INT;
    v_open_crit   INT;
    v_age_years   NUMERIC;
    v_life_years  NUMERIC;
    v_score       NUMERIC := 100;
BEGIN
    SELECT COUNT(*) INTO v_recent
      FROM incidents WHERE equipment_id = p_equipment_id
       AND reported_at >= now() - INTERVAL '180 days';

    v_repeat := fn_repeat_failures(p_equipment_id);

    SELECT COUNT(*) INTO v_open_crit
      FROM incidents WHERE equipment_id = p_equipment_id
       AND severity IN ('high','critical')
       AND status NOT IN ('resolved','closed');

    SELECT EXTRACT(EPOCH FROM (now() - e.purchase_date::timestamptz)) / (365.25*86400),
           c.expected_life_years
      INTO v_age_years, v_life_years
      FROM equipment e JOIN equipment_categories c ON c.category_id = e.category_id
     WHERE e.equipment_id = p_equipment_id;

    v_score := v_score
             - 10 * v_recent
             - 12 * v_repeat
             - 10 * v_open_crit
             - 25 * LEAST(GREATEST(v_age_years / NULLIF(v_life_years,0), 0), 1.5);
    RETURN ROUND(GREATEST(LEAST(v_score, 100), 0), 1);
END $$;

CREATE OR REPLACE FUNCTION fn_risk_level(p_score NUMERIC)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE WHEN p_score IS NULL THEN 'Unknown'
                WHEN p_score >= 70  THEN 'Low'
                WHEN p_score >= 40  THEN 'Medium'
                ELSE 'High' END
$$;

-- Predicted date of next failure = last failure + MTBF
CREATE OR REPLACE FUNCTION fn_predicted_next_failure(p_equipment_id INT)
RETURNS DATE LANGUAGE sql STABLE AS $$
    SELECT (MAX(i.reported_at) + make_interval(hours => fn_equipment_mtbf_hours(p_equipment_id)::int))::date
    FROM   incidents i
    WHERE  i.equipment_id = p_equipment_id;
$$;

-- =====================================================================
-- C. TRIGGERS
-- =====================================================================

-- C1. BEFORE UPDATE on incidents: validate status transitions and
--     maintain resolved_at / closed_at timestamps.
CREATE OR REPLACE FUNCTION trg_fn_incident_validate_status()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        IF NOT (
            (OLD.status = 'open'        AND NEW.status IN ('assigned','closed')) OR
            (OLD.status = 'assigned'    AND NEW.status IN ('in_progress','open','closed')) OR
            (OLD.status = 'in_progress' AND NEW.status IN ('resolved','assigned')) OR
            (OLD.status = 'resolved'    AND NEW.status IN ('closed','reopened')) OR
            (OLD.status = 'reopened'    AND NEW.status IN ('assigned','in_progress','closed')) OR
            (OLD.status = 'closed'      AND NEW.status IN ('reopened'))
        ) THEN
            RAISE EXCEPTION 'Invalid incident status change: % -> %', OLD.status, NEW.status
                  USING ERRCODE = 'check_violation';
        END IF;

        IF NEW.status = 'resolved' THEN
            NEW.resolved_at := COALESCE(NEW.resolved_at, now());
        ELSIF NEW.status = 'reopened' THEN
            NEW.resolved_at := NULL;
            NEW.closed_at   := NULL;
        ELSIF NEW.status = 'closed' THEN
            NEW.closed_at := COALESCE(NEW.closed_at, now());
        END IF;
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER trg_incident_validate_status
BEFORE UPDATE OF status ON incidents
FOR EACH ROW EXECUTE FUNCTION trg_fn_incident_validate_status();

-- C2. AFTER INSERT on incidents: write first log entry and mark the
--     equipment as faulty for high / critical failures.
CREATE OR REPLACE FUNCTION trg_fn_incident_after_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = labtrace, public AS $$
BEGIN
    INSERT INTO incident_status_log (incident_id, log_seq, old_status, new_status, changed_by, changed_at, remarks)
    VALUES (NEW.incident_id, 1, NULL, NEW.status, NEW.reported_by, NEW.reported_at, 'Incident reported');

    IF NEW.severity IN ('high','critical') THEN
        UPDATE equipment SET status = 'faulty'
         WHERE equipment_id = NEW.equipment_id AND status = 'operational';
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER trg_incident_after_insert
AFTER INSERT ON incidents
FOR EACH ROW EXECUTE FUNCTION trg_fn_incident_after_insert();

-- C3. AFTER UPDATE OF status on incidents: append to the status log
--     (weak entity) and keep the equipment status in sync.
CREATE OR REPLACE FUNCTION trg_fn_incident_status_log()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = labtrace, public AS $$
DECLARE
    v_next INT;
    v_active_others INT;
BEGIN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        SELECT COALESCE(MAX(log_seq), 0) + 1 INTO v_next
          FROM incident_status_log WHERE incident_id = NEW.incident_id;

        INSERT INTO incident_status_log (incident_id, log_seq, old_status, new_status, changed_by, remarks)
        VALUES (NEW.incident_id, v_next, OLD.status, NEW.status, app_uid(),
                NULLIF(current_setting('app.status_remark', true), ''));

        -- keep equipment status consistent with incident life-cycle
        IF NEW.status = 'in_progress' THEN
            UPDATE equipment SET status = 'under_maintenance'
             WHERE equipment_id = NEW.equipment_id AND status <> 'retired';
        ELSIF NEW.status = 'reopened' THEN
            UPDATE equipment SET status = 'faulty'
             WHERE equipment_id = NEW.equipment_id AND status <> 'retired';
        ELSIF NEW.status IN ('resolved','closed') THEN
            SELECT COUNT(*) INTO v_active_others
              FROM incidents
             WHERE equipment_id = NEW.equipment_id
               AND incident_id <> NEW.incident_id
               AND status IN ('open','assigned','in_progress','reopened');
            IF v_active_others = 0 THEN
                UPDATE equipment SET status = 'operational'
                 WHERE equipment_id = NEW.equipment_id AND status <> 'retired';
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER trg_incident_status_log
AFTER UPDATE OF status ON incidents
FOR EACH ROW EXECUTE FUNCTION trg_fn_incident_status_log();

-- C4. BEFORE INSERT on assignments: technician must have role
--     'technician'; any previous active assignment is deactivated.
CREATE OR REPLACE FUNCTION trg_fn_assignment_before_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = labtrace, public AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM users
                    WHERE user_id = NEW.technician_id AND role = 'technician' AND is_active) THEN
        RAISE EXCEPTION 'User % is not an active technician', NEW.technician_id
              USING ERRCODE = 'check_violation';
    END IF;
    UPDATE assignments SET is_active = FALSE
     WHERE incident_id = NEW.incident_id AND is_active;
    NEW.assigned_by := COALESCE(NEW.assigned_by, app_uid());
    RETURN NEW;
END $$;

CREATE TRIGGER trg_assignment_before_insert
BEFORE INSERT ON assignments
FOR EACH ROW EXECUTE FUNCTION trg_fn_assignment_before_insert();

-- C5. AFTER INSERT on assignments: move incident to 'assigned'.
CREATE OR REPLACE FUNCTION trg_fn_assignment_after_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = labtrace, public AS $$
BEGIN
    UPDATE incidents SET status = 'assigned'
     WHERE incident_id = NEW.incident_id AND status IN ('open','reopened');
    RETURN NEW;
END $$;

CREATE TRIGGER trg_assignment_after_insert
AFTER INSERT ON assignments
FOR EACH ROW EXECUTE FUNCTION trg_fn_assignment_after_insert();

-- C6. BEFORE INSERT on part_usage: check stock, decrement inventory and
--     freeze the unit cost at time of use.
CREATE OR REPLACE FUNCTION trg_fn_part_usage_stock()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = labtrace, public AS $$
DECLARE
    v_stock INT;
    v_cost  NUMERIC;
    v_name  TEXT;
BEGIN
    SELECT qty_in_stock, unit_cost, part_name INTO v_stock, v_cost, v_name
      FROM spare_parts WHERE part_id = NEW.part_id
       FOR UPDATE;                                   -- row lock (concurrency)
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Spare part % does not exist', NEW.part_id;
    END IF;
    IF v_stock < NEW.quantity THEN
        RAISE EXCEPTION 'Insufficient stock for "%": available %, requested %',
              v_name, v_stock, NEW.quantity USING ERRCODE = 'check_violation';
    END IF;
    UPDATE spare_parts SET qty_in_stock = qty_in_stock - NEW.quantity
     WHERE part_id = NEW.part_id;
    NEW.unit_cost_at_use := COALESCE(NEW.unit_cost_at_use, v_cost);
    RETURN NEW;
END $$;

CREATE TRIGGER trg_part_usage_stock
BEFORE INSERT ON part_usage
FOR EACH ROW EXECUTE FUNCTION trg_fn_part_usage_stock();

-- C7. BEFORE INSERT/UPDATE on maintenance_records: only technicians
--     may own a maintenance record.
CREATE OR REPLACE FUNCTION trg_fn_mr_check_technician()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = labtrace, public AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM users WHERE user_id = NEW.technician_id AND role = 'technician') THEN
        RAISE EXCEPTION 'Maintenance record must belong to a technician (user %)', NEW.technician_id;
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER trg_mr_check_technician
BEFORE INSERT OR UPDATE OF technician_id ON maintenance_records
FOR EACH ROW EXECUTE FUNCTION trg_fn_mr_check_technician();

-- =====================================================================
-- D. STORED PROCEDURES
-- =====================================================================

-- D1. Assign a technician to an incident.  If no technician is given,
--     the least-loaded technician skilled in the equipment's category
--     (or any ANCESTOR category - recursive CTE) is chosen automatically.
CREATE OR REPLACE PROCEDURE sp_assign_technician(
    p_incident_id   INT,
    INOUT p_technician_id INT DEFAULT NULL,
    p_notes         TEXT DEFAULT NULL)
LANGUAGE plpgsql AS $$
DECLARE
    v_category INT;
    v_status   TEXT;
BEGIN
    SELECT e.category_id, i.status INTO v_category, v_status
      FROM incidents i JOIN equipment e ON e.equipment_id = i.equipment_id
     WHERE i.incident_id = p_incident_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Incident % not found', p_incident_id;
    END IF;
    IF v_status IN ('resolved','closed') THEN
        RAISE EXCEPTION 'Incident % is already %', p_incident_id, v_status;
    END IF;

    IF p_technician_id IS NULL THEN
        WITH RECURSIVE cat_chain AS (                 -- category + all its ancestors
            SELECT category_id, parent_id, 0 AS depth
              FROM equipment_categories WHERE category_id = v_category
            UNION ALL
            SELECT c.category_id, c.parent_id, cc.depth + 1
              FROM equipment_categories c JOIN cat_chain cc ON c.category_id = cc.parent_id
        ),
        workload AS (
            SELECT technician_id, COUNT(*) AS active_jobs
              FROM assignments a JOIN incidents i ON i.incident_id = a.incident_id
             WHERE a.is_active AND i.status IN ('assigned','in_progress','reopened')
             GROUP BY technician_id
        )
        SELECT u.user_id INTO p_technician_id
          FROM users u
          LEFT JOIN technician_skills s ON s.technician_id = u.user_id
          LEFT JOIN cat_chain cc        ON cc.category_id  = s.category_id
          LEFT JOIN workload w          ON w.technician_id = u.user_id
         WHERE u.role = 'technician' AND u.is_active
         GROUP BY u.user_id, w.active_jobs
         ORDER BY (MIN(cc.depth) IS NULL),            -- skilled technicians first
                  MIN(cc.depth),                      -- closest category match
                  COALESCE(w.active_jobs, 0),         -- least loaded
                  MAX(s.proficiency) DESC NULLS LAST,
                  u.user_id
         LIMIT 1;
    END IF;

    IF p_technician_id IS NULL THEN
        RAISE EXCEPTION 'No active technician available';
    END IF;

    INSERT INTO assignments (incident_id, technician_id, assigned_by, notes)
    VALUES (p_incident_id, p_technician_id, app_uid(), p_notes);
END $$;

-- D2. Technician completes a maintenance job in ONE transaction:
--     maintenance record + spare parts used + incident status change.
--     p_parts example: '[{"part_id":3,"quantity":1},{"part_id":7,"quantity":2}]'
CREATE OR REPLACE PROCEDURE sp_complete_maintenance(
    p_incident_id  INT,
    p_diagnosis    TEXT,
    p_root_cause   TEXT,
    p_action_taken TEXT,
    p_outcome      TEXT,
    p_started_at   TIMESTAMPTZ,
    p_parts        JSONB DEFAULT '[]'::jsonb,
    INOUT p_record_id INT DEFAULT NULL)
LANGUAGE plpgsql AS $$
DECLARE
    v_status TEXT;
    v_part   JSONB;
BEGIN
    SELECT status INTO v_status FROM incidents WHERE incident_id = p_incident_id;
    IF v_status IS NULL THEN
        RAISE EXCEPTION 'Incident % not visible or does not exist', p_incident_id;
    END IF;
    IF v_status IN ('assigned','reopened') THEN
        UPDATE incidents SET status = 'in_progress' WHERE incident_id = p_incident_id;
    ELSIF v_status <> 'in_progress' THEN
        RAISE EXCEPTION 'Incident % is %, cannot record maintenance', p_incident_id, v_status;
    END IF;

    INSERT INTO maintenance_records (incident_id, technician_id, diagnosis, root_cause,
                                     action_taken, outcome, started_at, completed_at)
    VALUES (p_incident_id, app_uid(), p_diagnosis, p_root_cause,
            p_action_taken, p_outcome, COALESCE(p_started_at, now()), now())
    RETURNING record_id INTO p_record_id;

    FOR v_part IN SELECT * FROM jsonb_array_elements(COALESCE(p_parts, '[]'::jsonb)) LOOP
        INSERT INTO part_usage (record_id, part_id, quantity)
        VALUES (p_record_id, (v_part->>'part_id')::INT, (v_part->>'quantity')::INT);
    END LOOP;

    IF p_outcome IN ('fixed','replaced') THEN
        UPDATE incidents SET status = 'resolved' WHERE incident_id = p_incident_id;
    END IF;
END $$;

-- D3. Restock a spare part (admin)
CREATE OR REPLACE PROCEDURE sp_restock_part(p_part_id INT, p_qty INT)
LANGUAGE plpgsql AS $$
BEGIN
    IF p_qty <= 0 THEN
        RAISE EXCEPTION 'Restock quantity must be positive';
    END IF;
    UPDATE spare_parts SET qty_in_stock = qty_in_stock + p_qty WHERE part_id = p_part_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Spare part % not found', p_part_id;
    END IF;
END $$;
