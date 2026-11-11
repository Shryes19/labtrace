"""Renders selected source files as images for the report (python3 scripts/code_screens.py)."""
import html, re
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "code"
OUT.mkdir(parents=True, exist_ok=True)
SNIPS = [
    ("c01_withUser_db_role", "lib/db.js", "export async function withUser", "^}"),
    ("c02_proxy_route_guard", "proxy.js", "const PUBLIC", "^}"),
    ("c03_semantic_search", "lib/knowledge.js", "export async function semanticSearch", "^}"),
    ("c04_maintenance_api", "app/api/incidents/[id]/maintenance/route.js", "export const POST", "^}\\);"),
    ("c05_trigger_stock", "sql/02_functions_triggers.sql", "-- C6.", "FOR EACH ROW EXECUTE FUNCTION trg_fn_part_usage_stock"),
    ("c06_rls_policies", "sql/04_security.sql", "-- ----- incidents -----", "WITH CHECK \\(reported_by = app_uid\\(\\) AND status IN \\('closed','reopened'\\)\\);"),
]
with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    pg = b.new_page(viewport={"width": 1300, "height": 400})
    for name, file, start, end in SNIPS:
        lines = (ROOT / file).read_text().splitlines()
        i = next(k for k, l in enumerate(lines) if l.startswith(start) or start in l)
        j = next(k for k in range(i + 1, len(lines)) if re.search(end, lines[k]))
        body = "\n".join(f"<span style='color:#999'>{n+1:>4}</span>  {html.escape(lines[n])}" for n in range(i, j + 1))
        doc = f"""<html><body style="margin:0;background:#fff"><div id="t" style="display:inline-block;border:1px solid #ddd;border-radius:6px;overflow:hidden;font:12.5px/1.45 'DejaVu Sans Mono',monospace">
<div style="background:#eef1f6;padding:6px 12px;color:#333;font-family:Helvetica;font-size:12px;border-bottom:1px solid #ddd">{html.escape(file)}</div>
<div style="padding:10px 14px;background:#fbfbfa;color:#111;white-space:pre">{body}</div></div></body></html>"""
        pg.set_content(doc)
        pg.locator("#t").screenshot(path=str(OUT / f"{name}.png"))
        print("saved", name)
    b.close()
