#!/usr/bin/env python3
"""
Generates sql/05_seed.sql  - realistic, deterministic sample data for LabTrace.
Run:  python3 scripts/generate_seed.py
All demo accounts use the password:  Password@123
"""
import random, json, datetime as dt
from pathlib import Path

random.seed(42)
NOW = dt.datetime(2026, 11, 11, 18, 0, tzinfo=dt.timezone(dt.timedelta(hours=5, minutes=30)))
PWD = "$2b$10$6UQjaT4yIlgEW0gLjCl83OMyAYi6spp8F.yrWHoIG/DPCFjHDQXsq"  # Password@123

def q(v):
    if v is None:
        return "NULL"
    if isinstance(v, bool):
        return "TRUE" if v else "FALSE"
    if isinstance(v, (int, float)):
        return str(v)
    if isinstance(v, dt.datetime):
        return "'" + v.strftime("%Y-%m-%d %H:%M:%S%z") + "'"
    if isinstance(v, dt.date):
        return "'" + v.isoformat() + "'"
    return "'" + str(v).replace("'", "''") + "'"

def ins(table, cols, rows):
    out = [f"INSERT INTO {table} ({', '.join(cols)}) VALUES"]
    out.append(",\n".join("  (" + ", ".join(q(v) for v in r) + ")" for r in rows) + ";")
    return "\n".join(out) + "\n"

# ------------------------------------------------------------------ users
users = []  # (id, inst, name, email, role, dept, active)
users.append((1, "EMP1001", "Dr. Sunita Rao", "admin@labtrace.edu", "admin", "Lab Administration", True))
users.append((2, "EMP1002", "Prof. Mahesh Iyer", "hod.labs@labtrace.edu", "admin", "CSE (AI & ML)", True))
techs = [("Ravi Kumar", "tech@labtrace.edu"), ("Suresh Babu", "suresh.b@labtrace.edu"),
         ("Anil Shetty", "anil.s@labtrace.edu"), ("Priya Nair", "priya.n@labtrace.edu"),
         ("Mohammed Irfan", "irfan.m@labtrace.edu"), ("Kavya Gowda", "kavya.g@labtrace.edu")]
for i, (n, e) in enumerate(techs):
    users.append((3 + i, f"EMP20{i+1:02d}", n, e, "technician", "Lab Maintenance", True))
students = ["Aarav Sharma", "Ananya Reddy", "Rohan Mehta", "Diya Patel", "Karthik Rao", "Sneha Kulkarni",
            "Arjun Nair", "Meghana S", "Vikram Joshi", "Pooja Hegde", "Nikhil Bhat", "Ishita Verma",
            "Siddharth Menon", "Tanvi Desai", "Rahul Gupta", "Aditi Iyer", "Varun Shenoy", "Kriti Jain",
            "Pranav Kamath", "Shreya Pillai"]
for i, n in enumerate(students):
    email = "student@labtrace.edu" if i == 0 else n.lower().replace(" ", ".") + "@stu.labtrace.edu"
    users.append((9 + i, f"PES1UG24AM{201+i:03d}", n, email, "student", "CSE (AI & ML)", True))
STUDENT_IDS = [u[0] for u in users if u[4] == "student"]
TECH_IDS = [u[0] for u in users if u[4] == "technician"]

phones = []
for u in users:
    phones.append((u[0], f"9{random.randint(100000000, 999999999)}", "mobile"))
    if u[4] != "student" and random.random() < 0.6:
        phones.append((u[0], f"080{random.randint(10000000, 99999999)}", "office"))

# ------------------------------------------------------------------ labs
labs = [
    (1, "CSL-101", "Computer Science Lab 1", "B Block", 1, "B-101", 60, 3),
    (2, "AIML-GPU", "AI & ML GPU Research Lab", "F Block", 3, "F-305", 30, 4),
    (3, "NET-201", "Computer Networks Lab", "B Block", 2, "B-204", 40, 5),
    (4, "ECE-110", "Electronics & Instrumentation Lab", "MRD Block", 1, "M-110", 45, 6),
    (5, "IOT-302", "IoT & Embedded Systems Lab", "F Block", 3, "F-302", 36, 7),
    (6, "HPC-401", "High Performance Computing Lab", "F Block", 4, "F-401", 20, 4),
]

