"""Renders psql query output as images for the report (python3 scripts/result_screens.py)."""
import subprocess, html, os, re, textwrap
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT = Path(__file__).resolve().parent.parent / "docs" / "results"
OUT.mkdir(parents=True, exist_ok=True)
ENV = {**os.environ, "PGPASSWORD": "postgres"}
Q = {
 "r01_users": "SELECT user_id, institution_id, full_name, email, left(password_hash,10)||'…' AS pwd_hash, role FROM users ORDER BY user_id LIMIT 12;",
 "r02_user_phones": "SELECT * FROM user_phones ORDER BY user_id LIMIT 8;",
 "r03_labs": "SELECT * FROM labs ORDER BY lab_id;",
 "r04_categories": "SELECT * FROM equipment_categories ORDER BY category_id;",
 "r05_equipment": "SELECT equipment_id AS id, asset_tag, equipment_name, category_id AS cat, lab_id AS lab, purchase_date, purchase_cost AS cost, status FROM equipment ORDER BY equipment_id LIMIT 12;",
 "r06_incidents": "SELECT incident_id AS id, equipment_id AS eq, reported_by AS by, left(title,32) AS title, severity, status, reported_at::date AS reported FROM incidents ORDER BY incident_id DESC LIMIT 12;",
 "r07_status_log": "SELECT incident_id, log_seq, old_status, new_status, changed_by, changed_at::timestamp(0), left(remarks,30) AS remarks FROM incident_status_log WHERE incident_id = (SELECT MAX(incident_id) FROM incidents WHERE status='closed') ORDER BY log_seq;",
 "r08_assignments": "SELECT assignment_id, incident_id, technician_id, assigned_by, assigned_at::timestamp(0), is_active FROM assignments ORDER BY assignment_id DESC LIMIT 10;",
 "r09_maintenance": "SELECT record_id, incident_id, technician_id AS tech, left(diagnosis,30) AS diagnosis, root_cause, outcome, labour_hours FROM maintenance_records ORDER BY record_id DESC LIMIT 10;",
 "r10_spare_parts": "SELECT * FROM spare_parts ORDER BY part_id;",
 "r11_part_usage": "SELECT * FROM part_usage ORDER BY record_id DESC LIMIT 10;",
 "r12_technician_skills": "SELECT * FROM technician_skills ORDER BY technician_id, proficiency DESC;",
 "r13_reliability_view": "SELECT asset_tag, total_failures AS fails, repeat_failures AS rep, mtbf_hours AS mtbf_h, mttr_hours AS mttr_h, reliability_score AS score, risk_level AS risk, predicted_next_failure AS next_fail FROM v_equipment_reliability ORDER BY reliability_score LIMIT 10;",
 "r14_recursive_tree": """WITH RECURSIVE tree AS (SELECT category_id, category_name, parent_id, 0 AS depth, category_name::text AS path, ARRAY[category_id] AS p FROM equipment_categories WHERE parent_id IS NULL UNION ALL SELECT c.category_id, c.category_name, c.parent_id, t.depth+1, t.path||' > '||c.category_name, t.p||c.category_id FROM equipment_categories c JOIN tree t ON c.parent_id=t.category_id) SELECT repeat('   ', depth)||category_name AS category, depth, path FROM tree ORDER BY p;""",
 "r15_correlated": "SELECT e.asset_tag, cur.incident_id, cur.title, cur.reported_at::date FROM incidents cur JOIN equipment e ON e.equipment_id=cur.equipment_id WHERE EXISTS (SELECT 1 FROM incidents prev WHERE prev.equipment_id=cur.equipment_id AND prev.incident_id<>cur.incident_id AND prev.resolved_at IS NOT NULL AND cur.reported_at BETWEEN prev.resolved_at AND prev.resolved_at + INTERVAL '30 days') ORDER BY cur.reported_at DESC LIMIT 10;",
 "r16_join_labs": "SELECT l.lab_code, COUNT(i.incident_id) AS incidents, COUNT(*) FILTER (WHERE i.severity IN ('high','critical')) AS serious, ROUND(AVG(EXTRACT(EPOCH FROM (i.resolved_at-i.reported_at))/3600)::numeric,1) AS avg_resolution_hrs FROM labs l JOIN equipment e ON e.lab_id=l.lab_id JOIN incidents i ON i.equipment_id=e.equipment_id GROUP BY l.lab_code HAVING COUNT(*)>5 ORDER BY incidents DESC;",
}
RLS = """SET search_path TO labtrace;
BEGIN; SET LOCAL ROLE lt_student; SELECT set_config('app.user_id','9',true) AS logged_in_user;
SELECT current_user AS db_role, COUNT(*) AS visible_incidents FROM incidents;
SELECT password_hash FROM users LIMIT 1;
ROLLBACK;
BEGIN; SET LOCAL ROLE lt_admin; SELECT set_config('app.user_id','1',true) AS logged_in_user;
SELECT current_user AS db_role, COUNT(*) AS visible_incidents FROM incidents;
ROLLBACK;"""

def run(sql, user="postgres"):
    env = {**os.environ, "PGPASSWORD": "postgres" if user == "postgres" else "labtrace_app"}
    p = subprocess.run(["psql", "-h", "localhost", "-U", user, "-d", "labtrace", "-X", "-e", "-c" if "\n" not in sql else "-f", sql if "\n" not in sql else "/dev/stdin"],
                       input=sql if "\n" in sql else None, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, env=env)
    return p.stdout

with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    pg = b.new_page(viewport={"width": 1500, "height": 400})
    items = list(Q.items()) + [("r17_rls_demo", RLS)]
    for name, sql in items:
        if name == "r17_rls_demo":
            out = run(RLS, user="labtrace_app")
        else:
            env = {**os.environ, "PGPASSWORD": "postgres", "PGOPTIONS": "-c search_path=labtrace"}
            res = subprocess.run(["psql", "-h", "localhost", "-U", "postgres", "-d", "labtrace", "-X", "-c", sql],
                                 capture_output=True, text=True, env=env).stdout
            pretty = re.sub(r" (FROM|WHERE|JOIN|GROUP BY|HAVING|ORDER BY|UNION ALL|SELECT c|SELECT 1) ", lambda m: "\n  " + m.group(1) + " ", sql)
            out = "\n".join(textwrap.fill(l, 110, subsequent_indent="    ") for l in pretty.split("\n")) + "\n" + res
        doc = f"""<html><body style="margin:0;background:#fff"><div id="t" style="display:inline-block;padding:14px 18px;background:#fbfbfa;border:1px solid #ddd;font:13px/1.35 'DejaVu Sans Mono',monospace;color:#111;white-space:pre">{html.escape("labtrace=# " + out.strip())}</div></body></html>"""
        pg.set_content(doc)
        pg.locator("#t").screenshot(path=str(OUT / f"{name}.png"))
        print("saved", name)
    b.close()
