"""Captures documentation screenshots of the running app (python3 scripts/screenshots.py)."""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3000"
OUT = Path(__file__).resolve().parent.parent / "docs" / "screenshots"
OUT.mkdir(parents=True, exist_ok=True)


def login(page, email):
    page.goto(f"{BASE}/login")
    page.fill("input[type=email]", email)
    page.fill("input[type=password]", "Password@123")
    page.click("button.btn")
    page.wait_for_url("**/dashboard")


def shot(page, name, full=True):
    page.wait_for_timeout(500)
    page.screenshot(path=str(OUT / f"{name}.png"), full_page=full)
    print("saved", name)


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    ctx = browser.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=1)
    page = ctx.new_page()
    page.on("dialog", lambda d: d.accept())

    page.goto(f"{BASE}/login"); shot(page, "01_login", full=False)

    # ---------------- student
    login(page, "student@labtrace.edu"); shot(page, "02_student_dashboard")
    page.goto(f"{BASE}/incidents/new")
    page.select_option("select >> nth=0", label="CSL-101 - Computer Science Lab 1")
    page.select_option("select >> nth=1", index=4)
    page.fill("input[placeholder^='e.g.']", "PC switches off while compiling")
    page.fill("textarea", "The computer gets too hot and turns off after some time when I compile big programs.")
    page.select_option("select >> nth=2", "high")
    page.wait_for_selector(".result", timeout=8000); shot(page, "03_report_similar_suggestions")
    page.click("button:has-text('Submit report')")
    page.wait_for_url("**/incidents/*?created=1"); shot(page, "04_student_incident_created")
    new_id = page.url.split("/incidents/")[1].split("?")[0]
    page.goto(f"{BASE}/incidents"); shot(page, "05_student_incidents_rls")
    page.goto(f"{BASE}/knowledge")
    page.fill("input[placeholder^='e.g.']", "computer gets too hot and turns off")
    page.click("button:has-text('Search')"); page.wait_for_selector(".result"); shot(page, "06_kb_semantic_search")
    page.click("button:has-text('Keyword')"); page.wait_for_timeout(1200); shot(page, "07_kb_keyword_search", full=False)
    page.goto(f"{BASE}/analytics"); page.wait_for_url("**/dashboard?denied=1"); shot(page, "08_student_denied_admin_page", full=False)
    page.click("button:has-text('Log out')"); page.wait_for_url("**/login")

    # ---------------- admin
    login(page, "admin@labtrace.edu"); shot(page, "09_admin_dashboard")
    page.goto(f"{BASE}/incidents/{new_id}"); shot(page, "10_admin_assign_panel")
    page.select_option("form.card select", value="3")
    page.click("button:has-text('Assign')"); page.wait_for_selector(".alert.ok"); page.wait_for_timeout(800)
    page.goto(f"{BASE}/analytics"); shot(page, "11_admin_analytics")
    page.goto(f"{BASE}/equipment"); shot(page, "12_equipment_list", full=False)
    page.goto(f"{BASE}/equipment/3"); shot(page, "13_equipment_reliability")
    page.goto(f"{BASE}/parts"); shot(page, "14_spare_parts", full=False)
    page.goto(f"{BASE}/users"); shot(page, "15_users_roles", full=False)
    page.goto(f"{BASE}/labs"); shot(page, "16_labs", full=False)
    page.click("button:has-text('Log out')"); page.wait_for_url("**/login")

    # ---------------- technician
    login(page, "tech@labtrace.edu"); shot(page, "17_technician_dashboard")
    page.goto(f"{BASE}/incidents/{new_id}")
    page.fill("textarea >> nth=0", "CPU temperature 96 C under load; heat sink clogged with dust, thermal paste dry.")
    page.select_option("select >> nth=0", "Thermal / cooling")
    page.fill("textarea >> nth=1", "Cleaned heat sink and fans, applied fresh thermal paste, load temperature now 67 C.")
    page.click("button:has-text('+ Add part')")
    val = page.evaluate("""() => [...document.querySelectorAll('select')[2].options].find(o => o.text.startsWith('Thermal Paste')).value""")
    page.select_option("select >> nth=2", value=val)
    shot(page, "18_technician_maintenance_form")
    page.click("button:has-text('Save maintenance record')"); page.wait_for_selector(".alert.ok", timeout=8000)
    page.wait_for_timeout(1000); page.reload(); shot(page, "19_incident_resolved_timeline")
    page.goto(f"{BASE}/knowledge"); page.click("a.cell-title >> nth=0"); page.wait_for_selector("h1"); shot(page, "20_kb_article")
    browser.close()
