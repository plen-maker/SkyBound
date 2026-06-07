"""Axesta EFB — PyWebView + Flask"""
import webview, threading, os, sys, json, argparse
import requests as req
import subprocess, signal
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

parser = argparse.ArgumentParser()
parser.add_argument("--dev", action="store_true")
ARGS, _ = parser.parse_known_args()

BASE = os.path.dirname(os.path.abspath(__file__)) if not getattr(sys,"frozen",False) else sys._MEIPASS
SETTINGS_FILE = os.path.expanduser("~/.xdeck.json")
VERSION_FILE  = os.path.join(BASE, "version.json")

def load_json(path, default={}):
    try:
        with open(path) as f: return json.load(f)
    except: return default

def save_json(path, data):
    with open(path,"w") as f: json.dump(data, f, indent=2)

VERSION = load_json(VERSION_FILE, {"codename":"Sequoia","version":"0.1.0","channel":"release"})

app = Flask(__name__, static_folder=os.path.join(BASE,"ui"))
CORS(app)

@app.route("/")
def index(): return send_from_directory(app.static_folder, "index.html")

@app.route("/<path:p>")
def static_files(p): return send_from_directory(app.static_folder, p)

@app.route("/api/settings", methods=["GET","POST"])
def settings():
    if request.method == "POST":
        save_json(SETTINGS_FILE, request.json)
        return jsonify({"ok":True})
    return jsonify(load_json(SETTINGS_FILE))

@app.route("/api/version", methods=["GET","POST"])
def version():
    if request.method == "POST":
        d = request.json
        VERSION["codename"] = d.get("codename", VERSION["codename"])
        VERSION["channel"]  = d.get("channel",  VERSION["channel"])
        save_json(VERSION_FILE, VERSION)
        return jsonify({"ok":True})
    return jsonify(VERSION)

@app.route("/api/ofp")
def ofp():
    username = request.args.get("username","")
    if not username: return jsonify({"error":"Nincs usernév"})
    try:
        r = req.get(f"https://www.simbrief.com/api/xml.fetcher.php?username={username}&json=1", timeout=12)
        r.raise_for_status()
        d = r.json()
        if d.get("fetch",{}).get("status") == "Error":
            return jsonify({"error": d["fetch"]["message"]})
        def n(v): return None if v in (None,"") else float(v)
        w,f,g,t = d.get("weights",{}),d.get("fuel",{}),d.get("general",{}),d.get("times",{})
        fr = d.get("navlog",{}).get("fix",[])
        if isinstance(fr,dict): fr=[fr]
        fixes=[{"ident":x["ident"],"stage":x.get("stage"),
                "lat":n(x.get("pos_lat")),"lon":n(x.get("pos_long")),
                "altitude":n(x.get("altitude_feet"))}
               for x in fr if x.get("ident") and x.get("pos_lat")]
        ete_s = n(t.get("est_time_enroute"))
        ete = f"{int(ete_s//3600)}h{int((ete_s%3600)//60):02d}m" if ete_s else None
        return jsonify({"ofp":{
            "dep":d.get("origin",{}).get("icao_code"),
            "arr":d.get("destination",{}).get("icao_code"),
            "altn":d.get("alternate",{}).get("icao_code"),
            "aircraft":f"{d.get('aircraft',{}).get('icaocode','')} {d.get('aircraft',{}).get('name','')}".strip(),
            "units":w.get("units","kg"),
            "pax":n(w.get("pax_count")), "payload":n(w.get("payload")),
            "zfw":n(w.get("est_zfw")), "tow":n(w.get("est_tow")),
            "blockFuel":n(f.get("plan_ramp")), "enrouteBurn":n(f.get("enroute_burn")),
            "contFuel":n(f.get("contingency")), "altFuel":n(f.get("alternate_burn")),
            "resFuel":n(f.get("reserve")), "extraFuel":n(f.get("extra")),
            "costindex":n(g.get("costindex")), "route":g.get("route"),
            "routeDistanceNm":n(g.get("route_distance")) or n(g.get("air_distance")),
            "ete":ete, "fixes":fixes,
        }})
    except Exception as e:
        return jsonify({"error":str(e)})

@app.route("/api/vatsim")
def vatsim():
    try:
        r = req.get("https://data.vatsim.net/v3/vatsim-data.json", timeout=8)
        return jsonify(r.json())
    except Exception as e:
        return jsonify({"error":str(e)})

@app.route("/api/spawn", methods=["POST"])
def spawn():
    import os
    data = request.json or {}
    filename = data.get("file","")
    if not filename:
        return jsonify({"error":"Nincs fájlnév"})
    # Look for .flt in desktop/flights/ folder
    flights_dir = os.path.join(BASE, "flights")
    flt_path = os.path.join(flights_dir, filename)
    if not os.path.exists(flt_path):
        return jsonify({"error": f"Fájl nem található: {filename} (desktop/flights/ mappában kell lennie)"})
    # Try SimConnect via msfs-simconnect-on-simconnect or just write to known path
    # Write path to a temp file that the bridge can pick up
    tmp = os.path.expanduser("~/.axesta_spawn.txt")
    with open(tmp,"w") as f:
        f.write(flt_path)
    return jsonify({"ok": True, "path": flt_path})