# ------------------------------------------------------------------ categories
cats = [
    (1, "Computing Equipment", None, 6, "All general-purpose computing assets"),
    (2, "Desktop Workstation", 1, 6, "Lab desktop PCs used for coursework"),
    (3, "GPU Workstation", 2, 5, "Workstations with NVIDIA/AMD GPUs for deep learning"),
    (4, "Laptop", 1, 4, "Portable computers issued to labs"),
    (5, "Server", 1, 7, "Rack servers and compute nodes"),
    (6, "Networking Equipment", None, 8, "Network infrastructure"),
    (7, "Network Switch", 6, 8, "Managed / unmanaged Ethernet switches"),
    (8, "Wireless Access Point", 6, 6, "Wi-Fi access points"),
    (9, "Router", 6, 8, "Routers and firewalls"),
    (10, "Electronic Instruments", None, 10, "Test and measurement instruments"),
    (11, "Oscilloscope", 10, 10, "Digital storage oscilloscopes"),
    (12, "Function Generator", 10, 10, "Signal / function generators"),
    (13, "Bench Power Supply", 10, 8, "Regulated DC power supplies"),
    (14, "AV Equipment", None, 6, "Audio-visual equipment"),
    (15, "Projector", 14, 5, "Classroom and lab projectors"),
    (16, "IoT & Embedded Kits", None, 4, "Development boards and kits"),
    (17, "Microcontroller Board", 16, 3, "Arduino / ESP32 / Raspberry Pi boards"),
    (18, "3D Printer", 16, 5, "FDM 3D printers"),
]
CAT_PARENT = {c[0]: c[2] for c in cats}

skills = []
tech_skill_map = {3: [2, 3, 4], 4: [3, 5, 2], 5: [6, 7, 8, 9], 6: [10, 11, 12, 13], 7: [16, 17, 18, 15], 8: [14, 15, 2, 4]}
for t, cs in tech_skill_map.items():
    for k, c in enumerate(cs):
        skills.append((t, c, 5 - k))

# ------------------------------------------------------------------ equipment
equip = []
eid = 0
def add_eq(lab, cat, name, manu, model, count, cost, years_old, specs):
    global eid
    for k in range(count):
        eid += 1
        pd = (NOW - dt.timedelta(days=int(365 * years_old + random.randint(-90, 90)))).date()
        warranty = pd + dt.timedelta(days=365 * random.choice([1, 2, 3]))
        tag = f"LT-{labs[lab-1][1].split('-')[0]}-{eid:03d}"
        equip.append([eid, tag, f"{name} #{k+1}", cat, lab, manu, model,
                      f"SN{random.randint(10**7, 10**8-1)}", pd, cost, warranty, "operational",
                      json.dumps(specs)])

add_eq(1, 2, "Dell OptiPlex Desktop", "Dell", "OptiPlex 7090", 10, 62000, 4.5,
       {"cpu": "Intel i7-11700", "ram_gb": 16, "storage": "512GB SSD", "os": "Ubuntu 22.04 / Windows 11"})
add_eq(1, 15, "Epson Projector", "Epson", "EB-X51", 1, 48000, 5.5, {"lumens": 3800, "resolution": "XGA"})
add_eq(2, 3, "GPU Workstation", "Lenovo", "ThinkStation P620", 6, 385000, 2.5,
       {"cpu": "AMD Threadripper PRO 5955WX", "gpu": "NVIDIA RTX A5000 24GB", "ram_gb": 128, "storage": "2TB NVMe"})
add_eq(2, 4, "ThinkPad Laptop", "Lenovo", "ThinkPad E14", 3, 72000, 3, {"cpu": "Intel i5-1235U", "ram_gb": 16})
add_eq(2, 15, "BenQ Projector", "BenQ", "MW560", 1, 52000, 3, {"lumens": 4000, "resolution": "WXGA"})
add_eq(3, 2, "HP ProDesk Desktop", "HP", "ProDesk 400 G7", 6, 55000, 5, {"cpu": "Intel i5-10500", "ram_gb": 8})
add_eq(3, 7, "Cisco Catalyst Switch", "Cisco", "Catalyst 2960-X 24", 3, 145000, 6, {"ports": 24, "managed": True})
add_eq(3, 9, "Cisco ISR Router", "Cisco", "ISR 4321", 2, 98000, 6, {"wan_ports": 2})
add_eq(3, 8, "Ubiquiti Access Point", "Ubiquiti", "UniFi U6-Lite", 2, 14000, 2, {"wifi": "802.11ax"})
add_eq(4, 11, "Digital Oscilloscope", "Tektronix", "TBS1102C", 4, 68000, 7, {"bandwidth_mhz": 100, "channels": 2})
add_eq(4, 12, "Function Generator", "Keysight", "33210A", 3, 85000, 8, {"max_freq_mhz": 10})
add_eq(4, 13, "DC Bench Power Supply", "Aplab", "L3205", 4, 18000, 9, {"voltage": "0-32V", "current": "0-5A"})
add_eq(5, 17, "Raspberry Pi Kit", "Raspberry Pi", "Pi 4 Model B 8GB", 4, 9500, 2, {"ram_gb": 8})
add_eq(5, 17, "ESP32 Dev Kit", "Espressif", "ESP32-DevKitC", 3, 1200, 1.5, {"wifi": True, "ble": True})
add_eq(5, 18, "Creality 3D Printer", "Creality", "Ender 3 V2", 2, 24000, 3, {"build_volume_mm": "220x220x250"})
add_eq(6, 5, "Compute Server Node", "Supermicro", "SYS-2029GP-TR", 2, 950000, 4,
       {"cpu": "2x Xeon Gold 6230", "gpu": "4x Tesla V100", "ram_gb": 384})
