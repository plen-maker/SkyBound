"""Axesta EFB — PyWebView + Flask"""
import webview, threading, os, sys, json, argparse
import requests as req
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

parser = argparse.ArgumentParser()
parser.add_argument("--dev", action="store_true")
ARGS, _ = parser.parse_known_args()

BASE = os.path.dirname(os.path.abspath(__file__)) if not getattr(sys,"frozen",False) else sys._MEIPASS
SETTINGS_FILE = os.path.expanduser("~/.axesta.json")
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
        "Axesta",
        url="http://127.0.0.1:47821/",
        width=1360, height=860,
        min_size=(900,600),
        background_color="#08090e",
    )
    webview.start(
        debug=ARGS.dev,
        private_mode=False,
        user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"
    )

if __name__ == "__main__":
    main()
