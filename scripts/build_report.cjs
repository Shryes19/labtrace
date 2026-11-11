// Builds docs/LabTrace_DBMS_Project_Report.docx following the course template.
// node scripts/build_report.cjs [pages.json]
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, WidthType, ShadingType,
  AlignmentType, HeadingLevel, Header, Footer, PageNumber, PageBreak, BorderStyle, LevelFormat, TabStopType,
} = require('docx');

const ROOT = path.join(__dirname, '..');
const rd = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const pages = process.argv[2] && fs.existsSync(process.argv[2]) ? JSON.parse(fs.readFileSync(process.argv[2])) : {};

const FONT = 'Times New Roman';
const MONO = 'Courier New';
const CONTENT_W = 9026; // A4 width minus 1" margins (DXA)

// ---------------------------------------------------------------- helpers
const runs = (text, opts = {}) => {
  // **bold** inline support
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((p) => p.startsWith('**') ? new TextRun({ text: p.slice(2, -2), bold: true, font: FONT, size: 24, ...opts })
    : new TextRun({ text: p, font: FONT, size: 24, ...opts }));
};
const P = (text, opts = {}) => new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 120, line: 300 }, children: runs(text, opts.run), ...opts.para });
const H1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: t })] });
const H2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: t })] });
const H3 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun({ text: t })] });
const bullet = (t, level = 0) => new Paragraph({ numbering: { reference: 'bul', level }, alignment: AlignmentType.JUSTIFIED, spacing: { after: 60, line: 280 }, children: runs(t) });
const center = (t, size = 24, bold = false, italics = false) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [new TextRun({ text: t, font: FONT, size, bold, italics })] });
const pageBreak = () => new Paragraph({ children: [new PageBreak()] });
const caption = (t) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 200 }, children: [new TextRun({ text: t, font: FONT, size: 20, italics: true })] });

function code(text, size = 15) {
  const lines = String(text).replace(/\t/g, '    ').split('\n');
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  return lines.map((l, i) => new Paragraph({
    spacing: { after: 0, line: 228 },
    shading: { type: ShadingType.CLEAR, fill: 'F4F5F7', color: 'auto' },
    border: i === 0 ? { top: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC', space: 2 } } :
      i === lines.length - 1 ? { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC', space: 2 } } : undefined,
    children: [new TextRun({ text: l || ' ', font: MONO, size })],
  })).concat([new Paragraph({ spacing: { after: 120 }, children: [] })]);
}

function pngSize(file) {
  const b = fs.readFileSync(file);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}
function img(rel, maxW = 600, maxH = 820) {
  const file = path.join(ROOT, rel);
  const { w, h } = pngSize(file);
  let width = Math.min(maxW, w);
  let height = Math.round((h / w) * width);
  if (height > maxH) { height = maxH; width = Math.round((w / h) * height); }
  return new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120, after: 60 },
    children: [new ImageRun({ type: 'png', data: fs.readFileSync(file), transformation: { width, height } })] });
}

const border = { style: BorderStyle.SINGLE, size: 4, color: '999999' };
const borders = { top: border, bottom: border, left: border, right: border };
function table(headers, rows, widths, opts = {}) {
  const total = widths.reduce((a, b) => a + b, 0);
  const cell = (t, i, head = false, fill) => new TableCell({
    borders, width: { size: widths[i], type: WidthType.DXA },
    shading: head ? { type: ShadingType.CLEAR, fill: 'D9E2F3', color: 'auto' } : fill ? { type: ShadingType.CLEAR, fill, color: 'auto' } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: String(t).split('\n').map((line) => new Paragraph({ spacing: { after: 0 }, children: runs(line, { size: opts.size || 21, bold: head || undefined }) })),
  });
  return new Table({
    width: { size: total, type: WidthType.DXA }, columnWidths: widths,
    rows: [new TableRow({ tableHeader: true, children: headers.map((h, i) => cell(h, i, true)) }),
      ...rows.map((r) => new TableRow({ children: r.map((c, i) => cell(c, i, false, opts.highlight?.(r) ? 'FFF2CC' : undefined)) }))],
  });
}
const gap = () => new Paragraph({ spacing: { after: 120 }, children: [] });

// ---------------------------------------------------------------- content
const TITLE = 'LabTrace: An Intelligent Laboratory Asset Failure Tracking, Maintenance Management and Predictive Reliability System';
const children = [];

// ---------- cover ----------
children.push(
  new Paragraph({ spacing: { before: 600 }, children: [] }),
  center('PES UNIVERSITY', 36, true),
  center('100 Feet Ring Road, BSK 3rd Stage, Bengaluru 560085', 22),
  new Paragraph({ spacing: { after: 300 }, children: [] }),
  center('Department of Computer Science and Engineering', 28, true),
  center('(AI & ML)', 26, true),
  center('B. Tech. CSE - 5th Semester', 24),
  center('Aug - Dec 2026', 24),
  new Paragraph({ spacing: { after: 200 }, children: [] }),
  center('UE23CS351A', 26, true),
  center('DATABASE MANAGEMENT SYSTEMS (DBMS)', 26, true),
  new Paragraph({ spacing: { after: 300 }, children: [] }),
  center('PROJECT REPORT on', 24),
  new Paragraph({ spacing: { after: 100 }, children: [] }),
  center(TITLE, 30, true, true),
  new Paragraph({ spacing: { after: 400 }, children: [] }),
  center('Submitted by:', 24, true),
);
children.push(new Table({
  width: { size: 6000, type: WidthType.DXA }, columnWidths: [3000, 3000], alignment: AlignmentType.CENTER,
  rows: [['PES1UG24AM272', 'Shryes M'], ['PES1UG24AM261', 'Shesanth K']].map((r) => new TableRow({
    children: r.map((t) => new TableCell({ borders, width: { size: 3000, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 },
      children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: t, font: FONT, size: 24 })] })] })),
  })),
}));
children.push(
  new Paragraph({ spacing: { after: 400 }, children: [] }),
  center('Class of Prof. Junaid Rasool', 24, true, true),
  center('Lab Faculty: Prof. Junaid Rasool', 24, true, true),
  pageBreak(),
);