add_eq(6, 7, "Aruba Core Switch", "HPE Aruba", "2930F 48G", 1, 210000, 4, {"ports": 48, "managed": True})
equip[-3][11] = "operational"
# retire one very old function generator
retired_eq = 0
for e in equip:
    if e[3] == 12:
        e[11] = "retired"; retired_eq = e[0]; break

# ------------------------------------------------------------------ spare parts
parts = [
    (1, "SP-TP-001", "Thermal Paste (Arctic MX-4, 4g)", "Cooling", 650, 14, 5),
    (2, "SP-FAN-002", "CPU Cooler Fan 92mm", "Cooling", 1450, 6, 3),
    (3, "SP-RAM-003", "DDR4 RAM 8GB 3200MHz", "Memory", 2300, 9, 4),
    (4, "SP-RAM-004", "DDR4 RAM 16GB 3200MHz", "Memory", 4200, 3, 3),
    (5, "SP-SSD-005", "SATA SSD 512GB", "Storage", 3600, 7, 3),
    (6, "SP-HDD-006", "Enterprise HDD 2TB", "Storage", 7800, 2, 2),
    (7, "SP-PSU-007", "ATX Power Supply 500W", "Power", 3900, 4, 2),
    (8, "SP-PSU-008", "ATX Power Supply 1200W Platinum", "Power", 18500, 1, 1),
    (9, "SP-KB-009", "USB Keyboard", "Peripherals", 600, 12, 5),
    (10, "SP-MS-010", "USB Optical Mouse", "Peripherals", 350, 15, 5),
    (11, "SP-HDMI-011", "HDMI Cable 3m", "Cables", 450, 10, 4),
    (12, "SP-CAT6-012", "Cat6 Patch Cable 2m", "Cables", 180, 40, 15),
    (13, "SP-SFP-013", "1G SFP Transceiver Module", "Networking", 2800, 3, 2),
    (14, "SP-LAMP-014", "Projector Lamp (Epson ELPLP96)", "AV", 6500, 1, 1),
    (15, "SP-FLT-015", "Projector Air Filter", "AV", 900, 4, 2),
    (16, "SP-PRB-016", "Oscilloscope Probe 100MHz x10", "Instruments", 2400, 5, 2),
    (17, "SP-FUSE-017", "Glass Fuse 1A (pack of 10)", "Instruments", 120, 20, 5),
    (18, "SP-USB-018", "USB Type-C / Micro-USB Cable", "Cables", 250, 18, 6),
    (19, "SP-BAT-019", "Laptop Battery (ThinkPad E14)", "Power", 5200, 2, 1),
    (20, "SP-NOZ-020", "3D Printer Nozzle 0.4mm (pack of 5)", "Fabrication", 400, 6, 2),
    (21, "SP-CMOS-021", "CMOS Battery CR2032", "Power", 60, 25, 10),
    (22, "SP-GFAN-022", "GPU Cooling Fan Assembly", "Cooling", 3200, 2, 1),
]