@app.route("/api/metar")
def metar():
    icao = request.args.get("icao","").upper()
    if not icao: return jsonify({"error":"Nincs ICAO"})
    try:
        r = req.get(
            f"https://aviationweather.gov/api/data/metar?ids={icao}&format=json&hours=2",
            timeout=8, headers={"Accept":"application/json"}
        )
        data = r.json()
        if not data:
            return jsonify({"error": f"Nem található METAR: {icao}"})
        return jsonify(data)
    except Exception as e:
        return jsonify({"error":str(e)})


@app.route("/api/atis")
def atis():
    icao = request.args.get("icao","").upper()
    if not icao: return jsonify({"error":"Nincs ICAO"})
    try:
        r = req.get(f"https://datis.clowd.io/api/{icao}", timeout=8)
        if r.status_code == 404:
            return jsonify({"error": f"Nincs D-ATIS: {icao} (csak FAA repülőterekre elérhető)"})
        r.raise_for_status()
        data = r.json()
        return jsonify(data if isinstance(data, list) else [data])
    except Exception as e:
        return jsonify({"error": str(e)})


@app.route("/api/control-center/apply", methods=["POST"])
def cc_apply():
    import pathlib, datetime
    d = request.json or {}
    aircraft   = d.get("aircraft", "Unknown")
    controller = d.get("controller", "Unknown")
    axes       = d.get("axes", [])

    out_dir = pathlib.Path.home() / "Documents" / "Xdeck EFB" / "Control Profiles"
    out_dir.mkdir(parents=True, exist_ok=True)

    safe_ac   = "".join(c if c.isalnum() or c in " _-" else "" for c in aircraft).strip().replace(" ","_")
    safe_ctrl = "".join(c if c.isalnum() or c in " _-" else "" for c in controller).strip().replace(" ","_")
    filename  = f"Xdeck_{safe_ac}_x_{safe_ctrl}.txt"
    out_path  = out_dir / filename

    lines = [
        "Xdeck EFB — Control Center Reference Guide",
        f"Generated : {datetime.datetime.now().strftime('%Y-%m-%d %H:%M')}",
        "",
        f"Aircraft   : {aircraft}",
        f"Controller : {controller}",
        "",
        f"{'Axis':<24} {'Sensitivity':>13} {'Deadzone':>10} {'Reactivity':>11}",
        "-" * 62,
    ]
    for ax in axes:
        name  = ax.get("name","")
        sens  = ax.get("sens", ax.get("sensitivity", 0))
        dz    = ax.get("dz",   ax.get("deadzone", 0))
        react = ax.get("react", ax.get("reactivity", 100))
        lines.append(f"{name:<24} {f'{sens:+}%':>13} {f'{dz}%':>10} {f'{react}%':>11}")

    lines += [
        "",
        "HOW TO APPLY IN MSFS:",
        "  1. Open MSFS > Options > Controls",
        "  2. Select your controller profile",
        "  3. Find each axis and set Sensitivity / Dead Zone / Reactivity",
        "  4. Save the profile",
        "",
        "Tip: In MSFS the axis sensitivity range is -100 to +100 (0 = linear).",
    ]

    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    os.startfile(str(out_dir))
    return jsonify({"ok": True, "path": str(out_path)})


def get_bridge_dir():
    if getattr(sys, "frozen", False):
        return os.path.join(os.path.dirname(sys.executable), "bridge")
    return os.path.join(os.path.dirname(BASE), "bridge")

def get_bridge_env_dir():
    """Writable dir for .env — AppData when frozen, bridge/ in dev."""
    if getattr(sys, "frozen", False):
        d = os.path.join(os.environ.get("APPDATA", os.path.expanduser("~")), "Xdeck EFB")
        os.makedirs(d, exist_ok=True)
        return d
    return os.path.join(os.path.dirname(BASE), "bridge")

_bridge_proc = None
_bridge_log_buf = []

def _bridge_reader(proc):
    """Background thread: drains stdout pipe into _bridge_log_buf."""
    global _bridge_log_buf
    try:
        for raw in proc.stdout:
            line = raw.decode("utf-8", errors="replace").rstrip()
            if line:
                _bridge_log_buf.append(line)
                if len(_bridge_log_buf) > 300:
                    _bridge_log_buf = _bridge_log_buf[-200:]
    except Exception:
        pass

@app.route("/api/bridge/status")
def bridge_status():
    global _bridge_proc
    if _bridge_proc and _bridge_proc.poll() is None:
        return jsonify({"running": True, "pid": _bridge_proc.pid})
    _bridge_proc = None
    return jsonify({"running": False})