// ---------- abstract ----------
children.push(H1('Abstract'));
children.push(P('Engineering colleges and research laboratories depend on hundreds of physical assets - desktops, GPU workstations, servers, network devices, instruments, projectors and embedded kits. Failures are usually reported through informal channels such as messaging apps, e-mail or paper registers, while repair notes and spare-part usage live in separate spreadsheets. As a result, nobody can see the complete history of an asset, recurring failures go unnoticed and technicians repeatedly diagnose problems that were already solved.'));
children.push(P('**LabTrace** is a centralised web application that connects every laboratory asset with its reported failures, technician assignments, maintenance records, spare parts and status history. Structured data is stored in a **PostgreSQL** relational database with constraints, triggers, stored procedures, functions, views, recursive common table expressions and database-level role-based access control (database roles, column privileges and row-level security). Free-text failure descriptions, diagnoses, repair notes and technical articles are stored in a **MongoDB** document repository together with 384-dimension text embeddings, enabling **semantic vector search**: a description such as "the computer gets too hot and turns off" retrieves earlier incidents described as "system powers off during heavy processing" together with their documented fixes.'));
children.push(P('The application is built with **Next.js 16** (App Router, server components and API route handlers) and supports three roles - student, technician and administrator. It also computes reliability indicators such as Mean Time Between Failures (MTBF), Mean Time To Repair (MTTR), repeat failures, a reliability score, a risk level and an estimated next-failure date, helping administrators decide which equipment needs preventive maintenance or replacement. The system was verified with SQL demonstration scripts and a 29-step automated end-to-end test of the complete workflow and access rules.'));
children.push(pageBreak());

// ---------- TOC ----------
children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: 'Table of Contents', font: FONT, size: 28, bold: true, italics: true })] }));
const toc = [
  ['1.', 'Introduction - Problem Statement', '1. Introduction'],
  ['2.', 'User Requirements Specification - Tech Stack', '2. User Requirements Specification'],
  ['3.', 'E-R Model - List of Entities (weak ones labelled), non-simple attributes, ER Diagram', '3. E-R Model'],
  ['4.', 'Relational Model - List of Relations (non-entity relations labelled), Schema Diagram', '4. Relational Model'],
  ['5.', 'SQL DDL Statements', '5. SQL DDL Statements'],
  ['6.', 'SQL DML Statements and Queries', '6. SQL DML Statements'],
  ['7.', 'NoSQL / Vector Database Commands', '7. NoSQL / Vector Database Commands'],
  ['8.', 'Results - Resulting Tables\' Screenshots', '8. Results'],
  ['9.', 'Next.js Project Tree Structure', '9. Next.js Project Tree Structure'],
  ['10.', 'Sample Screenshots of Application Code and Demo', '10. Sample Screenshots'],
  ['11.', 'Testing, GitHub and Individual Contribution', '11. Testing'],
  ['12.', 'Evaluation Rubrics - Completion Status', '12. Evaluation Rubrics'],
];
children.push(table(['Sl. No', 'Topic', 'Page No.'], toc.map(([n, t, key]) => [n, t, String(pages[key] || '')]), [1100, 6626, 1300]));
children.push(pageBreak());

// ---------- 1 Introduction ----------
children.push(H1('1. Introduction'));
children.push(H2('1.1 Problem Statement'));
children.push(P('Educational institutions lack an integrated, intelligent and centralised system for managing laboratory equipment failures and maintenance. Existing informal processes record individual complaints and resolve them independently; they do not preserve the relationship between an asset, its recurring failures, earlier diagnoses, repair procedures and outcomes. Because users describe the same technical problem in different words, keyword search cannot connect similar failures, so technicians repeat troubleshooting that has already been done. Administrators cannot easily answer questions such as which equipment fails most often, which laboratory has the most breakdowns, how long repairs take, or which assets should be prioritised for preventive maintenance or replacement.'));
children.push(H2('1.2 Short Description'));
children.push(P('LabTrace provides a single platform in which:'));
[
  '**Students** report a failure against a specific asset in plain language and track its progress. While typing, the system shows similar resolved incidents and help articles found by semantic search.',
  '**Administrators** see unassigned incidents, assign a technician manually or automatically (a stored procedure selects the technician whose skills best match the equipment category, using a recursive category hierarchy, and who has the lowest workload), and manage labs, equipment, spare parts and users.',
  '**Technicians** work on their assigned incidents and record the diagnosis, root cause, action taken, outcome and spare parts used. A stored procedure saves all of this in one transaction; a trigger checks and reduces the spare-part stock.',
  'Every status change is recorded automatically in an incident status log (a weak entity) by triggers that also reject invalid transitions and keep the equipment status in sync.',
  'The reporter confirms the repair (closes the incident) or reopens it if the problem returns.',
  'The analytics page computes MTBF, MTTR, repeat failures, a reliability score, a risk level and a predicted next-failure date per asset, plus breakdowns by lab, category and root cause.',
].forEach((b) => children.push(bullet(b)));