# ------------------------------------------------------------------ failure templates
# category -> list of (severity, [descriptions], title, diagnosis, root_cause, action, [(part_id, qty)])
T = {}
T[2] = [
    ("high", ["The computer becomes very hot and switches off.",
              "The workstation shuts down after running for some time.",
              "System suddenly powers off during heavy processing.",
              "PC turns off by itself while compiling large projects and the fan is very loud."],
     "System shuts down unexpectedly",
     "CPU temperature reached 96 C under load; heat sink clogged with dust and thermal paste dried out (thermal shutdown).",
     "Thermal / cooling", "Cleaned heat sink and chassis fans, re-applied thermal paste, verified load temperature at 68 C.",
     [(1, 1)]),
    ("high", ["CPU fan making grinding noise and system overheats within minutes.",
              "Loud rattling noise from the cabinet, then PC switches off due to heat."],
     "CPU fan noise and overheating",
     "CPU cooler fan bearing worn out; fan RPM dropping below 600, causing thermal shutdown.",
     "Thermal / cooling", "Replaced CPU cooler fan and applied fresh thermal paste.", [(2, 1), (1, 1)]),
    ("medium", ["No display on the monitor although CPU power light is on.",
                "Black screen after switching on, motherboard beeps three times.",
                "Computer starts but nothing appears on screen, continuous beeping."],
     "No display / beep codes on boot",
     "POST beep code indicated memory error; one DDR4 module failed memtest86.",
     "Memory (RAM)", "Replaced faulty 8GB RAM module and re-seated the second module; memtest passed.", [(3, 1)]),
    ("medium", ["Computer is extremely slow and takes ten minutes to boot.",
                "Files are getting corrupted and there is a clicking sound from the CPU.",
                "Ubuntu shows disk read errors and freezes frequently."],
     "Very slow boot / disk errors",
     "SMART data showed reallocated sectors on the HDD; disk failing.",
     "Storage", "Replaced HDD with 512GB SSD and re-imaged the lab OS.", [(5, 1)]),
    ("critical", ["Computer does not turn on at all, no lights or fan.",
                  "There was a burning smell and now the PC is completely dead."],
     "No power / dead system",
     "SMPS failed - no 12V output on PSU tester; capacitor bulged.",
     "Power supply", "Replaced 500W power supply unit and tested all rails.", [(7, 1)]),
    ("low", ["Blue screen of death appears repeatedly while using the lab software.",
             "Windows keeps restarting with a stop error after login."],
     "Repeated blue screen / OS crash",
     "Corrupted display driver after automatic update; system files damaged.",
     "Software / OS", "Rolled back driver, ran SFC/DISM, re-imaged OS partition from lab master image.", []),
    ("low", ["Several keys on the keyboard are not working.",
             "Mouse is not detected and the cursor does not move."],
     "Keyboard / mouse not working",
     "Peripheral failure - keyboard membrane damaged / mouse cable broken.",
     "Peripherals", "Replaced keyboard and mouse.", [(9, 1), (10, 1)]),
    ("low", ["System clock resets every time the computer is switched on.",
             "Date and time are wrong after every reboot and BIOS settings reset."],
     "BIOS time resets",
     "CMOS battery voltage 1.9V (dead).", "Motherboard", "Replaced CMOS battery and restored BIOS settings.", [(21, 1)]),
]
T[3] = [
    ("critical", ["Training job crashes and the machine reboots under full GPU load.",
                  "System restarts whenever all GPUs are used for deep learning training.",
                  "Workstation powers off during long PyTorch training runs."],
     "Reboot under full GPU load",
     "Power draw at peak exceeded PSU capacity; PSU over-current protection tripping.",
     "Power supply", "Replaced PSU with 1200W Platinum unit and capped GPU power limit to 230W.", [(8, 1)]),
    ("high", ["GPU is not detected by nvidia-smi after reboot.",
              "CUDA device not found error, the GPU disappears from the system.",
              "nvidia-smi shows 'No devices were found' on the workstation."],
     "GPU not detected",
     "GPU partially unseated from PCIe slot; driver mismatch after kernel update.",
     "GPU / driver", "Re-seated GPU, secured bracket, reinstalled NVIDIA driver 550 and CUDA toolkit.", []),
    ("high", ["GPU temperature goes above 90 degrees and training slows down drastically.",
              "Graphics card fan very loud and GPU throttling during training."],
     "GPU thermal throttling",
     "GPU fan assembly failing; dust build-up on heat sink fins.",
     "Thermal / cooling", "Replaced GPU fan assembly, cleaned heat sink, improved case airflow.", [(22, 1)]),
    ("medium", ["Out of memory errors and the system freezes when loading large datasets.",
                "Workstation hangs when RAM usage goes high, one memory stick shows errors."],
     "System freeze - memory errors",
     "ECC errors logged on one 16GB DIMM.", "Memory (RAM)", "Replaced faulty 16GB DIMM.", [(4, 1)]),
]
T[4] = [
    ("medium", ["Laptop battery is not charging beyond 20 percent.",
                "Laptop shuts down immediately when unplugged from charger."],
     "Battery not holding charge",
     "Battery health at 31%; cells degraded.", "Battery", "Replaced laptop battery.", [(19, 1)]),
    ("low", ["Laptop screen flickers and goes blank when the lid is moved.",
             "Display flickering on the laptop."],
     "Display flicker",
     "Display ribbon cable loose at hinge.", "Display", "Re-seated display cable and tightened hinge.", []),
]
T[5] = [
    ("critical", ["RAID controller reports a degraded array and a disk failure alert.",
                  "Server storage shows one drive failed, array degraded."],
     "RAID array degraded",
     "One 2TB drive failed in RAID-5 array.", "Storage", "Hot-swapped failed drive with 2TB enterprise HDD and rebuilt array.", [(6, 1)]),
    ("high", ["Server unreachable over SSH and jobs are not running.",
              "Cannot connect to compute node, it seems to hang."],
     "Server unreachable",
     "Kernel panic due to NVIDIA driver / kernel mismatch after unattended upgrade.",
     "Software / OS", "Pinned kernel version, reinstalled driver, enabled kdump.", []),
]
T[7] = [
    ("high", ["No internet on half of the lab systems, some switch ports are dead.",
              "Several network ports on the switch are not working."],
     "Switch ports not working",
     "Port group 13-24 failed on switch; uplink SFP faulty.",
     "Network hardware", "Replaced SFP transceiver, moved connections, replaced damaged patch cables.", [(13, 1), (12, 4)]),
    ("medium", ["Network keeps dropping every few minutes in the lab.",
                "Internet connection is very unstable, keeps disconnecting."],
     "Intermittent network drops",
     "Broadcast storm due to a loop created by a student connecting two wall ports.",
     "Network configuration", "Enabled spanning tree / BPDU guard on access ports, removed loop.", []),
]
T[8] = [
    ("medium", ["Wi-Fi is very slow and keeps disconnecting in the lab.",
                "Wireless network disappears frequently."],
     "Wi-Fi slow / disconnecting",
     "Access point overheating and running outdated firmware.",
     "Network configuration", "Upgraded AP firmware, changed channel, relocated AP away from heat source.", []),
]
T[9] = [
    ("high", ["No internet in the entire networks lab.",
              "Router is not forwarding traffic, lab is offline."],
     "Lab offline - router",
     "Router configuration corrupted after power outage.", "Network configuration",
     "Restored running configuration from backup and saved startup config.", []),
]
T[11] = [
    ("medium", ["No trace visible on channel 2 of the oscilloscope.",
                "Oscilloscope channel shows flat line even when signal is connected."],
     "No trace on channel",
     "Probe tip and cable damaged.", "Accessories", "Replaced oscilloscope probe and compensated it.", [(16, 1)]),
    ("low", ["Waveform on the oscilloscope is unstable and jittery.",
             "Readings are fluctuating and not accurate."],
     "Unstable waveform",
     "Instrument out of calibration; trigger level drift.", "Calibration", "Performed self-calibration and probe compensation.", []),
]
T[12] = [
    ("medium", ["Function generator gives no output signal.",
                "No signal at the output terminal of the generator."],
     "No output signal",
     "Output protection fuse blown.", "Electrical", "Replaced 1A fuse and verified output.", [(17, 1)]),
]
T[13] = [
    ("medium", ["Output voltage of the power supply fluctuates.",
                "Bench supply voltage keeps changing on its own."],
     "Output voltage fluctuating",
     "Worn voltage control potentiometer; loose terminal.", "Electrical", "Cleaned / tightened potentiometer and terminals.", []),
]
T[15] = [
    ("medium", ["Projector image is very dim and yellowish.",
                "Projected display is too dark to read in the lab."],
     "Dim projector image",
     "Lamp at end of life (lamp hours 4,900/5,000).", "Lamp / optics", "Replaced projector lamp and reset lamp timer.", [(14, 1)]),
    ("high", ["Projector turns off after 20 minutes with the temperature light blinking.",
              "Projector overheats and shuts down during class."],
     "Projector overheating shutdown",
     "Air filter completely clogged with dust causing overheating.", "Thermal / cooling",
     "Cleaned projector interior and replaced air filter.", [(15, 1)]),
]
T[17] = [
    ("low", ["Board is not detected on USB, cannot upload code.",
             "Arduino IDE says port not found for the development board."],
     "Board not detected over USB",
     "Faulty USB cable (charge-only).", "Accessories", "Replaced USB data cable.", [(18, 1)]),
    ("medium", ["Raspberry Pi does not boot, red light only.",
                "Pi is stuck and SD card is not booting."],
     "Board does not boot",
     "Corrupted SD card image due to unsafe power off.", "Software / OS", "Re-flashed OS image on SD card.", []),
]
T[18] = [
    ("medium", ["Filament is not coming out of the 3D printer nozzle.",
                "3D printer nozzle seems blocked, print fails after first layer."],
     "Nozzle clogged",
     "Nozzle clogged with burnt PLA.", "Fabrication", "Replaced nozzle and recalibrated bed levelling.", [(20, 1)]),
]