@app.route("/api/bridge/env", methods=["GET", "POST"])
def bridge_env():
    env_path = os.path.join(get_bridge_env_dir(), ".env")
    if request.method == "POST":
        data = request.json or {}
        try:
            lines = [f"{k}={v}" for k, v in data.items() if v is not None]
            with open(env_path, "w") as f:
                f.write("\n".join(lines) + "\n")
            return jsonify({"ok": True})
        except Exception as e:
            return jsonify({"error": str(e)})
    result = {}
    try:
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, _, v = line.partition("=")
                    result[k.strip()] = v.strip()
    except Exception:
        pass
    return jsonify(result)

@app.route("/api/bridge/start", methods=["POST"])
def bridge_start():
    global _bridge_proc
    if _bridge_proc and _bridge_proc.poll() is None:
        return jsonify({"ok": True, "already": True})

    env_dir  = get_bridge_env_dir()
    env_file = os.path.join(env_dir, ".env")
    if not os.path.exists(env_file):
        return jsonify({"error": ".env fájl hiányzik — töltsd ki a Bridge beállításokat"})

    sim_mode = "--simconnect"
    try:
        with open(env_file) as f:
            for line in f:
                line = line.strip()
                if line.startswith("SIM_MODE="):
                    val = line.split("=", 1)[1].strip()
                    if val == "fsuipc":
                        sim_mode = "--fsuipc"
                    elif val == "auto":
                        sim_mode = ""
    except Exception:
        pass

    try:
        if getattr(sys, "frozen", False):
            bridge_exe = os.path.join(os.path.dirname(sys.executable), "bridge", "bridge.exe")
            if not os.path.exists(bridge_exe):
                return jsonify({"error": "bridge.exe nem található: " + bridge_exe})
            cmd = [bridge_exe] + ([sim_mode] if sim_mode else [])
            cwd = env_dir
        else:
            bridge_dir = get_bridge_dir()
            if not os.path.exists(bridge_dir):
                return jsonify({"error": "Bridge mappa nem található: " + bridge_dir})
            node = "node.exe" if os.name == "nt" else "node"
            cmd = [node, "src/index.js"] + ([sim_mode] if sim_mode else [])
            cwd = bridge_dir

        _bridge_log_buf.clear()
        _bridge_proc = subprocess.Popen(
            cmd,
            cwd=cwd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
        )
        import threading
        threading.Thread(target=_bridge_reader, args=(_bridge_proc,), daemon=True).start()
        return jsonify({"ok": True, "pid": _bridge_proc.pid})
    except Exception as e:
        return jsonify({"error": str(e)})

@app.route("/api/bridge/stop", methods=["POST"])
def bridge_stop():
    global _bridge_proc
    if _bridge_proc and _bridge_proc.poll() is None:
        try:
            if os.name == "nt":
                subprocess.run(["taskkill", "/F", "/PID", str(_bridge_proc.pid)], capture_output=True)
            else:
                _bridge_proc.terminate()
            _bridge_proc = None
            return jsonify({"ok": True})
        except Exception as e:
            return jsonify({"error": str(e)})
    return jsonify({"ok": True, "already": True})

@app.route("/api/bridge/log")
def bridge_log():
    lines = _bridge_log_buf[-80:] if _bridge_log_buf else []
    return jsonify({"log": "\n".join(lines)})

@app.route("/api/update")
def update():
    try:
        r = req.get("https://api.github.com/repos/plen-maker/SkyBound/releases/latest",
            headers={"Accept":"application/vnd.github+json"}, timeout=8)
        rel = r.json()
        latest  = (rel.get("tag_name") or "").strip().lower()
        current = VERSION.get("codename","sequoia").lower()
        if latest and latest != current:
            return jsonify({"update":True,"codename":rel.get("tag_name"),"url":rel.get("html_url")})
        return jsonify({"update":False})
    except Exception as e:
        return jsonify({"error":str(e)})

def run_flask():
    app.run(port=47821, threaded=True, use_reloader=False)

def main():
    threading.Thread(target=run_flask, daemon=True).start()
    window = webview.create_window(
        "Xdeck EFB",
        url="http://127.0.0.1:47821/",
        width=1360, height=860,
        min_size=(900,600),
        background_color="#08090e",
    )
    def on_shown():
        # macOS: force window focus so first click registers (acceptFirstMouse workaround)
        try:
            import subprocess, os
            subprocess.Popen([
                "osascript", "-e",
                f"tell application \"System Events\" to set frontmost of first process whose unix id is {os.getpid()} to true"
            ])
        except Exception:
            pass

    window.events.shown += on_shown

    webview.start(
        debug=ARGS.dev,
        private_mode=False,
        user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"
    )

if __name__ == "__main__":
    main()