// ---------- 2 URS ----------
children.push(H1('2. User Requirements Specification'));
children.push(H2('2.1 Functional Requirements'));
children.push(table(['Role', 'Requirements'], [
  ['Student', 'Self-register with SRN; log in / log out\nReport an incident (equipment, title, description, severity)\nSee similar past failures while typing\nView only own incidents, their status timeline and repair details\nClose a resolved incident or reopen it; add discussion notes\nSearch the knowledge base and read articles'],
  ['Technician', 'View all incidents and asset histories (shared knowledge)\nView own active jobs; start work on an assigned incident\nRecord maintenance with spare parts (stock updated automatically)\nCreate and edit knowledge-base articles; edit incident tags\nView spare-part inventory'],
  ['Administrator', 'Everything above, plus: assign / re-assign technicians (manual or automatic)\nCreate, edit and delete equipment and labs (JSON specifications)\nAdd spare parts, restock\nCreate users, change roles, activate / deactivate accounts\nClose / reopen / cancel incidents\nReliability analytics dashboard; delete KB articles; rebuild the knowledge base'],
], [1800, 7226]));
children.push(gap());
children.push(H2('2.2 Non-Functional Requirements'));
[
  '**Security:** passwords hashed with bcrypt; sessions are signed JWTs in httpOnly cookies; access is checked in the front-end route guard, in every API route and again inside PostgreSQL through database roles and row-level security.',
  '**Integrity:** primary, foreign, unique and CHECK constraints; triggers enforce business rules (valid status transitions, stock never negative, only technicians own repair records).',
  '**Consistency:** multi-step operations (repair + parts + status) run in a single transaction inside a stored procedure.',
  '**Availability:** the relational workflow keeps working even if the knowledge-base database is unavailable.',
  '**Usability:** plain-language reporting, live suggestions, clean role-specific dashboards.',
].forEach((b) => children.push(bullet(b)));
children.push(H2('2.3 Technology Stack and Justification'));
children.push(table(['Layer', 'Technology', 'Why it fits LabTrace'], [
  ['Relational database', 'PostgreSQL 16', 'Equipment, incidents, assignments, repairs and parts are highly related and need strict integrity. PostgreSQL offers rich constraints, PL/pgSQL triggers, procedures and functions, recursive CTEs (category hierarchy), JSONB (variable equipment specifications), generated columns, and - importantly - database roles with column privileges and Row-Level Security, so role-based access is enforced by the database itself.'],
  ['NoSQL / vector database', 'MongoDB 7 (Docker) + vector search', 'Failure narratives, diagnoses, notes, tags and articles are free text of varying shape that grows over time (e.g. an array of discussion notes). A document model stores each incident\'s knowledge as one flexible document with embedded equipment details. Each document also stores a 384-dimension embedding; exact cosine k-NN over these vectors (or MongoDB Atlas $vectorSearch when available) finds semantically similar failures.'],
  ['Embeddings', 'Built-in offline concept embedder (default); optional all-MiniLM-L6-v2 sentence-transformer', 'Converts any description into a vector so that "gets too hot and turns off" and "thermal shutdown" end up close together. Runs fully locally with no paid API; the neural model can be switched on with one setting.'],
  ['Web framework', 'Next.js 16 (App Router), React 19', 'One project contains UI pages, server components that query the database directly, and REST API route handlers. The proxy (middleware) protects routes before pages render.'],
  ['Authentication', 'bcryptjs + jose (JWT), httpOnly cookie', 'Simple, standard and secure session handling without an external service.'],
  ['Database drivers', 'node-postgres (pg), MongoDB Node driver', 'Official, parameterised queries (protection against SQL injection).'],
  ['Tooling', 'Docker Compose, Git/GitHub, Playwright', 'Reproducible database setup, version control and automated screenshots / tests.'],
], [1700, 2200, 5126]));
children.push(gap());
children.push(H2('2.4 Justification for the Choice of NoSQL Database'));
[
  'The heart of the problem (Section 3.3 / 3.4 of the problem description) is **inconsistent natural-language descriptions**. Answering "has this happened before?" requires similarity by meaning, which needs vectors and nearest-neighbour search - not exact matching on relational columns.',
  'Incident knowledge is **semi-structured and evolving**: a report starts with only a description, later gains a diagnosis and resolution, collects any number of notes and tags, and may be re-embedded with a better model. A schema-flexible document fits this naturally while the authoritative, transactional facts stay in PostgreSQL.',
  'MongoDB keeps the **text and its vector in the same document**, so a single query returns the matching incident together with its fix. The same data works with MongoDB Atlas $vectorSearch (index script included) when the project is moved to the cloud.',
  'Separating the two stores applies **polyglot persistence**: PostgreSQL for integrity and analytics, MongoDB for flexible knowledge and similarity search. The incident_id links both.',
].forEach((b) => children.push(bullet(b)));