def eq_templates(cat):
    return T.get(cat) or T[2]

# ------------------------------------------------------------------ incidents
incidents, logs, asg, mrs, pus = [], [], [], [], []
iid = 0; rid = 0; aid = 0
part_used = {p[0]: 0 for p in parts}

def tech_for(cat):
    chain = []
    c = cat
    while c:
        chain.append(c); c = CAT_PARENT[c]
    cands = [t for t, cs in tech_skill_map.items() if any(x in cs for x in chain)]
    return random.choice(cands or TECH_IDS)

active_eq = [e for e in equip if e[11] != "retired"]
# "lemon" assets that fail repeatedly (for reliability analytics)
lemons = [equip[2][0], equip[11][0], equip[13][0], equip[10][0]]  # 2 desktops, GPU ws, projector
weights = [6 if e[0] in lemons else 1 for e in active_eq]

def make_incident(eq, reported, final_status, reporter=None, tmpl=None):
    global iid, rid, aid
    iid += 1
    cat = eq[3]
    tmpl = tmpl or random.choice(eq_templates(cat))
    sev, descs, title, diag, root, action, prts = tmpl
    desc = random.choice(descs)
    reporter = reporter or random.choice(STUDENT_IDS)
    tech = tech_for(cat)
    admin = random.choice([1, 2])
    t_assign = reported + dt.timedelta(minutes=random.randint(20, 360))
    t_start = t_assign + dt.timedelta(minutes=random.randint(30, 1200))
    t_res = t_start + dt.timedelta(minutes=random.randint(45, 2880))
    t_close = t_res + dt.timedelta(minutes=random.randint(60, 2880))
    seq = 1
    logs.append((iid, seq, None, "open", reporter, reported, "Incident reported"))
    resolved_at = closed_at = None
    order = ["open", "assigned", "in_progress", "resolved", "closed"]
    reopen = final_status in ("closed", "resolved") and random.random() < 0.08
    if final_status == "reopened":
        stages = ["assigned", "in_progress", "resolved", "reopened"]
    else:
        stages = order[1:order.index(final_status) + 1]
        if reopen:
            stages = ["assigned", "in_progress", "resolved", "reopened", "in_progress"] + stages[3:]
    prev = "open"; t = reported
    times = {"assigned": t_assign, "in_progress": t_start, "resolved": t_res, "closed": t_close}
    for k, st in enumerate(stages):
        if st == "reopened":
            t = t + dt.timedelta(days=random.randint(1, 6))
            who = reporter; rm = "Problem occurred again after repair"
        elif reopen and k >= 4:
            t = t + dt.timedelta(minutes=random.randint(60, 600)) if st != "closed" else t + dt.timedelta(minutes=random.randint(60, 2000))
            who = tech if st in ("in_progress", "resolved") else reporter
            rm = None
        else:
            t = times[st]
            who = admin if st == "assigned" else tech if st in ("in_progress", "resolved") else reporter
            rm = {"assigned": "Assigned to technician", "resolved": "Repair completed",
                  "closed": "Confirmed working by reporter"}.get(st)
        seq += 1
        logs.append((iid, seq, prev, st, who, t, rm))
        if st == "assigned":
            aid += 1
            asg.append((aid, iid, tech, admin, t, True, None))
        if st == "in_progress":
            last_start = t
        if st == "resolved":
            resolved_at = t
            rid += 1
            outcome = "fixed" if prts == [] or random.random() > 0.15 else "replaced"
            mrs.append((rid, iid, tech, diag, root, action, outcome, last_start, t))
            for pid, qn in prts:
                pus.append((rid, pid, qn, [p for p in parts if p[0] == pid][0][4]))
                part_used[pid] += qn
        if st == "reopened":
            # first fix was only partial
            if mrs and mrs[-1][1] == iid:
                r = list(mrs[-1]); r[6] = "partial"; mrs[-1] = tuple(r)
            resolved_at = None
        if st == "closed":
            closed_at = t
        prev = st
    incidents.append((iid, eq[0], reporter, title, desc, sev, final_status, reported, resolved_at, closed_at))
    return tech

