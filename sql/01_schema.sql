-- =====================================================================
-- LabTrace : Intelligent Laboratory Asset Failure Tracking,
--            Maintenance Management and Predictive Reliability System
-- File     : 01_schema.sql  (DDL - tables, keys, constraints, indexes)
-- DBMS     : PostgreSQL 16
-- Run as   : database owner (e.g. postgres)  ->  psql -d labtrace -f 01_schema.sql
-- =====================================================================

DROP SCHEMA IF EXISTS labtrace CASCADE;
CREATE SCHEMA labtrace;
SET search_path TO labtrace, public;

-- ---------------------------------------------------------------------
-- 1. USERS  (students, technicians, administrators)
-- ---------------------------------------------------------------------
CREATE TABLE users (
    user_id        SERIAL        PRIMARY KEY,
    institution_id VARCHAR(20)   NOT NULL UNIQUE,          -- SRN for students, EMP id for staff
    full_name      VARCHAR(100)  NOT NULL,
    email          VARCHAR(120)  NOT NULL UNIQUE,
    password_hash  VARCHAR(100)  NOT NULL,
    role           VARCHAR(12)   NOT NULL DEFAULT 'student',
    department     VARCHAR(60),
    is_active      BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT chk_users_role  CHECK (role IN ('student','technician','admin')),
    CONSTRAINT chk_users_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Multivalued attribute of USER (a user may have many phone numbers)
CREATE TABLE user_phones (
    user_id     INT          NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    phone_no    VARCHAR(15)  NOT NULL,
    phone_type  VARCHAR(10)  NOT NULL DEFAULT 'mobile',
    PRIMARY KEY (user_id, phone_no),
    CONSTRAINT chk_phone_no   CHECK (phone_no ~ '^\+?[0-9]{10,14}$'),
    CONSTRAINT chk_phone_type CHECK (phone_type IN ('mobile','office','home'))
);

-- ---------------------------------------------------------------------
-- 2. LABS
-- ---------------------------------------------------------------------
CREATE TABLE labs (
    lab_id      SERIAL       PRIMARY KEY,
    lab_code    VARCHAR(12)  NOT NULL UNIQUE,
    lab_name    VARCHAR(80)  NOT NULL,
    building    VARCHAR(40)  NOT NULL,              -- composite attribute "location"
    floor_no    SMALLINT     NOT NULL,              --   = building + floor + room
    room_no     VARCHAR(10)  NOT NULL,
    capacity    INT          NOT NULL,
    incharge_id INT          REFERENCES users(user_id) ON DELETE SET NULL,
    CONSTRAINT chk_labs_capacity CHECK (capacity > 0),
    CONSTRAINT chk_labs_floor    CHECK (floor_no BETWEEN -2 AND 20),
    CONSTRAINT uq_labs_location  UNIQUE (building, floor_no, room_no)
);

-- ---------------------------------------------------------------------
-- 3. EQUIPMENT CATEGORIES  (self-referencing hierarchy -> recursive CTE)
-- ---------------------------------------------------------------------
CREATE TABLE equipment_categories (
    category_id         SERIAL       PRIMARY KEY,
    category_name       VARCHAR(60)  NOT NULL UNIQUE,
    parent_id           INT          REFERENCES equipment_categories(category_id) ON DELETE RESTRICT,
    expected_life_years NUMERIC(4,1) NOT NULL DEFAULT 5,
    description         TEXT,
    CONSTRAINT chk_cat_life   CHECK (expected_life_years > 0),
    CONSTRAINT chk_cat_parent CHECK (parent_id IS NULL OR parent_id <> category_id)
);

-- ---------------------------------------------------------------------
-- 4. EQUIPMENT (laboratory assets)
-- ---------------------------------------------------------------------
CREATE TABLE equipment (
    equipment_id    SERIAL        PRIMARY KEY,
    asset_tag       VARCHAR(20)   NOT NULL UNIQUE,
    equipment_name  VARCHAR(100)  NOT NULL,
    category_id     INT           NOT NULL REFERENCES equipment_categories(category_id) ON DELETE RESTRICT,
    lab_id          INT           NOT NULL REFERENCES labs(lab_id) ON DELETE RESTRICT,
    manufacturer    VARCHAR(60),
    model_no        VARCHAR(60),
    serial_no       VARCHAR(60)   UNIQUE,
    purchase_date   DATE          NOT NULL,
    purchase_cost   NUMERIC(12,2) NOT NULL DEFAULT 0,
    warranty_expiry DATE,
    status          VARCHAR(20)   NOT NULL DEFAULT 'operational',
    specifications  JSONB         NOT NULL DEFAULT '{}'::jsonb,   -- composite/semi-structured specs
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT chk_eq_status   CHECK (status IN ('operational','faulty','under_maintenance','retired')),
    CONSTRAINT chk_eq_cost     CHECK (purchase_cost >= 0),
    CONSTRAINT chk_eq_warranty CHECK (warranty_expiry IS NULL OR warranty_expiry >= purchase_date)
);
CREATE INDEX idx_equipment_lab      ON equipment(lab_id);
CREATE INDEX idx_equipment_category ON equipment(category_id);
CREATE INDEX idx_equipment_status   ON equipment(status);

-- ---------------------------------------------------------------------
-- 5. INCIDENTS (failure reports)
-- ---------------------------------------------------------------------
CREATE TABLE incidents (
    incident_id   SERIAL        PRIMARY KEY,
    equipment_id  INT           NOT NULL REFERENCES equipment(equipment_id) ON DELETE RESTRICT,
    reported_by   INT           NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    title         VARCHAR(150)  NOT NULL,
    description   TEXT          NOT NULL,
    severity      VARCHAR(10)   NOT NULL DEFAULT 'medium',
    status        VARCHAR(12)   NOT NULL DEFAULT 'open',
    reported_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
    resolved_at   TIMESTAMPTZ,
    closed_at     TIMESTAMPTZ,
    CONSTRAINT chk_inc_severity CHECK (severity IN ('low','medium','high','critical')),
    CONSTRAINT chk_inc_status   CHECK (status IN ('open','assigned','in_progress','resolved','closed','reopened')),
    CONSTRAINT chk_inc_resolved CHECK (resolved_at IS NULL OR resolved_at >= reported_at),
    CONSTRAINT chk_inc_closed   CHECK (closed_at  IS NULL OR closed_at  >= reported_at),
    CONSTRAINT chk_inc_desc_len CHECK (length(description) >= 10)
);
CREATE INDEX idx_incidents_equipment ON incidents(equipment_id);
CREATE INDEX idx_incidents_reporter  ON incidents(reported_by);
CREATE INDEX idx_incidents_status    ON incidents(status);

-- ---------------------------------------------------------------------
-- 6. INCIDENT STATUS LOG  (WEAK ENTITY - identified by incident + seq)
-- ---------------------------------------------------------------------
CREATE TABLE incident_status_log (
    incident_id  INT          NOT NULL REFERENCES incidents(incident_id) ON DELETE CASCADE,
    log_seq      INT          NOT NULL,                  -- partial key
    old_status   VARCHAR(12),
    new_status   VARCHAR(12)  NOT NULL,
    changed_by   INT          REFERENCES users(user_id) ON DELETE SET NULL,
    changed_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    remarks      TEXT,
    PRIMARY KEY (incident_id, log_seq)
);

-- ---------------------------------------------------------------------
-- 7. TECHNICIAN SKILLS  (M:N  technician <-> category)
-- ---------------------------------------------------------------------
CREATE TABLE technician_skills (
    technician_id INT      NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    category_id   INT      NOT NULL REFERENCES equipment_categories(category_id) ON DELETE CASCADE,
    proficiency   SMALLINT NOT NULL DEFAULT 3,
    PRIMARY KEY (technician_id, category_id),
    CONSTRAINT chk_skill_prof CHECK (proficiency BETWEEN 1 AND 5)
);

-- ---------------------------------------------------------------------
-- 8. ASSIGNMENTS  (incident -> technician, assigned by admin)
-- ---------------------------------------------------------------------
CREATE TABLE assignments (
    assignment_id SERIAL       PRIMARY KEY,
    incident_id   INT          NOT NULL REFERENCES incidents(incident_id) ON DELETE CASCADE,
    technician_id INT          NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    assigned_by   INT          REFERENCES users(user_id) ON DELETE SET NULL,
    assigned_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    notes         TEXT
);
-- only ONE active assignment per incident
CREATE UNIQUE INDEX uq_assignment_active ON assignments(incident_id) WHERE is_active;
CREATE INDEX idx_assignment_tech ON assignments(technician_id) WHERE is_active;

-- ---------------------------------------------------------------------
-- 9. MAINTENANCE RECORDS (repair work done for an incident)
-- ---------------------------------------------------------------------
CREATE TABLE maintenance_records (
    record_id     SERIAL        PRIMARY KEY,
    incident_id   INT           NOT NULL REFERENCES incidents(incident_id) ON DELETE CASCADE,
    technician_id INT           NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    diagnosis     TEXT          NOT NULL,
    root_cause    VARCHAR(60),
    action_taken  TEXT          NOT NULL,
    outcome       VARCHAR(12)   NOT NULL DEFAULT 'fixed',
    started_at    TIMESTAMPTZ   NOT NULL,
    completed_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
    -- DERIVED ATTRIBUTE (stored generated column)
    labour_hours  NUMERIC(8,2)  GENERATED ALWAYS AS
                  (ROUND((EXTRACT(EPOCH FROM (completed_at - started_at)) / 3600.0)::numeric, 2)) STORED,
    CONSTRAINT chk_mr_outcome CHECK (outcome IN ('fixed','partial','not_fixed','replaced')),
    CONSTRAINT chk_mr_time    CHECK (completed_at >= started_at)
);
CREATE INDEX idx_mr_incident ON maintenance_records(incident_id);
CREATE INDEX idx_mr_tech     ON maintenance_records(technician_id);

-- ---------------------------------------------------------------------
-- 10. SPARE PARTS (inventory)
-- ---------------------------------------------------------------------
CREATE TABLE spare_parts (
    part_id       SERIAL        PRIMARY KEY,
    part_no       VARCHAR(20)   NOT NULL UNIQUE,
    part_name     VARCHAR(80)   NOT NULL,
    part_category VARCHAR(40)   NOT NULL,
    unit_cost     NUMERIC(10,2) NOT NULL,
    qty_in_stock  INT           NOT NULL DEFAULT 0,
    reorder_level INT           NOT NULL DEFAULT 2,
    CONSTRAINT chk_sp_cost    CHECK (unit_cost >= 0),
    CONSTRAINT chk_sp_qty     CHECK (qty_in_stock >= 0),
    CONSTRAINT chk_sp_reorder CHECK (reorder_level >= 0)
);

-- ---------------------------------------------------------------------
-- 11. PART USAGE  (M:N  maintenance_record <-> spare_part, with attributes)
-- ---------------------------------------------------------------------
CREATE TABLE part_usage (
    record_id        INT           NOT NULL REFERENCES maintenance_records(record_id) ON DELETE CASCADE,
    part_id          INT           NOT NULL REFERENCES spare_parts(part_id) ON DELETE RESTRICT,
    quantity         INT           NOT NULL,
    unit_cost_at_use NUMERIC(10,2),
    PRIMARY KEY (record_id, part_id),
    CONSTRAINT chk_pu_qty CHECK (quantity > 0)
);