// ---------- 3 ER ----------
children.push(H1('3. E-R Model'));
children.push(H2('3.1 List of Entities'));
children.push(table(['Entity', 'Type', 'Key attribute(s)', 'Description'], [
  ['USER', 'Strong', 'user_id', 'Student, technician or administrator (role attribute)'],
  ['LAB', 'Strong', 'lab_id', 'Laboratory with a composite location'],
  ['EQUIPMENT_CATEGORY', 'Strong', 'category_id', 'Hierarchical category (recursive relationship SUBCATEGORY_OF)'],
  ['EQUIPMENT', 'Strong', 'equipment_id', 'A laboratory asset'],
  ['INCIDENT', 'Strong', 'incident_id', 'A reported failure of an equipment'],
  ['INCIDENT_STATUS_LOG', 'WEAK', 'partial key log_seq (+ incident_id of owner)', 'History of status changes; cannot exist without its INCIDENT (identifying relationship HAS_LOG, total participation)'],
  ['MAINTENANCE_RECORD', 'Strong', 'record_id', 'Repair work done by a technician for an incident'],
  ['SPARE_PART', 'Strong', 'part_id', 'Inventory item consumed during repairs'],
], [2300, 1000, 2400, 3326], { highlight: (r) => r[1] === 'WEAK' }));
children.push(caption('Weak entity highlighted.'));
children.push(H2('3.2 Non-Simple Attributes'));
children.push(table(['Attribute', 'Entity', 'Kind', 'Mapping'], [
  ['location (building, floor_no, room_no)', 'LAB', 'Composite', 'Flattened into three columns with a UNIQUE constraint'],
  ['phone_no', 'USER', 'Multivalued', 'Separate relation user_phones(user_id, phone_no, phone_type)'],
  ['labour_hours', 'MAINTENANCE_RECORD', 'Derived (completed_at - started_at)', 'STORED GENERATED column'],
  ['age_years', 'EQUIPMENT', 'Derived (now - purchase_date)', 'Computed in fn_reliability_score()'],
  ['specifications', 'EQUIPMENT', 'Composite / semi-structured (cpu, gpu, ram_gb…)', 'JSONB column'],
  ['log_seq', 'INCIDENT_STATUS_LOG', 'Partial key of weak entity', 'Composite PK (incident_id, log_seq)'],
], [2600, 2000, 2200, 2226]));
children.push(gap());
children.push(H2('3.3 Relationships and Cardinalities'));
children.push(table(['Relationship', 'Entities', 'Cardinality', 'Attributes'], [
  ['IN_CHARGE_OF', 'USER - LAB', '1 : N (partial)', '-'],
  ['HOUSES', 'LAB - EQUIPMENT', '1 : N (total on equipment)', '-'],
  ['BELONGS_TO', 'EQUIPMENT - CATEGORY', 'N : 1 (total on equipment)', '-'],
  ['SUBCATEGORY_OF', 'CATEGORY - CATEGORY', '1 : N (recursive)', '-'],
  ['REPORTS', 'USER - INCIDENT', '1 : N', '-'],
  ['FAILURE_OF', 'INCIDENT - EQUIPMENT', 'N : 1', '-'],
  ['ASSIGNED_TO', 'INCIDENT - USER (technician)', 'M : N (over time; one active)', 'assigned_at, is_active, notes'],
  ['HAS_LOG (identifying)', 'INCIDENT - STATUS_LOG', '1 : N (total)', '-'],
  ['CHANGED_BY', 'STATUS_LOG - USER', 'N : 1', '-'],
  ['REPAIRED_BY', 'INCIDENT - MAINTENANCE_RECORD', '1 : N', '-'],
  ['PERFORMS', 'USER (technician) - MAINTENANCE_RECORD', '1 : N', '-'],
  ['USES', 'MAINTENANCE_RECORD - SPARE_PART', 'M : N', 'quantity, unit_cost_at_use'],
  ['SKILLED_IN', 'USER (technician) - CATEGORY', 'M : N', 'proficiency'],
], [2200, 3100, 2200, 1526]));
children.push(H2('3.4 ER Diagram'));
children.push(img('docs/diagrams/er_diagram.png', 600, 760));
children.push(caption('Figure 1 - ER diagram (Chen notation; double rectangle = weak entity, double diamond = identifying relationship, double ellipse = multivalued, dashed ellipse = derived, underline = key, thick line = total participation).'));