# historical incidents over ~2 years
hist_times = sorted(NOW - dt.timedelta(days=random.uniform(9, 720), minutes=random.randint(0, 600)) for _ in range(150))
for rt in hist_times:
    eq = random.choices(active_eq, weights=weights)[0]
    if rt.hour < 8: rt = rt.replace(hour=random.randint(9, 16))
    make_incident(eq, rt, random.choices(["closed", "resolved"], [0.85, 0.15])[0])

# make the classic "repeated overheating" story on one desktop (CSL-101, lemon #1)
lemon_ws = equip[2]
for days in (95, 70, 52, 31):
    make_incident(lemon_ws, NOW - dt.timedelta(days=days, hours=3), "closed", tmpl=T[2][0])

# current / active incidents
demo_student = 9
active_specs = [
    ("open", 0.2, demo_student), ("open", 0.5, None), ("open", 1.1, None), ("open", 2.0, None), ("open", 0.1, None),
    ("assigned", 1.5, demo_student), ("assigned", 2.5, None), ("assigned", 3.0, None),
    ("in_progress", 2.2, None), ("in_progress", 4.0, None), ("in_progress", 1.3, None),
    ("reopened", 6.0, None), ("resolved", 3.5, demo_student),
]
for st, days_ago, rep in active_specs:
    eq = random.choice(active_eq)
    rt = NOW - dt.timedelta(days=days_ago)
    # keep the active ones short-lived so timestamps stay in the past
    iid_before = iid
    make_incident(eq, rt, st, reporter=rep)