// ---------- 4 Relational ----------
children.push(H1('4. Relational Model'));
children.push(H2('4.1 List of Relations'));
children.push(table(['Relation (schema)', 'From ER', 'Keys'], [
  ['users(user_id, institution_id, full_name, email, password_hash, role, department, is_active, created_at)', 'Entity USER', 'PK user_id; UQ email, institution_id'],
  ['user_phones(user_id, phone_no, phone_type)', 'NOT an entity - multivalued attribute', 'PK (user_id, phone_no); FK user_id'],
  ['labs(lab_id, lab_code, lab_name, building, floor_no, room_no, capacity, incharge_id)', 'Entity LAB + IN_CHARGE_OF', 'PK lab_id; FK incharge_id → users'],
  ['equipment_categories(category_id, category_name, parent_id, expected_life_years, description)', 'Entity + recursive SUBCATEGORY_OF', 'PK category_id; FK parent_id → itself'],
  ['equipment(equipment_id, asset_tag, equipment_name, category_id, lab_id, manufacturer, model_no, serial_no, purchase_date, purchase_cost, warranty_expiry, status, specifications)', 'Entity EQUIPMENT + HOUSES + BELONGS_TO', 'PK equipment_id; FK category_id, lab_id'],
  ['incidents(incident_id, equipment_id, reported_by, title, description, severity, status, reported_at, resolved_at, closed_at)', 'Entity INCIDENT + REPORTS + FAILURE_OF', 'PK incident_id; FK equipment_id, reported_by'],
  ['incident_status_log(incident_id, log_seq, old_status, new_status, changed_by, changed_at, remarks)', 'WEAK entity', 'PK (incident_id, log_seq); FK incident_id ON DELETE CASCADE'],
  ['assignments(assignment_id, incident_id, technician_id, assigned_by, assigned_at, is_active, notes)', 'NOT an entity - M:N relationship ASSIGNED_TO', 'PK assignment_id; partial UNIQUE (incident_id) WHERE is_active'],
  ['technician_skills(technician_id, category_id, proficiency)', 'NOT an entity - M:N relationship SKILLED_IN', 'PK (technician_id, category_id)'],
  ['maintenance_records(record_id, incident_id, technician_id, diagnosis, root_cause, action_taken, outcome, started_at, completed_at, labour_hours)', 'Entity + REPAIRED_BY + PERFORMS', 'PK record_id; FK incident_id, technician_id'],
  ['spare_parts(part_id, part_no, part_name, part_category, unit_cost, qty_in_stock, reorder_level)', 'Entity SPARE_PART', 'PK part_id; UQ part_no'],
  ['part_usage(record_id, part_id, quantity, unit_cost_at_use)', 'NOT an entity - M:N relationship USES', 'PK (record_id, part_id)'],
], [4900, 2300, 1826], { size: 19, highlight: (r) => r[1].startsWith('NOT') }));
children.push(caption('Relations that are not entities in the ER model are highlighted.'));
children.push(P('**Normalisation:** every relation has an atomic-valued schema (1NF; the multivalued phone attribute is in its own relation), every non-key attribute depends on the whole key (2NF; e.g. proficiency depends on both technician and category) and there are no transitive dependencies (3NF; lab and category details are referenced by foreign keys instead of being repeated in equipment). unit_cost_at_use is intentionally stored in part_usage because it is the historical price at the time of use, not a copy of the current price.'));
children.push(H2('4.2 Schema Diagram'));
children.push(P('The diagram is rotated to use the full page (a full-resolution copy is in docs/diagrams/schema_diagram.png).'));
children.push(img('docs/diagrams/schema_diagram_rotated.png', 620, 800));
children.push(caption('Figure 2 - Relational schema with primary keys (highlighted), data types, constraints and foreign keys (arrows). Purple headers = relations that are not entities.'));

// ---------- 5 DDL ----------
children.push(H1('5. SQL DDL Statements'));
children.push(P('The database is created by five scripts in the sql/ folder, run in order by scripts/setup_db.sh. The complete table definitions (sql/01_schema.sql) are shown below; the functions, procedures, triggers, views and security scripts follow with their key parts. Execution logs are in sql/logs/.'));
children.push(H2('5.1 Tables, Keys and Constraints (01_schema.sql)'));
children.push(...code(rd('sql/01_schema.sql').split('\n').filter((l, i) => i > 6).join('\n'), 14));
children.push(H2('5.2 Database Objects Summary'));
children.push(table(['Object', 'Name', 'Purpose'], [
  ['Trigger (BEFORE UPDATE)', 'trg_incident_validate_status', 'Allows only valid status transitions; sets resolved_at / closed_at'],
  ['Trigger (AFTER INSERT)', 'trg_incident_after_insert', 'Writes first status-log row; marks equipment faulty for high/critical'],
  ['Trigger (AFTER UPDATE)', 'trg_incident_status_log', 'Appends to incident_status_log (weak entity); syncs equipment status'],
  ['Trigger (BEFORE INSERT)', 'trg_assignment_before_insert', 'Checks user is an active technician; deactivates previous assignment'],
  ['Trigger (AFTER INSERT)', 'trg_assignment_after_insert', 'Moves incident to "assigned"'],
  ['Trigger (BEFORE INSERT)', 'trg_part_usage_stock', 'Locks the part row, rejects insufficient stock, decrements stock, freezes unit cost'],
  ['Trigger (BEFORE INSERT/UPDATE)', 'trg_mr_check_technician', 'Only technicians may own maintenance records'],
  ['Procedure', 'sp_assign_technician', 'Manual or automatic assignment (recursive CTE over category ancestors + workload)'],
  ['Procedure', 'sp_complete_maintenance', 'Repair record + parts (JSONB loop) + status change in one transaction'],
  ['Procedure', 'sp_restock_part', 'Adds stock with validation'],
  ['Function', 'fn_equipment_mtbf_hours / fn_equipment_mttr_hours', 'Mean time between failures / to repair'],
  ['Function', 'fn_repeat_failures', 'Failures within 30 days after a repair (correlated sub-query)'],
  ['Function', 'fn_reliability_score / fn_risk_level / fn_predicted_next_failure', 'Predictive reliability indicators'],
  ['Function (SECURITY DEFINER)', 'fn_auth_lookup / fn_register_student', 'Only operations allowed before login'],
  ['Function', 'app_uid()', 'Returns the logged-in user id from the session variable app.user_id'],
  ['View (security_invoker)', 'v_incident_overview, v_equipment_reliability, v_technician_workload, v_low_stock_parts', 'Reusable joined / analytical views that respect RLS'],
], [2500, 3300, 3226], { size: 19 }));
children.push(gap());
children.push(H2('5.3 Trigger Example - Stock Check (02_functions_triggers.sql)'));
const fnSql = rd('sql/02_functions_triggers.sql');
const cut = (s, a, b) => s.slice(s.indexOf(a), s.indexOf(b, s.indexOf(a)) + b.length);
children.push(...code(cut(fnSql, '-- C6.', 'FOR EACH ROW EXECUTE FUNCTION trg_fn_part_usage_stock();'), 14));
children.push(H2('5.4 Trigger Example - Status Transition Validation'));
children.push(...code(cut(fnSql, '-- C1.', 'FOR EACH ROW EXECUTE FUNCTION trg_fn_incident_validate_status();'), 14));
children.push(H2('5.5 Stored Procedure - Automatic Technician Assignment (recursive CTE)'));
children.push(...code(cut(fnSql, 'CREATE OR REPLACE PROCEDURE sp_assign_technician', 'END $$;'), 14));
children.push(H2('5.6 Stored Procedure - Complete Maintenance in One Transaction'));
children.push(...code(cut(fnSql, 'CREATE OR REPLACE PROCEDURE sp_complete_maintenance', 'END $$;'), 14));
children.push(H2('5.7 Function - Reliability Score'));
children.push(...code(cut(fnSql, 'CREATE OR REPLACE FUNCTION fn_reliability_score', 'END $$;'), 14));
children.push(H2('5.8 Role-Based Access Control in the Database (04_security.sql)'));
children.push(P('The web server connects as labtrace_app, a NOINHERIT login role that owns no privileges itself. For every request lib/db.js opens a transaction, runs SET LOCAL ROLE lt_student / lt_technician / lt_admin and stores the user id in app.user_id. PostgreSQL then applies the GRANTs, column privileges and Row-Level Security policies below - even a bug in the web code cannot let a student read another student\'s incidents or a password hash.'));
const sec = rd('sql/04_security.sql');
children.push(...code(cut(sec, 'DO $$', 'GRANT lt_student, lt_technician, lt_admin TO labtrace_app;'), 14));
children.push(...code(cut(sec, '-- ---------- common read access', "GRANT ALL ON ALL SEQUENCES IN SCHEMA labtrace TO lt_admin;"), 14));
children.push(...code(cut(sec, '-- ----- incidents -----', "WITH CHECK (reported_by = app_uid() AND status IN ('closed','reopened'));"), 14));