# clamp any future timestamps for active incidents to NOW - few minutes
def clamp(t):
    return min(t, NOW - dt.timedelta(minutes=5)) if t else t
logs = [(a, b, c, d, e, clamp(f), g) for (a, b, c, d, e, f, g) in logs]
asg = [(a, b, c, d, clamp(e), f, g) for (a, b, c, d, e, f, g) in asg]
mrs = [(a, b, c, d, e, f, g, clamp(h), clamp(i)) for (a, b, c, d, e, f, g, h, i) in mrs]
incidents = [(a, b, c, d, e, f, g, h, clamp(i), clamp(j)) for (a, b, c, d, e, f, g, h, i, j) in incidents]
# fix ordering after clamp (started <= completed)
mrs = [(a, b, c, d, e, f, g, min(h, i), i) for (a, b, c, d, e, f, g, h, i) in mrs]

# give the demo technician (Ravi, id 3) the active assigned / in-progress jobs
active_ids = {i[0] for i in incidents if i[6] in ("assigned", "in_progress", "reopened")}
for k, a in enumerate(asg):
    if a[1] in active_ids and k % 2 == 0:
        asg[k] = (a[0], a[1], 3, a[3], a[4], a[5], a[6])
# maintenance technician for in-progress jobs must match assignment
tech_of = {a[1]: a[2] for a in asg}
mrs = [(a, b, tech_of.get(b, c), d, e, f, g, h, i) for (a, b, c, d, e, f, g, h, i) in mrs]
# for incidents with a re-assignment, keep only one active assignment
seen = set()
for k in range(len(asg) - 1, -1, -1):
    a = asg[k]
    if a[1] in seen:
        asg[k] = (a[0], a[1], a[2], a[3], a[4], False, "Re-assigned")
    seen.add(a[1])
# historical (closed/resolved) assignments are no longer active
done_ids = {i[0] for i in incidents if i[6] in ("closed", "resolved")}
asg = [(a, b, c, d, e, (f and b not in done_ids), g) for (a, b, c, d, e, f, g) in asg]

# equipment status derived from active incidents
for e in equip:
    if e[11] == "retired": continue
    act = [i for i in incidents if i[1] == e[0] and i[6] in ("open", "assigned", "in_progress", "reopened")]
    if any(i[6] == "in_progress" for i in act):
        e[11] = "under_maintenance"
    elif any(i[5] in ("high", "critical") or i[6] == "reopened" for i in act):
        e[11] = "faulty"
    else:
        e[11] = "operational"