// ---------- 6 DML ----------
children.push(H1('6. SQL DML Statements'));
children.push(H2('6.1 Sample Data (INSERT) - 05_seed.sql'));
children.push(P('scripts/generate_seed.py deterministically generates realistic data: 28 users, 6 labs, 18 hierarchical categories, 57 assets, 22 spare parts and two years of history - 167 incidents, 785 status-log rows, 162 assignments, 156 maintenance records and 118 part-usage rows. An excerpt:'));
const seed = rd('sql/05_seed.sql').split('\n');
const pick = (start, n) => { const i = seed.findIndex((l) => l.startsWith(start)); return seed.slice(i, i + n).join('\n') + '\n  ...'; };
children.push(...code([pick('INSERT INTO labs', 5), pick('INSERT INTO equipment_categories', 5), pick('INSERT INTO equipment (', 3), pick('INSERT INTO incidents', 3)].join('\n\n'), 13));
children.push(H2('6.2 INSERT / UPDATE / DELETE with Triggers, Procedures and RLS (07_dml_demo.sql)'));
children.push(P('Each block below runs as a specific database role and is rolled back so that it can be repeated. Expected errors (RLS rejection, column privilege, insufficient stock, invalid transition, foreign key, CHECK constraint) prove that the rules are enforced by the database.'));
children.push(...code(rd('sql/07_dml_demo.sql').split('\n').slice(8).join('\n'), 13));
children.push(H3('Execution output (excerpt of sql/logs/07_dml_demo.log)'));
const dmlLog = rd('sql/logs/07_dml_demo.log').split('\n').filter((l) => /ERROR|====|---|INSERT 0|technician|stock|SP-|resolved|faulty|my_incidents|\|/.test(l)).slice(0, 70).join('\n');
children.push(...code(dmlLog, 13));
children.push(H2('6.3 Queries: Join, Nested, Correlated, Recursive, CTE (06_queries.sql)'));
const qs = rd('sql/06_queries.sql');
const qBlock = (n) => {
  const start = qs.indexOf(`-- Q${n} `);
  const next = qs.indexOf('-- ----', qs.indexOf(';', start));
  return qs.slice(qs.lastIndexOf('-- ----', start), next === -1 ? undefined : next).trim();
};
[
  ['Join (5 tables)', 1], ['Join + GROUP BY + HAVING', 2], ['Outer join', 3], ['Nested sub-query', 4], ['Nested IN (two levels)', 5],
  ['Correlated sub-query', 6], ['Correlated EXISTS - repeat failures', 7], ['Correlated in SELECT and WHERE', 8],
  ['Recursive CTE - category tree', 9], ['Recursive CTE - weak-entity timeline', 10], ['Multiple CTEs', 11], ['Window function', 12],
  ['Set operation - UNION ALL', 13], ['Set operation - EXCEPT', 14],
].forEach(([t, n]) => { children.push(H3(`Q${n}. ${t}`)); children.push(...code(qBlock(n), 14)); });