# final stock = initial - used  (keep >= 0) ; a few will be below reorder level
# (stock values in `parts` are the CURRENT stock after historical usage)
parts_final = parts

# ------------------------------------------------------------------ write SQL
out = []
out.append("""-- =====================================================================
-- LabTrace  |  05_seed.sql   (generated by scripts/generate_seed.py)
-- Sample data (DML).  All demo accounts use password:  Password@123
--   admin@labtrace.edu   (admin)      tech@labtrace.edu  (technician)
--   student@labtrace.edu (student)
-- Historical data is loaded with user triggers disabled (it already
-- contains its own status log); live operations use the triggers.
-- =====================================================================
SET search_path TO labtrace, public;
BEGIN;
ALTER TABLE incidents           DISABLE TRIGGER USER;
ALTER TABLE assignments         DISABLE TRIGGER USER;
ALTER TABLE part_usage          DISABLE TRIGGER USER;
ALTER TABLE maintenance_records DISABLE TRIGGER USER;
""")
out.append(ins("users", ["user_id", "institution_id", "full_name", "email", "password_hash", "role", "department", "is_active"],
               [(u[0], u[1], u[2], u[3], PWD, u[4], u[5], u[6]) for u in users]))
out.append(ins("user_phones", ["user_id", "phone_no", "phone_type"], phones))
out.append(ins("labs", ["lab_id", "lab_code", "lab_name", "building", "floor_no", "room_no", "capacity", "incharge_id"], labs))
out.append(ins("equipment_categories", ["category_id", "category_name", "parent_id", "expected_life_years", "description"], cats))
out.append(ins("technician_skills", ["technician_id", "category_id", "proficiency"], skills))
out.append(ins("equipment", ["equipment_id", "asset_tag", "equipment_name", "category_id", "lab_id", "manufacturer", "model_no",
                             "serial_no", "purchase_date", "purchase_cost", "warranty_expiry", "status", "specifications"],
               [tuple(e) for e in equip]))
out.append(ins("spare_parts", ["part_id", "part_no", "part_name", "part_category", "unit_cost", "qty_in_stock", "reorder_level"], parts_final))
out.append(ins("incidents", ["incident_id", "equipment_id", "reported_by", "title", "description", "severity", "status",
                             "reported_at", "resolved_at", "closed_at"], incidents))
out.append(ins("incident_status_log", ["incident_id", "log_seq", "old_status", "new_status", "changed_by", "changed_at", "remarks"], logs))
out.append(ins("assignments", ["assignment_id", "incident_id", "technician_id", "assigned_by", "assigned_at", "is_active", "notes"], asg))
out.append(ins("maintenance_records", ["record_id", "incident_id", "technician_id", "diagnosis", "root_cause", "action_taken",
                                       "outcome", "started_at", "completed_at"], mrs))
out.append(ins("part_usage", ["record_id", "part_id", "quantity", "unit_cost_at_use"], pus))
out.append("""
ALTER TABLE incidents           ENABLE TRIGGER USER;
ALTER TABLE assignments         ENABLE TRIGGER USER;
ALTER TABLE part_usage          ENABLE TRIGGER USER;
ALTER TABLE maintenance_records ENABLE TRIGGER USER;

-- move sequences past the explicit ids
SELECT setval('users_user_id_seq',                 (SELECT MAX(user_id)       FROM users));
SELECT setval('labs_lab_id_seq',                   (SELECT MAX(lab_id)        FROM labs));
SELECT setval('equipment_categories_category_id_seq', (SELECT MAX(category_id) FROM equipment_categories));
SELECT setval('equipment_equipment_id_seq',        (SELECT MAX(equipment_id)  FROM equipment));
SELECT setval('incidents_incident_id_seq',         (SELECT MAX(incident_id)   FROM incidents));
SELECT setval('assignments_assignment_id_seq',     (SELECT MAX(assignment_id) FROM assignments));
SELECT setval('maintenance_records_record_id_seq', (SELECT MAX(record_id)     FROM maintenance_records));
SELECT setval('spare_parts_part_id_seq',           (SELECT MAX(part_id)       FROM spare_parts));
COMMIT;
""")
Path(__file__).resolve().parent.parent.joinpath("sql", "05_seed.sql").write_text("\n".join(out))
print(f"users={len(users)} labs={len(labs)} equipment={len(equip)} incidents={len(incidents)} "
      f"logs={len(logs)} assignments={len(asg)} maintenance={len(mrs)} part_usage={len(pus)}")