// ---------- 7 NoSQL ----------
children.push(H1('7. NoSQL / Vector Database Commands'));
children.push(P('Database labtrace_kb has two collections. **incident_knowledge** holds one document per incident (description, embedded equipment details, diagnosis, resolution, tags, notes array and the 384-d embedding). **kb_articles** holds technical guides. The web application performs the same operations through lib/knowledge.js (create on report, update on repair / notes / tags / article edit, read for search, delete by admin).'));
children.push(H2('7.1 Sample Document'));
children.push(...code(rd('docs/sample_mongo_document.json'), 14));
children.push(H2('7.2 Collection Creation with Schema Validation and Indexes (nosql/01_create_collections.js)'));
children.push(...code(rd('nosql/01_create_collections.js'), 13));
children.push(H2('7.3 Vector Search Index (nosql/02_vector_index.js)'));
children.push(...code(rd('nosql/02_vector_index.js'), 13));
children.push(H2('7.4 Create, Read, Update, Delete and Vector Queries (nosql/03_crud_and_vector_queries.js)'));
children.push(...code(rd('nosql/03_crud_and_vector_queries.js'), 13));
children.push(H2('7.5 How Semantic Search Works'));
[
  'When an incident is reported or repaired, the text (title + description + diagnosis + resolution + category) is converted into a 384-number vector by the all-MiniLM-L6-v2 sentence-transformer and stored with the document (field embedding, plus embedding_model).',
  'A search query is embedded the same way. The app computes exact cosine similarity between the query vector and the stored vectors (k-NN) and ranks the results; on MongoDB Atlas the same search can run inside the database with $vectorSearch.',
  'Results are filtered (only resolved incidents, same embedding model, excluding the current incident) and near-duplicates are removed. Students receive problem summaries only; staff also see diagnosis and fix.',
  'Comparison in the app: the query "computer gets too hot and turns off" returns 0 keyword matches but the top semantic results are earlier thermal-shutdown incidents with their fixes (see Figure in Section 10).',
].forEach((b) => children.push(bullet(b)));

// ---------- 8 Results ----------
children.push(H1('8. Results'));
children.push(P('Resulting tables after loading the schema and sample data and running the application workflow (psql output).'));
const results = [
  ['r01_users', 'users (password_hash truncated)'], ['r02_user_phones', 'user_phones (multivalued attribute)'], ['r03_labs', 'labs'],
  ['r04_categories', 'equipment_categories (self-referencing)'], ['r05_equipment', 'equipment'], ['r06_incidents', 'incidents (latest)'],
  ['r07_status_log', 'incident_status_log (weak entity) for one incident'], ['r08_assignments', 'assignments'], ['r09_maintenance', 'maintenance_records (labour_hours is generated)'],
  ['r10_spare_parts', 'spare_parts'], ['r11_part_usage', 'part_usage'], ['r12_technician_skills', 'technician_skills'],
  ['r13_reliability_view', 'v_equipment_reliability (functions MTBF/MTTR/score/risk/prediction)'], ['r14_recursive_tree', 'Recursive CTE result - category tree'],
  ['r15_correlated', 'Correlated EXISTS - repeat failures'], ['r16_join_labs', 'Join + GROUP BY + HAVING - incidents per lab'],
  ['r17_rls_demo', 'Row-Level Security: same query, student sees 10 rows, admin sees all; password_hash denied'],
];
results.forEach(([f, t], i) => { children.push(img(`docs/results/${f}.png`, 620, 700)); children.push(caption(`Result ${i + 1} - ${t}`)); });

// ---------- 9 Tree ----------
children.push(H1('9. Next.js Project Tree Structure'));
children.push(...code(rd('docs/project_tree.txt'), 14));

// ---------- 10 Screenshots ----------
children.push(H1('10. Sample Screenshots of Application Code and Demo'));
children.push(H2('10.1 Application Code'));
[
  ['c01_withUser_db_role', 'lib/db.js - every request switches to the user\'s PostgreSQL role'],
  ['c02_proxy_route_guard', 'proxy.js - front-end route protection and role-based page access'],
  ['c03_semantic_search', 'lib/knowledge.js - vector search ($vectorSearch or cosine k-NN)'],
  ['c04_maintenance_api', 'API route calling the stored procedure and updating MongoDB'],
  ['c05_trigger_stock', 'Stock trigger'], ['c06_rls_policies', 'Row-Level Security policies'],
].forEach(([f, t]) => { children.push(img(`docs/code/${f}.png`, 600, 700)); children.push(caption(t)); });
children.push(H2('10.2 Demo'));
[
  ['01_login', 'Login page with demo accounts'], ['02_student_dashboard', 'Student dashboard - only own reports'],
  ['03_report_similar_suggestions', 'Reporting a failure: similar past failures appear while typing (semantic search)'],
  ['04_student_incident_created', 'Incident created - status history written by trigger'],
  ['05_student_incidents_rls', 'Student incident list restricted by row-level security'],
  ['06_kb_semantic_search', 'Knowledge base - semantic (vector) search'], ['07_kb_keyword_search', 'Same query with keyword search finds nothing'],
  ['08_student_denied_admin_page', 'Role-based access: a student opening /analytics is redirected'],
  ['09_admin_dashboard', 'Admin dashboard - unassigned incidents, highest-risk assets, low stock'],
  ['10_admin_assign_panel', 'Admin assigns a technician (manual or automatic stored procedure)'],
  ['11_admin_analytics', 'Reliability analytics'], ['12_equipment_list', 'Equipment list (recursive category filter)'],
  ['13_equipment_reliability', 'Equipment detail - predictive reliability and history'], ['14_spare_parts', 'Spare-part inventory'],
  ['15_users_roles', 'User and role management'], ['16_labs', 'Laboratories'], ['17_technician_dashboard', 'Technician dashboard - my active jobs'],
  ['18_technician_maintenance_form', 'Technician records diagnosis, action and spare parts'],
  ['19_incident_resolved_timeline', 'Resolved incident - maintenance record, timeline and similar incidents'], ['20_kb_article', 'Knowledge-base article'],
].forEach(([f, t]) => { children.push(img(`docs/screenshots/${f}.png`, 600, 640)); children.push(caption(t)); });

// ---------- 11 Testing ----------
children.push(H1('11. Testing, GitHub and Individual Contribution'));
children.push(H2('11.1 Testing'));
children.push(P('sql/07_dml_demo.sql tests the database rules directly (Section 6.2). scripts/smoke-test.mjs is an automated end-to-end test that drives the REST API as the three roles and checks both the workflow and the access rules. Result of the final run:'));
children.push(...code(rd('docs/smoke_test_results.log'), 14));
children.push(H2('11.2 GitHub Repository'));
children.push(P('Repository: **https://github.com/Shryes19/labtrace** - contains the complete source code, SQL and NoSQL scripts, diagrams, screenshots, this report and a README with step-by-step setup instructions (docker compose, database scripts, npm run kb:sync, npm run dev).'));
children.push(H2('11.3 Individual Contribution'));
children.push(table(['SRN', 'Name', 'Contribution'], [
  ['PES1UG24AM272', 'Shryes M', 'ER model and relational schema design; PostgreSQL DDL with constraints; triggers, stored procedures, functions and views; role-based access control with database roles and row-level security; sample data generator; analytical SQL queries (join, nested, correlated, recursive CTE)'],
  ['PES1UG24AM261', 'Shesanth K', 'MongoDB knowledge base and vector (semantic) search; Next.js pages and API routes with PostgreSQL / MongoDB integration; authentication (bcrypt, JWT, route proxy); reliability analytics dashboard; testing (DML demo and automated end-to-end test), screenshots and documentation'],
], [1900, 1800, 5326]));

// ---------- 12 Rubrics ----------
children.push(pageBreak());
children.push(H1('12. Evaluation Rubrics - Completion Status'));
children.push(table(['#', 'Criteria', 'Distribution', 'Status / where implemented'], [
  ['1', 'Database Design', 'ER diagram (2), relational schema with keys, relationships and constraints (3)', 'Completed - Sections 3 and 4; weak entity, composite / multivalued / derived attributes, recursive and M:N relationships'],
  ['2', 'Database Creation', 'SQL DDL with constraints (4), NoSQL / vector database creation (4), technology justification (1)', 'Completed - 11 tables with PK/FK/UNIQUE/CHECK/generated column/partial index (sql/01); MongoDB collections with validators, indexes and vector index (nosql/01-02); Section 2.3-2.4'],
  ['3', 'SQL Operations and Queries', 'DML operations (4), nested / correlated / recursive and join queries (4)', 'Completed - seed + DML demo (sql/05, 07) and app CRUD; 16 analytical queries (sql/06)'],
  ['4', 'Advanced Database Concepts', 'Procedure / function, trigger, CTE (6), NoSQL / vector feature RUD (7)', 'Completed - 3 procedures, 9 functions, 7 triggers, 4 views, recursive CTEs; MongoDB read (vector + keyword search), update ($set/$push/$addToSet/$inc), delete'],
  ['5', 'Web Application and Database Integration', 'Next.js interface (3), backend / API and database integration (2)', 'Completed - 16 pages, 23 API routes, PostgreSQL + MongoDB integration'],
  ['6', 'Authentication and Authorization', 'Authentication front end and backend, minimum two roles and RBAC in the database (4)', 'Completed - bcrypt + JWT login/registration; 3 roles; proxy + API checks; PostgreSQL roles, column privileges and RLS policies'],
  ['7', 'Documentation, Git/GitHub, Demonstration, Testing and Originality', 'Documentation, Git/GitHub (2), originality and individual contribution (4)', 'Completed - this report, README, diagrams, logs, 29-step automated test; GitHub repository'],
], [500, 2000, 3000, 3526], { size: 19 }));

// ---------------------------------------------------------------- document
const doc = new Document({
  creator: 'Shryes M, Shesanth K', title: 'LabTrace - DBMS Project Report',
  styles: {
    default: { document: { run: { font: FONT, size: 24 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { font: FONT, size: 32, bold: true, color: '1F3864' }, paragraph: { spacing: { before: 360, after: 160 }, keepNext: true, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { font: FONT, size: 27, bold: true, color: '2F5496' }, paragraph: { spacing: { before: 240, after: 120 }, keepNext: true, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { font: FONT, size: 24, bold: true, italics: true }, paragraph: { spacing: { before: 180, after: 80 }, keepNext: true, outlineLevel: 2 } },
    ],
  },
  numbering: { config: [{ reference: 'bul', levels: [
    { level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } },
    { level: 1, format: LevelFormat.BULLET, text: '◦', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1080, hanging: 270 } } } },
  ] }] },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1300, bottom: 1200, left: 1440, right: 1440 } } },
    headers: { default: new Header({ children: [new Paragraph({
      tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_W }],
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: '999999', space: 2 } },
      children: [new TextRun({ text: 'UE23CS351A: DBMS Project', font: FONT, size: 20 }), new TextRun({ text: '\tAug-Dec 2026', font: FONT, size: 20 })] })] }) },
    footers: { default: new Footer({ children: [new Paragraph({
      tabStops: [{ type: TabStopType.CENTER, position: CONTENT_W / 2 }, { type: TabStopType.RIGHT, position: CONTENT_W }],
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: '999999', space: 2 } },
      children: [new TextRun({ text: 'Aug-Dec 2026', font: FONT, size: 18 }), new TextRun({ text: '\tShryes M - Shesanth K', font: FONT, size: 18 }),
        new TextRun({ children: ['\tPage ', PageNumber.CURRENT, ' / ', PageNumber.TOTAL_PAGES], font: FONT, size: 18 })] })] }) },
    children,
  }],
});

Packer.toBuffer(doc).then((buf) => {
  const out = path.join(ROOT, 'docs', 'LabTrace_DBMS_Project_Report.docx');
  fs.writeFileSync(out, buf);
  console.log('written', out);
});
