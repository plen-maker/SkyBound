import React, { useState, useEffect, useCallback, useRef } from "react";
import { initializeApp, getApps } from "firebase/app";
import {
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, onAuthStateChanged,
} from "firebase/auth";
import { getDatabase, ref, onValue, push, remove, update } from "firebase/database";
import {
  Plane, Map as MapIcon, FileText, Bell, Settings as Cog,
  Music, MessageCircle, Globe, Radar, Navigation2, Wifi, WifiOff,
  Plus, Trash2, Users, Weight, Fuel, ArrowDownRight,
  Loader2, AlertCircle, Gamepad2, ExternalLink,
  Check, LogOut, Radio, Eye, EyeOff, RefreshCw, Layers,
} from "lucide-react";

/* ── PyWebView bridge ─────────────────────────────────────────── */
const py = {
  call: async (method, ...args) => {
    try {
      if (window.pywebview?.api?.[method])
        return window.pywebview.api[method](...args);
    } catch(e) { console.warn("[py]", method, e); }
    return null;
  },
  openExternal: url => fetch(`http://127.0.0.1:47821/api/open-url?url=${encodeURIComponent(url)}`).catch(()=>null),
  openInApp:    url => py.call("open_inapp", url),
  saveSettings: s   => py.call("save_settings", JSON.stringify(s)),
  loadSettings: ()  => py.call("load_settings"),
  fetchOFP:     u   => py.call("fetch_ofp", u),
  checkUpdate:        ()       => py.call("check_update"),
  getVersion:         ()       => py.call("get_version"),
  saveVersionSettings:(cn,ch)  => py.call("save_version_settings", cn, ch),
};

const apiFetch = async path => {
  try {
    const r = await fetch("https://aviationweather.gov" + path.replace("/api","") + 
      (path.includes("metar") ? "" : "") );
    // Use direct APIs since Tauri has no CORS restrictions
    if (path.startsWith("/vatsim")) {
      return fetch("https://data.vatsim.net/v3/vatsim-data.json").then(r=>r.json()).catch(()=>null);
    }
    const icao = new URLSearchParams(path.split("?")[1]).get("icao");
    if (path.startsWith("/metar")) {
      return fetch(`https://aviationweather.gov/api/data/metar?ids=${icao}&format=json&hours=2`).then(r=>r.json()).catch(()=>null);
    }
    if (path.startsWith("/taf")) {
      return fetch(`https://aviationweather.gov/api/data/taf?ids=${icao}&format=json`).then(r=>r.json()).catch(()=>null);
    }
  } catch { return null; }
};

/* ── Firebase ─────────────────────────────────────────────────── */
const FB = {
  apiKey: "AIzaSyAxHmLWOIJl4xC44uHsRbxqzRhF4mA0kqE",
  authDomain: "simapp-99f40.firebaseapp.com",
  databaseURL: "https://simapp-99f40-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "simapp-99f40",
  storageBucket: "simapp-99f40.firebasestorage.app",
  messagingSenderId: "993511543138",
  appId: "1:993511543138:web:ec3a0d3e19713160111c3b",
};
const fbApp = getApps().length ? getApps()[0] : initializeApp(FB);
const auth  = getAuth(fbApp);
let _db = null;
const getDB = () => { if (!_db) _db = getDatabase(fbApp); return _db; };

const ls = {
  get: (k,d=null) => { try { const v=localStorage.getItem(k); return v!=null?JSON.parse(v):d; } catch { return d; } },
  set: (k,v)      => { try { localStorage.setItem(k,JSON.stringify(v)); } catch {} },
};
const openUrl = (url, inApp=false) => inApp ? py.openInApp(url) : py.openExternal(url);

/* ══ DESIGN TOKENS + GLOBAL CSS ══════════════════════════════════ */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

*, *::before, *::after { box-sizing: border-box; }

:root {
  --bg:    #070b12;
  --panel: #0c1520;
  --p2:    #111c2b;
  --p3:    #162236;
  --line:  #1c2d42;
  --cy:    #5ec8ff;
  --am:    #ffb454;
  --gn:    #52e3b0;
  --rd:    #f06080;
  --pu:    #a78bfa;
  --tx:    #d8e6f3;
  --dim:   #5a7a96;
  --font:  -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", sans-serif;
}

html, body, #root { height: 100%; margin: 0; overflow: hidden; }
body {
  background: var(--bg);
  font-family: var(--font);
  color: var(--tx);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* ── Scrollbar ── */
::-webkit-scrollbar { width: 3px; height: 3px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--line); border-radius: 99px; }
::-webkit-scrollbar-thumb:hover { background: var(--dim); }

/* ── Focus ── */
input, select, button { font-family: var(--font); }
input:focus, select:focus {
  outline: none;
  border-color: var(--cy) !important;
  box-shadow: 0 0 0 3px rgba(94,200,255,.12);
}
button { outline: none; }
button:focus-visible { box-shadow: 0 0 0 3px rgba(94,200,255,.3); }

/* ══ ANIMATIONS ══════════════════════════════════════════════════ */

/* Entry animations */
@keyframes fadeUp {
  from { opacity: 0;  }
  to   { opacity: 1; transform: none; }
}
@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes scaleIn {
  from { opacity: 0;  }
  to   { opacity: 1;  }
}
@keyframes slideRight {
  from { opacity: 0;  }
  to   { opacity: 1; transform: none; }
}
@keyframes slideDown {
  from { opacity: 0;  }
  to   { opacity: 1; transform: none; }
}
@keyframes tabSlide {
  from { opacity: 0;  }
  to   { opacity: 1; transform: none; }
}

/* Utility animation classes */
.anim-up    { animation: fadeUp   0.32s cubic-bezier(0.2, 0.9, 0.4, 1) both; }
.anim-in    { animation: fadeIn   0.22s ease both; }
.anim-scale { animation: scaleIn  0.28s cubic-bezier(0.34, 1.5, 0.64, 1) both; }
.anim-right { animation: slideRight 0.28s cubic-bezier(0.2, 0.9, 0.4, 1) both; }
.anim-down  { animation: slideDown  0.25s cubic-bezier(0.34, 1.2, 0.64, 1) both; }
.anim-tab   { animation: tabSlide   0.22s cubic-bezier(0.2, 0.9, 0.4, 1) both; }

/* Spinner */
@keyframes spin { to { transform: rotate(360deg); } }
.spin { animation: spin 0.9s linear infinite; }

/* Pulse dot */
@keyframes pulse {
  0%, 100% { opacity: 0.35;  }
  50%       { opacity: 1;     }
}
.pulse { animation: pulse 2.2s ease-in-out infinite; }

/* ══ BUTTON SYSTEM ════════════════════════════════════════════════ */

/* Primary CTA button */
.btn-primary {
  background: var(--cy);
  color: #070b12;
  border: none;
  border-radius: 10px;
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  box-shadow: 0 4px 16px rgba(94,200,255,.28), 0 1px 2px rgba(0,0,0,.3);
  user-select: none;
  -webkit-user-select: none;
  
}
.btn-primary:hover:not(:disabled) {
  opacity: 0.9;
  box-shadow: 0 8px 24px rgba(94,200,255,.38), 0 2px 4px rgba(0,0,0,.3);
}
.btn-primary:active:not(:disabled) {
  opacity: 0.8;
  box-shadow: 0 2px 8px rgba(94,200,255,.2);
}
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

/* Ghost button */
.btn-ghost {
  background: var(--p2);
  color: var(--dim);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 7px 14px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  
}
.btn-ghost:hover  { background: var(--p3); color: var(--tx); border-color: var(--dim);  }
.btn-ghost:active {   }

/* Pill toggle button */
.btn-pill {
  border-radius: 99px;
  padding: 5px 14px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid var(--line);
  background: var(--p2);
  color: var(--dim);
  user-select: none;
  -webkit-user-select: none;
  
}
.btn-pill:hover  { background: var(--p3); color: var(--tx); }
.btn-pill.active {
  background: var(--cy);
  color: #070b12;
  border-color: var(--cy);
}

/* Icon button */
.btn-icon {
  background: transparent;
  border: none;
  border-radius: 7px;
  padding: 5px;
  cursor: pointer;
  color: var(--dim);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  
}
.btn-icon:hover  { color: var(--tx); background: var(--p2);  }
.btn-icon:active {  }

/* ══ CARD / TILE SYSTEM ══════════════════════════════════════════ */

.card {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 14px;
}

/* Shortcut tile — lifts up + cyan glow on hover */
.tile-shortcut {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 12px 10px;
  cursor: pointer;
  transition:
    transform    0.32s cubic-bezier(0.34, 1.4, 0.64, 1),
    border-color 0.22s ease,
    box-shadow   0.32s cubic-bezier(0.34, 1.4, 0.64, 1),
    background   0.18s ease;
}
.tile-shortcut:hover {
  
  border-color: rgba(94,200,255,.4);
  box-shadow:
    0 12px 32px -8px rgba(94,200,255,.18),
    0 4px 12px -4px rgba(0,0,0,.5);
  background: var(--p2);
}
.tile-shortcut:active {
  
  
}

/* List tile — slides right on hover */
.tile-list {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 10px 12px;
  transition:
    transform    0.28s cubic-bezier(0.34, 1.3, 0.64, 1),
    border-color 0.2s ease,
    background   0.18s ease;
}
.tile-list:hover {
  
  border-color: rgba(94,200,255,.25);
  background: var(--p2);
}

/* Chart provider tile */
.tile-chart {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 14px;
  cursor: pointer;
  transition:
    transform    0.3s cubic-bezier(0.34, 1.4, 0.64, 1),
    border-color 0.22s ease,
    box-shadow   0.3s ease;
}
.tile-chart:hover {
  
  box-shadow: 0 10px 28px -8px rgba(0,0,0,.5);
}
.tile-chart:active {   }

/* ══ NAV ITEMS ════════════════════════════════════════════════════ */
.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 8px 0;
  border-radius: 10px;
  cursor: pointer;
  color: var(--dim);
  border: 1px solid transparent;
  
}
.nav-item:hover {  background: var(--p2); color: var(--tx); }
.nav-item.active {
  background: var(--p2);
  color: var(--cy);
  border-color: var(--line);
  
  box-shadow: inset 2px 0 0 var(--cy);
}

/* Settings pills — no transition to prevent flash on re-render */
.settings-pill {
  border-radius: 99px;
  padding: 5px 14px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid var(--line);
  background: var(--p2);
  color: var(--dim);
  user-select: none;
  -webkit-user-select: none;
}
.settings-pill:hover  { background: var(--p3); color: var(--tx); }
.settings-pill.active {
  background: var(--cy);
  color: #070b12;
  border-color: var(--cy);
}

/* ══ STAT WIDGET ══════════════════════════════════════════════════ */
.stat-card {
  background: var(--p2);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 10px 14px;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}
.stat-card.live {
  border-color: rgba(94,200,255,.2);
  box-shadow: 0 0 16px -8px rgba(94,200,255,.15);
}

/* ══ INPUT SYSTEM ═════════════════════════════════════════════════ */
.inp {
  background: var(--p2);
  border: 1px solid var(--line);
  color: var(--tx);
  font-size: 13px;
  border-radius: 9px;
  padding: 8px 11px;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
  width: 100%;
}
.inp::placeholder { color: var(--dim); }
.inp:focus {
  border-color: var(--cy);
  box-shadow: 0 0 0 3px rgba(94,200,255,.1);
  outline: none;
}

/* ══ BADGE ════════════════════════════════════════════════════════ */
.badge {
  border-radius: 99px;
  padding: 2px 8px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.3px;
}

/* ══ MISC ═════════════════════════════════════════════════════════ */
.mono { font-variant-numeric: tabular-nums; font-feature-settings: "tnum"; }
.section-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1.4px;
  text-transform: uppercase;
  color: var(--dim);
  margin-bottom: 8px;
}
`;

/* ══ TABS CONFIG ═════════════════════════════════════════════════ */
const TABS = [
  { id:"home",        label:"Home",    icon:Plane },
  { id:"map",         label:"Map",     icon:MapIcon },
  { id:"ground",      label:"Ground",  icon:Layers },
  { id:"ofp",         label:"OFP",     icon:FileText },
  { id:"vatsim",      label:"VATSIM",  icon:Radio },
  { id:"charts",      label:"Charts",  icon:MapIcon },
  { id:"alerts",      label:"Alerts",  icon:Bell },
  { id:"controllers", label:"Ctrl",    icon:Gamepad2 },
  { id:"settings",    label:"Settings",icon:Cog },
];

const SHORTCUTS = [
  { id:"fenix",     label:"Fenix EFB",  sub:"IP:8080",    icon:Plane,        color:"#5ec8ff", urlKey:"fenixUrl" },
  { id:"navigraph", label:"Navigraph",  sub:"Charts",     icon:MapIcon,      color:"#a78bfa", url:"https://charts.navigraph.com" },
  { id:"vatsim",    label:"VATSIM",     sub:"Radar",      icon:Radar,        color:"#52e3b0", url:"https://radar.vatsim.net", forceExternal:true },
  { id:"simbrief",  label:"SimBrief",   sub:"Dispatch",   icon:FileText,     color:"#ffb454", url:"https://dispatch.simbrief.com" },
  { id:"spotify",   label:"Spotify",    sub:"Music",      icon:Music,        color:"#1db954", url:"https://open.spotify.com" },
  { id:"ytmusic",   label:"YT Music",   sub:"Music",      icon:Music,        color:"#ff6b6b", url:"https://music.youtube.com" },
  { id:"discord",   label:"Discord",    sub:"Crew",       icon:MessageCircle,color:"#7c8cff", url:"https://discord.com/app" },
  { id:"skybound",  label:"Skybound",   sub:"skybound.cx",icon:Globe,        color:"#5ec8ff", url:"https://skybound.cx" },
];

/* ══ LOGIN ════════════════════════════════════════════════════════ */
function LoginScreen() {
  const [email,    setEmail]    = useState(ls.get("sb_email","") || "");
  const [password, setPassword] = useState("");
  const [mode,     setMode]     = useState("login");
  const [loading,  setLoading]  = useState(false);
  const [err,      setErr]      = useState("");
  const [showPw,   setShowPw]   = useState(false);

  const submit = async () => {
    if (!email || !password) { setErr("Töltsd ki mindkét mezőt."); return; }
    setLoading(true); setErr("");
    try {
      if (mode === "login") await signInWithEmailAndPassword(auth, email, password);
      else await createUserWithEmailAndPassword(auth, email, password);
      ls.set("sb_email", email);
    } catch(e) {
      const msg = {
        "auth/invalid-credential":   "Hibás email vagy jelszó.",
        "auth/user-not-found":       "Nincs ilyen fiók.",
        "auth/wrong-password":       "Hibás jelszó.",
        "auth/email-already-in-use": "Ez az email már foglalt.",
        "auth/weak-password":        "Jelszó min. 6 karakter.",
        "auth/invalid-email":        "Érvénytelen email cím.",
      }[e.code] || e.message;
      setErr(msg);
    }
    setLoading(false);
  };

  return (
    <div style={{ height:"100vh", display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center", background:"var(--bg)", gap:16,
      background:"radial-gradient(ellipse at 30% 20%, #0e1e30 0%, var(--bg) 60%)" }}>
      <style>{CSS}</style>

      {/* Logo */}
      <div className="anim-scale" style={{ width:68, height:68, borderRadius:20,
        background:"linear-gradient(135deg, #5ec8ff 0%, #7c8cff 100%)",
        display:"flex", alignItems:"center", justifyContent:"center",
        boxShadow:"0 10px 40px rgba(94,200,255,.35), 0 2px 8px rgba(0,0,0,.4)" }}>
        <Navigation2 size={30} color="#070b12"/>
      </div>

      {/* Title */}
      <div className="anim-up" style={{ textAlign:"center", animationDelay:".06s" }}>
        <div style={{ fontSize:28, fontWeight:700, letterSpacing:.2, color:"var(--tx)" }}>
          SKYBOUND <span style={{ color:"var(--cy)" }}>EFB</span>
        </div>
        <div style={{ fontSize:12, color:"var(--dim)", marginTop:4 }}>Electronic Flight Bag · MSFS</div>
      </div>

      {/* Mode toggle */}
      <div className="anim-up" style={{ display:"flex", gap:6, animationDelay:".1s" }}>
        {[["login","Belépés"],["register","Regisztráció"]].map(([m,l])=>(
          <button key={m} onClick={()=>{ setMode(m); setErr(""); }}
            className={`btn-pill ${mode===m?"active":""}`}>{l}</button>
        ))}
      </div>

      {/* Form */}
      <div className="anim-up" style={{ width:320, display:"flex", flexDirection:"column",
        gap:10, animationDelay:".14s" }}>
        <input className="inp" value={email} onChange={e=>setEmail(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&submit()}
          placeholder="Email" type="email" autoComplete="email"/>

        <div style={{ position:"relative" }}>
          <input className="inp" value={password} onChange={e=>setPassword(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&submit()}
            placeholder="Jelszó" type={showPw?"text":"password"}
            style={{ paddingRight:40 }}/>
          <button className="btn-icon" onClick={()=>setShowPw(!showPw)}
            style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)" }}>
            {showPw ? <EyeOff size={15}/> : <Eye size={15}/>}
          </button>
        </div>

        {err && <div className="anim-down" style={{ color:"var(--rd)", fontSize:12 }}>{err}</div>}

        <button onClick={submit} disabled={loading} className="btn-primary"
          style={{ width:"100%", justifyContent:"center", fontSize:14, padding:"12px" }}>
          {loading ? <Loader2 size={16} className="spin"/> : (mode==="login"?"Belépés":"Fiók létrehozása")}
        </button>
      </div>

      <div className="anim-up" style={{ fontSize:11, color:"var(--dim)", textAlign:"center",
        maxWidth:260, lineHeight:1.65, animationDelay:".18s" }}>
        Ez a fiók köti össze a desktopot, a telefont és a sim bridge-et.
      </div>
    </div>
  );
}

/* ══ UPDATE BANNER ════════════════════════════════════════════════ */
const UpdateBanner = React.memo(function UpdateBanner() {
  const [info, setInfo] = useState(null);
  useEffect(() => {
    setTimeout(async () => { const r=await py.checkUpdate(); if(r?.update) setInfo(r); }, 5000);
  }, []);
  if (!info) return null;
  return (
    <div className="anim-down" style={{ display:"flex", alignItems:"center",
      justifyContent:"space-between", padding:"6px 18px", flexShrink:0,
      background:"rgba(255,180,84,.06)", borderBottom:"1px solid rgba(255,180,84,.18)" }}>
      <span style={{ fontSize:12, color:"var(--am)" }}>
        🆕 Új verzió: <strong>{info.codename}</strong>
      </span>
      <div style={{ display:"flex", gap:6 }}>
        {info.downloadUrl&&(
          <button onClick={()=>py.openExternal(info.downloadUrl)} className="btn-pill active"
            style={{ fontSize:11, padding:"3px 10px" }}>Letöltés</button>
        )}
        <button onClick={()=>py.openExternal(info.url)} className="btn-ghost"
          style={{ fontSize:11, padding:"3px 10px" }}>Release notes</button>
      </div>
    </div>
  );
});

/* ══ TITLEBAR STAT ════════════════════════════════════════════════ */
function TitleStat({label, value, unit}) {
  return (
    <div style={{ textAlign:"right" }}>
      <div style={{ fontSize:8, color:"var(--dim)", letterSpacing:1.2, textTransform:"uppercase" }}>{label}</div>
      <div className="mono" style={{ fontSize:13, color:value==null?"var(--dim)":"var(--tx)", fontWeight:500 }}>
        {value??"—"}
        {value!=null&&unit&&<span style={{ fontSize:8, color:"var(--dim)", marginLeft:2 }}>{unit}</span>}
      </div>
    </div>
  );
}

/* ══ LIVE PILL ════════════════════════════════════════════════════ */
function LivePill({ok}) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:5, borderRadius:99,
      padding:"3px 9px", fontSize:10, fontWeight:600,
      background:ok?"rgba(82,227,176,.08)":"rgba(90,112,144,.07)",
      color:ok?"var(--gn)":"var(--dim)",
      border:`1px solid ${ok?"rgba(82,227,176,.2)":"rgba(90,112,144,.15)"}`,
      transition:"all .3s ease" }}>
      <span className={ok?"pulse":""} style={{ width:5, height:5, borderRadius:"50%",
        background:ok?"var(--gn)":"var(--dim)", display:"inline-block" }}/>
      {ok?"LIVE":"SIM"}
    </div>
  );
}


/* ══ UTC CLOCK — DOM ref, zero re-renders ════════════════════════ */
function UTCClock() {
  const ref = useRef(null);
  useEffect(()=>{
    const update = () => { if(ref.current) ref.current.textContent = new Date().toUTCString().slice(17,22); };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  },[]);
  return (
    <div style={{ textAlign:"right" }}>
      <div style={{ fontSize:8, color:"var(--dim)", letterSpacing:1.2, textTransform:"uppercase" }}>UTC</div>
      <div className="mono" style={{ fontSize:13, color:"var(--tx)", fontWeight:500 }}>
        <span ref={ref}/>
        <span style={{ fontSize:8, color:"var(--dim)", marginLeft:2 }}>z</span>
      </div>
    </div>
  );
}

/* ══ APP SHELL ════════════════════════════════════════════════════ */
function AppShell({ user }) {
  const [tab, setTab]           = useState("home");
  const [prevTab, setPrevTab]   = useState(null);
  const [settings, setSettings] = useState(() => ({
    sbUser:"ddnemet", fenixUrl:"", sessionCode:"ddnemet-host",
    openLinksInApp:false, ofpMode:"simplified", theme:"dark",
    ...ls.get("sb_settings",{}),
    // Always override sbUser default if not set
    ...(ls.get("sb_settings",{}).sbUser ? {} : {sbUser:"ddnemet"}),
  }));

  // Apply theme to :root
  useEffect(()=>{
    const root = document.documentElement;
    const themes = {
      dark: {
        "--bg":"#070b12","--panel":"#0c1520","--p2":"#111c2b","--p3":"#162236",
        "--line":"#1c2d42","--tx":"#d8e6f3","--dim":"#5a7a96",
        "--cy":"#5ec8ff","--am":"#ffb454","--gn":"#52e3b0","--rd":"#f06080","--pu":"#a78bfa",
      },
      midnight: {
        "--bg":"#000008","--panel":"#07101a","--p2":"#0b1724","--p3":"#10202e",
        "--line":"#162030","--tx":"#c8ddf0","--dim":"#4a6a88",
        "--cy":"#5ec8ff","--am":"#ffb454","--gn":"#52e3b0","--rd":"#f06080","--pu":"#a78bfa",
      },
      navy: {
        "--bg":"#0a0e1a","--panel":"#0e1628","--p2":"#131e30","--p3":"#182438",
        "--line":"#1e2e44","--tx":"#ccd8f0","--dim":"#4a6080",
        "--cy":"#4db8ff","--am":"#ffaa33","--gn":"#33ddaa","--rd":"#ff4466","--pu":"#9977ff",
      },
      green: {
        "--bg":"#050f0a","--panel":"#091510","--p2":"#0d1c14","--p3":"#112318",
        "--line":"#162e1e","--tx":"#c8e8d4","--dim":"#4a7058",
        "--cy":"#33e899","--am":"#ffcc44","--gn":"#44ff88","--rd":"#ff4455","--pu":"#bb88ff",
      },
      amber: {
        "--bg":"#0f0b04","--panel":"#181205","--p2":"#201808","--p3":"#281e0a",
        "--line":"#382808","--tx":"#f0ddb0","--dim":"#806040",
        "--cy":"#ffaa22","--am":"#ff8822","--gn":"#88cc44","--rd":"#ff4444","--pu":"#dd88ff",
      },
      light: {
        "--bg":"#f0f4f8","--panel":"#e8eef4","--p2":"#dde5ed","--p3":"#d0dae6",
        "--line":"#c0ccd8","--tx":"#0f1f2e","--dim":"#4a6a88",
        "--cy":"#0a8fd4","--am":"#b06000","--gn":"#0a8a60","--rd":"#c0304e","--pu":"#5030c0",
      },
    };
    const t = themes[settings.theme||"dark"] || themes.dark;
    Object.entries(t).forEach(([k,v]) => root.style.setProperty(k,v));
  },[settings.theme]);

  const save = useCallback((k,v) => {
    setSettings(p => { const n={...p,[k]:v}; ls.set("sb_settings",n); py.saveSettings(n); return n; });
  },[]);

  const changeTab = (id) => { setPrevTab(tab); setTab(id); };

  /* Live RTDB — debounced to prevent re-render spam */
  const [live, setLive] = useState(null);
  const [rtdb, setRtdb] = useState(false);
  useEffect(() => {
    if (!settings.sessionCode) return;
    let u1, u2, debounce;
    try {
      u1 = onValue(ref(getDB(),`sessions/${settings.sessionCode}/live`), s => {
        const v = s.val();
        clearTimeout(debounce);
        debounce = setTimeout(() => setLive(v), 200);
      }, ()=>{});
      u2 = onValue(ref(getDB(),".info/connected"), s => setRtdb(s.val()===true), ()=>{});
    } catch {}
    return () => { u1?.(); u2?.(); clearTimeout(debounce); };
  }, [settings.sessionCode]);

  /* OFP */
  const [ofp, setOfp]         = useState(null);
  const [ofpState, setOfpState] = useState("idle");
  const [ofpErr, setOfpErr]   = useState("");
  const loadOFP = async (u) => {
    const un = (u || settings.sbUser || "").trim();
    if (!un) { setOfpState("error"); setOfpErr("Adj meg SimBrief usernevet."); return; }
    setOfpState("loading"); setOfpErr("");
    try {
      const r = await Promise.race([
        py.fetchOFP(un),
        new Promise((_,rej)=>setTimeout(()=>rej(new Error("Timeout (12s)")),12000)),
      ]);
      if (!r) { setOfpState("error"); setOfpErr("Nincs válasz a szervertől."); }
      else if (r?.error) { setOfpState("error"); setOfpErr(r.error); }
      else if (r?.ofp) { setOfp(r.ofp); setOfpState("idle"); save("sbUser",un); }
      else { setOfpState("error"); setOfpErr("Ismeretlen hiba."); }
    } catch(e) { setOfpState("error"); setOfpErr(e.message); }
  };
  const loadOFPRef = useRef(loadOFP);
  useEffect(() => { loadOFPRef.current = loadOFP; });
  useEffect(()=>{ if(settings.sbUser) loadOFPRef.current(settings.sbUser); },[]);

  /* Triggers */
  const [triggers, setTriggers] = useState([]);
  useEffect(()=>{
    if (!settings.sessionCode) return;
    let unsub;
    try {
      unsub = onValue(ref(getDB(),`sessions/${settings.sessionCode}/triggers`), s=>{
        const v=s.val(); setTriggers(v?Object.entries(v).map(([id,d])=>({id,...d})):[]);
      }, ()=>{});
    } catch {}
    return ()=>unsub?.();
  },[settings.sessionCode]);
  const addTr = t   => push(ref(getDB(),`sessions/${settings.sessionCode}/triggers`),{armed:true,...t});
  const delTr = id  => remove(ref(getDB(),`sessions/${settings.sessionCode}/triggers/${id}`));
  const togTr = (id,a) => update(ref(getDB(),`sessions/${settings.sessionCode}/triggers/${id}`),{armed:a});

  /* Gamepads */
  const [gamepads, setGamepads] = useState([]);
  const [axisMap, setAxisMap]   = useState(()=>ls.get("sb_axes",{}));
  useEffect(()=>{
    const t=setInterval(()=>setGamepads(
      Array.from(navigator.getGamepads?.()??[]).filter(Boolean).map(g=>({
        id:g.id, axes:Array.from(g.axes).map((v,i)=>({index:i,value:v})),
      }))
    ),200); return()=>clearInterval(t);
  },[]);
  const saveAxis=(gid,ai,lbl)=>{ const n={...axisMap,[`${gid}:${ai}`]:lbl}; setAxisMap(n); ls.set("sb_axes",n); };

  const shortcuts = SHORTCUTS.map(s=>({
    ...s,
    resolvedUrl:s.urlKey?settings[s.urlKey]:s.url,
    disabled:s.urlKey?!settings[s.urlKey]:false,
  }));
  const inApp = settings.openLinksInApp;

  return (
    <div style={{ height:"100vh", display:"flex", flexDirection:"column",
      background:"var(--bg)", overflow:"hidden" }}>
      <style>{CSS}</style>
      {/* ── Titlebar ── */}
      <div style={{ height:52, display:"flex", alignItems:"center",
        justifyContent:"space-between", padding:"0 18px",
        borderBottom:"1px solid #1c2d42",
        background:"#0c1520",
        WebkitAppRegion:"drag", flexShrink:0, gap:16 }}>

        {/* Left: logo + info */}
        <div style={{ display:"flex", alignItems:"center", gap:10, WebkitAppRegion:"no-drag" }}>
          <div style={{ width:30, height:30, borderRadius:8, flexShrink:0,
            background:"linear-gradient(135deg,#5ec8ff,#7c8cff)",
            display:"flex", alignItems:"center", justifyContent:"center",
            boxShadow:"0 3px 10px rgba(94,200,255,.3)" }}>
            <Navigation2 size={14} color="#070b12"/>
          </div>
          <div>
            <div style={{ fontSize:12, fontWeight:700, letterSpacing:.15 }}>
              SKYBOUND <span style={{ color:"var(--cy)" }}>EFB</span>
            </div>
            <div style={{ fontSize:9, color:"var(--dim)", marginTop:1 }}>
              {ofp?`${ofp.dep||"?"}→${ofp.arr||"?"}`:"no OFP"} · {settings.sessionCode}
            </div>
          </div>
        </div>

        {/* Right: stats + user */}
        <div style={{ display:"flex", alignItems:"center", gap:16, WebkitAppRegion:"no-drag" }}>
          <TitleStat label="GS"  value={live?Math.round(live.gsKt):null}  unit="kt"/>
          <TitleStat label="ALT" value={live?Math.round(live.altFt)?.toLocaleString():null} unit="ft"/>
          <UTCClock/>
          <div style={{ width:1, height:24, background:"var(--line)" }}/>
          <LivePill ok={rtdb&&!!live}/>
          <div style={{ fontSize:10, color:"var(--dim)", maxWidth:120,
            overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
            {user.email}
          </div>
          <button className="btn-icon" onClick={()=>signOut(auth)} title="Kijelentkezés">
            <LogOut size={13}/>
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ display:"flex", flex:1, overflow:"hidden" }}>

        {/* Sidebar */}
        <div style={{ width:76, borderRight:"1px solid #1c2d42",
          background:"#0a1520",
          display:"flex", flexDirection:"column", padding:"8px 5px",
          gap:2, flexShrink:0 }}>
          {TABS.map((t,i) => {
            const I = t.icon;
            return (
              <button key={t.id} onPointerDown={(e)=>{ e.preventDefault(); changeTab(t.id); }}
                className={`nav-item anim-right ${tab===t.id?"active":""}`}
                style={{ animationDelay:`${i*18}ms`, width:"100%", border:"none", cursor:"pointer" }}>
                <I size={15}/>
                <span style={{ fontSize:9, letterSpacing:.3, fontWeight:600 }}>{t.label}</span>
              </button>
            );
          })}
          <button className="nav-item" onClick={()=>signOut(auth)}
            style={{ marginTop:"auto", width:"100%", border:"none", cursor:"pointer" }}>
            <LogOut size={13}/>
            <span style={{ fontSize:9 }}>Out</span>
          </button>
        </div>

        {/* Main content — re-mounts on tab change for animation */}
        <div key={tab} className="anim-tab"
          style={{ flex:1, overflow:"auto", padding:16,
            background:"radial-gradient(ellipse at 0 0, rgba(94,200,255,.012) 0%, transparent 45%)" }}>
          {tab==="home"        && <HomeTab live={live} ofp={ofp} shortcuts={shortcuts} inApp={inApp}/>}
          {tab==="map"         && <MapTab ofp={ofp} live={live}/>}
          {tab==="ground"      && <GroundTab live={live} ofp={ofp}/>}
          {tab==="ofp"         && <OFPTab sbUser={settings.sbUser} setSbUser={v=>save("sbUser",v)}
                                    ofp={ofp} state={ofpState} error={ofpErr} onLoad={loadOFP}
                                    mode={settings.ofpMode} setMode={v=>save("ofpMode",v)}/>}
          {tab==="vatsim"      && <VatsimTab/>}
          {tab==="charts"      && <ChartsTab ofp={ofp}/>}
          {tab==="alerts"      && <AlertsTab triggers={triggers} onAdd={addTr} onDel={delTr} onToggle={togTr}/>}
          {tab==="controllers" && <ControllersTab gamepads={gamepads} axisMap={axisMap} onSave={saveAxis} live={live}/>}
          {tab==="settings"    && <SettingsTab settings={settings} save={save} onLoadOFP={()=>loadOFP()}/>}
        </div>
      </div>
    </div>
  );
}

/* ══ ROOT ════════════════════════════════════════════════════════ */
// Global button click handler - captures ALL button clicks at document level
// This fixes React event delegation issues in Tauri WKWebView
if (typeof window !== 'undefined') {
  window.__sbHandlers = new Map();
  window.__sbRegister = (id, fn) => window.__sbHandlers.set(id, fn);
  window.__sbUnregister = (id) => window.__sbHandlers.delete(id);

  document.addEventListener('mousedown', (e) => {
    const btn = e.target.closest('button[data-sbid]');
    if (!btn) return;
    e.preventDefault();
    const id = btn.getAttribute('data-sbid');
    const fn = window.__sbHandlers.get(id);
    if (fn) fn(e);
  }, true);
}

let _sbIdCounter = 0;
function useSbClick(fn) {
  const id = useRef('sb_' + (++_sbIdCounter));
  const fnRef = useRef(fn);
  useEffect(() => { fnRef.current = fn; }, [fn]);
  useEffect(() => {
    const myId = id.current;
    window.__sbRegister(myId, (e) => fnRef.current(e));
    return () => window.__sbUnregister(myId);
  }, []);
  return id.current;
}

export default function App() {
  const [user, setUser] = useState(undefined);
  useEffect(()=>onAuthStateChanged(auth, setUser),[]);

  if (user===undefined) return (
    <div style={{ height:"100vh", background:"var(--bg)", display:"flex",
      flexDirection:"column", alignItems:"center", justifyContent:"center", gap:12 }}>
      <style>{CSS}</style>
      <div style={{ width:48, height:48, borderRadius:14,
        background:"linear-gradient(135deg,#5ec8ff,#7c8cff)",
        display:"flex", alignItems:"center", justifyContent:"center",
        boxShadow:"0 8px 28px rgba(94,200,255,.3)" }}>
        <Navigation2 size={22} color="#070b12"/>
      </div>
      <Loader2 size={18} color="var(--cy)" className="spin"/>
    </div>
  );
  if (!user) return <LoginScreen/>;
  return (
    <>
      <UpdateBanner/>
      <AppShell user={user}/>
    </>
  );
}

/* ══ SECTION LABEL ════════════════════════════════════════════════ */
function SL({children, style={}}) {
  return <div className="section-label" style={style}>{children}</div>;
}

/* ══ MINI MAP ════════════════════════════════════════════════════ */
function MiniMap({ofp, live, height=260}) {
  const W=1000, H=height;
  const fixes=(ofp?.fixes||[]).filter(f=>f.lat!=null);
  if (!fixes.length&&!live) return (
    <div style={{ width:"100%", height, display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center", gap:8, color:"var(--dim)",
      background:"radial-gradient(ellipse at 30% 30%,#0d1e32,var(--bg))" }}>
      <MapIcon size={22} color="#1e3a5f"/>
      <span style={{ fontSize:12 }}>Nincs OFP / bridge</span>
    </div>
  );
  const pts=[...fixes,...(live?[{lat:live.lat,lon:live.lon}]:[])];
  const lats=pts.map(p=>p.lat), lons=pts.map(p=>p.lon);
  const la0=Math.min(...lats), la1=Math.max(...lats), lo0=Math.min(...lons), lo1=Math.max(...lons);
  const pd=55;
  const sx=lon=>pd+(lo1===lo0?.5:(lon-lo0)/(lo1-lo0))*(W-2*pd);
  const sy=lat=>pd+(la1===la0?.5:1-(lat-la0)/(la1-la0))*(H-2*pd);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", height, display:"block",
      background:"radial-gradient(ellipse at 35% 30%,#0d1e32,#080e1a 55%,var(--bg))" }}>
      {/* Grid */}
      {Array.from({length:10}).map((_,i)=>(
        <line key={"v"+i} x1={i*W/9} y1={0} x2={i*W/9} y2={H} stroke="#5ec8ff" strokeOpacity=".025"/>
      ))}
      {Array.from({length:7}).map((_,i)=>(
        <line key={"h"+i} x1={0} y1={i*H/6} x2={W} y2={i*H/6} stroke="#5ec8ff" strokeOpacity=".025"/>
      ))}
      {/* Route */}
      {fixes.length>1&&(
        <polyline points={fixes.map(f=>`${sx(f.lon)},${sy(f.lat)}`).join(" ")}
          fill="none" stroke="#5ec8ff" strokeOpacity=".45" strokeWidth="2.2"
          strokeDasharray="8 5"/>
      )}
      {/* Fixes */}
      {fixes.map((f,i)=>{
        const isKey=i===0||i===fixes.length-1||i%Math.max(1,Math.floor(fixes.length/7))===0;
        return (
          <g key={f.ident+i}>
            <circle cx={sx(f.lon)} cy={sy(f.lat)}
              r={i===0||i===fixes.length-1?6:3.5}
              fill={i===0?"#52e3b0":i===fixes.length-1?"#f06080":"#2a6090"}/>
            {isKey&&<text x={sx(f.lon)+9} y={sy(f.lat)+4}
              fill="#6a9fcc" fontSize="11" fontFamily="ui-monospace,monospace">{f.ident}</text>}
          </g>
        );
      })}
      {/* Plane */}
      {live&&(
        <g transform={`translate(${sx(live.lon)},${sy(live.lat)})`}>
          <circle r={14} fill="rgba(94,200,255,.04)" stroke="rgba(94,200,255,.12)" strokeWidth="1"/>
          <path d="M0,-11 L7,9 L0,4 L-7,9 Z"
            fill="#fff" stroke="#5ec8ff" strokeWidth="1.5"
            style={{ filter:"drop-shadow(0 0 6px #5ec8ff)" }}/>
        </g>
      )}
    </svg>
  );
}

/* ══ HOME TAB ════════════════════════════════════════════════════ */
function HomeTab({live, ofp, shortcuts, inApp}) {
  const stats = [
    ["ETE",  live?`${Math.floor(live.destEteMin/60)}:${String(Math.round(live.destEteMin)%60).padStart(2,"0")}`:null, "",    "var(--cy)"],
    ["GS",   live?Math.round(live.gsKt):null,                  "kt",  null],
    ["ALT",  live?Math.round(live.altFt)?.toLocaleString():null,"ft",  null],
    ["V/S",  live?Math.round(live.vsFpm):null,                 "fpm", live?.vsFpm<-200?"var(--am)":null],
  ];

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      {!live&&(
        <div className="anim-up" style={{ display:"flex", alignItems:"center", gap:8,
          borderRadius:10, padding:"8px 12px", fontSize:12,
          background:"rgba(255,180,84,.05)", border:"1px solid rgba(255,180,84,.15)", color:"#ffb454" }}>
          <AlertCircle size={13}/>
          Sim bridge nincs csatlakoztatva — az élő adatok a bridge futásakor jelennek meg.
        </div>
      )}

      {/* Stat cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
        {stats.map(([l,v,u,a],i)=>(
          <div key={l} className={`stat-card anim-up ${v!=null?"live":""}`}
            style={{ animationDelay:`${i*35}ms`, background:"#111c2b", border:"1px solid #1c2d42", borderRadius:12, padding:"10px 14px" }}>
            <div style={{ fontSize:9, color:"#5a7a96", letterSpacing:1.2,
              textTransform:"uppercase", marginBottom:4 }}>{l}</div>
            <div className="mono" style={{ fontSize:22, fontWeight:600,
              color:v==null?"#3a5070":(a||"#d8e6f3") }}>
              {v??"—"}
              {v!=null&&u&&<span style={{ fontSize:9, color:"var(--dim)", marginLeft:3 }}>{u}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Shortcuts */}
      <SL>Shortcuts</SL>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
        {shortcuts.map((s,i) => {
          const I = s.icon;
          return (
            <button key={s.id}
              className={`tile-shortcut anim-up`}
              style={{ opacity:s.disabled?.45:1, animationDelay:`${i*22}ms`,
                border:"1px solid #1c2d42", background:"#0c1520",
                cursor:s.disabled?"default":"pointer", textAlign:"left", width:"100%" }}
              onClick={()=>!s.disabled&&(s.forceExternal?py.openExternal(s.resolvedUrl):openUrl(s.resolvedUrl,inApp))}>
              <div style={{ display:"flex", alignItems:"center",
                justifyContent:"space-between", marginBottom:8 }}>
                <div style={{ width:32, height:32, borderRadius:9, background:"var(--p2)",
                  border:"1px solid var(--line)", display:"flex", alignItems:"center",
                  justifyContent:"center" }}>
                  <I size={14} color={s.color}/>
                </div>
                <ExternalLink size={9} color="var(--dim)" style={{ opacity:.6 }}/>
              </div>
              <div style={{ fontSize:11, fontWeight:600, marginBottom:2, color:"#d8e6f3" }}>{s.label}</div>
              <div style={{ fontSize:9, color:"#5a7a96", overflow:"hidden",
                textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                {s.disabled?"⚙ állítsd be →":s.sub}
              </div>
            </button>
          );
        })}
      </div>

      {/* Map + OFP */}
      <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:10 }}>
        <div style={{ borderRadius:14, overflow:"hidden", border:"1px solid var(--line)" }}>
          <MiniMap ofp={ofp} live={live}/>
        </div>
        <div className="card">
          <SL style={{ marginBottom:8 }}>Load · SimBrief</SL>
          {ofp ? (
            <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
              {[["PAX",     ofp.pax,      Users,         null],
                ["Payload", ofp.payload!=null?`${ofp.payload} ${ofp.units}`:null, Weight, null],
                ["Block",   ofp.blockFuel!=null?`${ofp.blockFuel} ${ofp.units}`:null, Fuel, "var(--am)"],
                ["CI",      ofp.costindex, ArrowDownRight, null],
              ].map(([l,v,I,a])=>(
                <div key={l} style={{ display:"flex", alignItems:"center",
                  justifyContent:"space-between", padding:"7px 0",
                  borderBottom:"1px solid var(--line)" }}>
                  <span style={{ display:"flex", alignItems:"center", gap:5,
                    fontSize:11, color:"var(--tx)" }}>
                    <I size={11} color="var(--dim)"/>{l}
                  </span>
                  <span className="mono" style={{ fontSize:12,
                    color:v==null?"var(--dim)":(a||"var(--tx)") }}>{v??"—"}</span>
                </div>
              ))}
            </div>
          ) : <div style={{ fontSize:12, color:"var(--dim)", lineHeight:1.6 }}>Nincs OFP betöltve.</div>}
        </div>
      </div>
    </div>
  );
}


/* ══ MAP TAB — Satellite (Leaflet + Esri) ════════════════════════ */
function MapTab({ofp, live}) {
  const mapRef = React.useRef(null);
  const leafRef = React.useRef(null);

  React.useEffect(()=>{
    if (!document.getElementById("lf-css")) {
      const l=document.createElement("link"); l.id="lf-css";
      l.rel="stylesheet"; l.href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(l);
    }
    const init = () => {
      if (!mapRef.current || leafRef.current) return;
      const L=window.L;
      const fixes=(ofp?.fixes||[]).filter(f=>f.lat!=null);
      const center = live?[live.lat,live.lon] : fixes.length?[fixes[Math.floor(fixes.length/2)].lat,fixes[Math.floor(fixes.length/2)].lon]:[47.4,19.26];
      const map = L.map(mapRef.current,{zoomControl:true,attributionControl:false}).setView(center,7);
      leafRef.current = map;
      // Satellite tiles
      L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",{maxZoom:19}).addTo(map);
      // Labels overlay
      L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",{maxZoom:19,opacity:.7}).addTo(map);
      // Route
      if (fixes.length>1) {
        L.polyline(fixes.map(f=>[f.lat,f.lon]),{color:"#5ec8ff",weight:2.5,dashArray:"8,5",opacity:.75}).addTo(map);
        fixes.forEach((f,i)=>{
          const isKey=i===0||i===fixes.length-1||i%Math.max(1,Math.floor(fixes.length/8))===0;
          if(!isKey) return;
          L.circleMarker([f.lat,f.lon],{
            radius:i===0||i===fixes.length-1?7:4,
            color:i===0?"#52e3b0":i===fixes.length-1?"#f06080":"#5ec8ff",
            fillColor:i===0?"#52e3b0":i===fixes.length-1?"#f06080":"#2a6090",
            fillOpacity:1,weight:2,
          }).bindTooltip(f.ident,{permanent:false,direction:"top",className:"lf-tip"}).addTo(map);
        });
      }
      // Plane
      if(live){
        const icon=L.divIcon({
          html:`<svg viewBox="0 0 24 24" width="22" height="22"><path d="M12 2 L17 18 L12 14 L7 18 Z" fill="white" stroke="#5ec8ff" stroke-width="1.5" style="filter:drop-shadow(0 0 4px #5ec8ff)"/></svg>`,
          iconSize:[22,22],iconAnchor:[11,11],className:""
        });
        L.marker([live.lat,live.lon],{icon}).addTo(map);
      }
    };
    if (window.L) init();
    else {
      const s=document.createElement("script");
      s.src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      s.onload=init; document.head.appendChild(s);
    }
    return ()=>{ if(leafRef.current){leafRef.current.remove();leafRef.current=null;} };
  },[]);

  return (
    <div style={{ borderRadius:14,overflow:"hidden",border:"1px solid var(--line)",height:"calc(100vh - 110px)" }}>
      <div ref={mapRef} style={{width:"100%",height:"100%"}}/>
      <style>{`
        .leaflet-container{background:#070b12;font-family:var(--font);}
        .leaflet-control-zoom a{background:#0d1520;color:#cdd9ec;border-color:#1c2d42;}
        .leaflet-control-zoom a:hover{background:#111c2b;}
        .lf-tip{background:#0d1520;border:1px solid #1c2d42;color:#d8e6f3;font-size:11px;padding:2px 6px;}
      `}</style>
    </div>
  );
}

/* ══ GROUND MAP TAB ══════════════════════════════════════════════ */
function GroundTab({ live, ofp }) {
  const mapRef  = React.useRef(null);
  const leafRef = React.useRef(null);
  const planeRef= React.useRef(null);
  const [following, setFollowing] = React.useState(true);

  const makePlaneIcon = (L, heading) => L.divIcon({
    html: `<div id="gnd-plane" style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;transform:rotate(${heading}deg);transition:transform .25s linear;">
      <svg viewBox="0 0 32 32" width="32" height="32">
        <path d="M16 3 L20 29 L16 24 L12 29 Z" fill="#5ec8ff" stroke="#fff" stroke-width="1.2"/>
        <rect x="5" y="14" width="22" height="4" rx="2" fill="#5ec8ff" opacity=".75"/>
        <rect x="10" y="22" width="12" height="3" rx="1.5" fill="#5ec8ff" opacity=".5"/>
        <circle cx="16" cy="16" r="2.5" fill="#fff" opacity=".9"/>
      </svg>
    </div>`,
    iconSize: [32, 32], iconAnchor: [16, 16], className: "",
  });

  React.useEffect(() => {
    if (!document.getElementById("lf-css")) {
      const l = document.createElement("link"); l.id = "lf-css";
      l.rel = "stylesheet"; l.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(l);
    }
    const init = () => {
      if (!mapRef.current || leafRef.current) return;
      const L = window.L;
      const center = live ? [live.lat, live.lon] : [47.4338, 19.2613];
      const map = L.map(mapRef.current, { zoomControl: true, attributionControl: false }).setView(center, 17);
      leafRef.current = map;

      // Satellite base
      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 20 }
      ).addTo(map);

      // OSM overlay — taxiway labels + layout
      L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        { maxZoom: 20, opacity: 0.38 }
      ).addTo(map);

      if (live) {
        planeRef.current = L.marker([live.lat, live.lon], {
          icon: makePlaneIcon(L, live.headingDeg || 0),
          zIndexOffset: 1000,
        }).addTo(map);
      }

      // Stop following when user drags
      map.on("mousedown touchstart", () => setFollowing(false));
    };

    if (window.L) init();
    else {
      const s = document.createElement("script");
      s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      s.onload = init; document.head.appendChild(s);
    }
    return () => { if (leafRef.current) { leafRef.current.remove(); leafRef.current = null; planeRef.current = null; } };
  }, []);

  // Live position + heading update
  React.useEffect(() => {
    if (!leafRef.current || !live) return;
    const L = window.L;
    const pos = [live.lat, live.lon];
    const heading = live.headingDeg || 0;
    if (planeRef.current) {
      planeRef.current.setLatLng(pos);
      // Smooth heading via DOM
      const el = planeRef.current.getElement?.();
      const inner = el?.querySelector("#gnd-plane");
      if (inner) inner.style.transform = `rotate(${heading}deg)`;
    } else if (L && leafRef.current) {
      planeRef.current = L.marker(pos, {
        icon: makePlaneIcon(L, heading), zIndexOffset: 1000,
      }).addTo(leafRef.current);
    }
    if (following) leafRef.current.setView(pos);
  }, [live?.lat, live?.lon, live?.headingDeg, following]);

  const recenter = () => {
    setFollowing(true);
    if (live && leafRef.current) leafRef.current.setView([live.lat, live.lon], 17);
  };

  return (
    <div style={{ position:"relative", borderRadius:14, overflow:"hidden",
      border:"1px solid var(--line)", height:"calc(100vh - 110px)" }}>
      <div ref={mapRef} style={{ width:"100%", height:"100%" }}/>

      {/* HUD overlay */}
      {live && (
        <div style={{ position:"absolute", top:12, left:12, zIndex:1000,
          background:"rgba(7,11,18,.82)", border:"1px solid #1c2d42",
          borderRadius:10, padding:"7px 12px", fontSize:11, color:"#d8e6f3",
          display:"flex", flexDirection:"column", gap:4, pointerEvents:"none",
          backdropFilter:"blur(6px)" }}>
          <div style={{ fontWeight:700, fontSize:10, letterSpacing:1.1, color:"var(--cy)" }}>
            {live.onGround ? "ON GROUND" : "AIRBORNE"}
          </div>
          {live.gsKt != null && <div>GS <b>{Math.round(live.gsKt)} kt</b></div>}
          {live.headingDeg != null && <div>HDG <b>{Math.round(live.headingDeg)}°</b></div>}
          {!live.onGround && live.altFt != null && <div>ALT <b>{Math.round(live.altFt).toLocaleString()} ft</b></div>}
        </div>
      )}

      {/* Re-center button */}
      {!following && live && (
        <button onClick={recenter}
          style={{ position:"absolute", bottom:20, right:20, zIndex:1000,
            background:"#0d1520", border:"1px solid var(--cy)", color:"var(--cy)",
            borderRadius:8, padding:"6px 14px", fontSize:11, fontWeight:600,
            cursor:"pointer", backdropFilter:"blur(6px)" }}>
          ⊕ Re-center
        </button>
      )}

      {/* No live data notice */}
      {!live && (
        <div style={{ position:"absolute", bottom:20, left:"50%", transform:"translateX(-50%)",
          zIndex:1000, background:"rgba(7,11,18,.82)", border:"1px solid #1c2d42",
          borderRadius:8, padding:"6px 14px", fontSize:11, color:"var(--dim)" }}>
          Bridge nincs csatlakoztatva — nincs élő pozíció
        </div>
      )}

      <style>{`
        .leaflet-container{background:#06090f;font-family:var(--font);}
        .leaflet-control-zoom a{background:#0d1520;color:#cdd9ec;border-color:#1c2d42;}
        .leaflet-control-zoom a:hover{background:#111c2b;}
      `}</style>
    </div>
  );
}

/* ══ NATIVE BUTTON (legacy)
function NativeButton(p){return <SbButton {...p}/>;}

/* ══ SbButton — global mousedown capture, bypasses React delegation ══════ */
let _sbCnt = 0;
function SbButton({ onClick, style, children, className }) {
  const id = useRef('sb' + (++_sbCnt));
  const cbRef = useRef(onClick);
  useEffect(() => { cbRef.current = onClick; }, [onClick]);
  useEffect(() => {
    const myId = id.current;
    if (window.__sbRegister) window.__sbRegister(myId, () => cbRef.current?.());
    return () => { if (window.__sbUnregister) window.__sbUnregister(myId); };
  }, []);
  return <button data-sbid={id.current} style={style} className={className}>{children}</button>;
}

// ══ — bypasses React event delegation issues in WKWebView ═ */
function NativeButton({ onClick, style, children, className }) {
  const ref = useRef(null);
  const cbRef = useRef(onClick);
  useEffect(() => { cbRef.current = onClick; }, [onClick]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = (e) => { e.preventDefault(); e.stopPropagation(); cbRef.current && cbRef.current(e); };
    el.addEventListener("mousedown", handler, { passive: false });
    el.addEventListener("touchstart", handler, { passive: false });
    return () => { el.removeEventListener("mousedown", handler); el.removeEventListener("touchstart", handler); };
  }, []);
  return <button ref={ref} style={style} className={className}>{children}</button>;
}

/* ══ SbButton — global mousedown capture, bypasses React delegation ══════ */


/* ══ OFP TAB ═════════════════════════════════════════════════════ */
function OFPTab({sbUser, setSbUser, ofp, state, error, onLoad, mode, setMode}) {
  const [sec, setSec] = useState("weights");

  const S = {
    card: {
      background:"#0c1520", border:"1px solid #1c2d42",
      borderRadius:12, padding:14,
    },
    row: {
      display:"flex", alignItems:"center", justifyContent:"space-between",
      padding:"7px 0", borderBottom:"1px solid #1c2d42",
    },
    lbl: { fontSize:11, color:"#d8e6f3", display:"flex", alignItems:"center", gap:5 },
    val: { fontVariantNumeric:"tabular-nums", fontSize:12, color:"#d8e6f3" },
    pill: (active) => ({
      borderRadius:99, padding:"5px 14px", fontSize:12, fontWeight:600,
      cursor:"pointer", border:"1px solid",
      background: active ? "#5ec8ff" : "#0d1825",
      color:       active ? "#070b12" : "#5a7a96",
      borderColor: active ? "#5ec8ff" : "#1c2d42",
    }),
    inp: {
      flex:1, background:"#111c2b", border:"1px solid #1c2d42",
      color:"#d8e6f3", fontSize:13, borderRadius:8, padding:"8px 11px",
    },
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ fontSize:10, fontWeight:700, letterSpacing:1.5,
          textTransform:"uppercase", color:"#5a7a96" }}>SimBrief OFP</div>
        <div style={{ display:"flex", gap:6 }}>
          {[["simplified","Simplified"],["realistic","Realistic"]].map(([v,l])=>(
            <button key={v} style={S.pill(mode===v)} onClick={()=>setMode(v)}>{l}</button>
          ))}
        </div>
      </div>

      {/* Fetch bar */}
      <div style={S.card}>
        <div style={{ fontSize:9, color:"#5a7a96", letterSpacing:1.2, marginBottom:6 }}>SIMBRIEF USERNÉV</div>
        <div style={{ display:"flex", gap:8 }}>
          <input style={S.inp} value={sbUser}
            onChange={e=>setSbUser(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&onLoad(sbUser)}
            placeholder="pl. ddnemet"/>
          <button
            onClick={()=>onLoad(sbUser)}
            onPointerDown={(e)=>{ e.preventDefault(); onLoad(sbUser); }}
            style={{ background:"#5ec8ff", color:"#070b12", border:"none",
              borderRadius:8, padding:"8px 18px", fontSize:13, fontWeight:700,
              cursor:"pointer", display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
            {state==="loading"
              ? <><Loader2 size={13} style={{animation:"spin .9s linear infinite"}}/>Betöltés...</>
              : <><FileText size={13}/>Betölt</>}
          </button>
          {sbUser && (
            <button onClick={()=>py.openInApp(`https://www.simbrief.com/api/xml.fetcher.php?username=${sbUser}&type=pdf`)}
              style={{ background:"#111c2b", color:"#5a7a96", border:"1px solid #1c2d42",
                borderRadius:8, padding:"8px 14px", fontSize:12, cursor:"pointer",
                display:"flex", alignItems:"center", gap:5, flexShrink:0 }}>
              <ExternalLink size={12}/>OFP PDF
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {state==="error" && (
        <div style={{ display:"flex", alignItems:"center", gap:8, borderRadius:10,
          padding:"8px 12px", fontSize:12,
          background:"rgba(240,96,128,.07)", border:"1px solid rgba(240,96,128,.2)",
          color:"#f06080" }}>
          <AlertCircle size={13}/>{error}
        </div>
      )}

      {/* Simplified view */}
      {ofp && mode==="simplified" && (
        <div style={S.card}>
          <div style={{ fontVariantNumeric:"tabular-nums", fontSize:20,
            fontWeight:700, marginBottom:12, color:"#d8e6f3" }}>
            {ofp.dep||"?"} → {ofp.arr||"?"}
            {ofp.altn && <span style={{ fontSize:13, color:"#5a7a96", marginLeft:8 }}>/ {ofp.altn}</span>}
          </div>
          <div style={{ fontSize:11, color:"#5a7a96", marginBottom:12 }}>{ofp.aircraft}</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:7 }}>
            {[
              ["PAX",          ofp.pax],
              ["Payload",      ofp.payload!=null?`${Math.round(ofp.payload).toLocaleString()} ${ofp.units}`:null],
              ["ZFW",          ofp.zfw!=null?`${Math.round(ofp.zfw).toLocaleString()} ${ofp.units}`:null],
              ["TOW",          ofp.tow!=null?`${Math.round(ofp.tow).toLocaleString()} ${ofp.units}`:null],
              ["Block fuel",   ofp.blockFuel!=null?`${Math.round(ofp.blockFuel).toLocaleString()} ${ofp.units}`:null],
              ["Cost index",   ofp.costindex],
              ["Route dist.",  ofp.routeDistanceNm!=null?`${Math.round(ofp.routeDistanceNm)} nm`:null],
              ["ETE",          ofp.ete],
            ].map(([l,v])=>(
              <div key={l} style={{ display:"flex", justifyContent:"space-between",
                padding:"7px 10px", background:"#111c2b",
                borderRadius:8, border:"1px solid #1c2d42" }}>
                <span style={{ fontSize:11, color:"#5a7a96" }}>{l}</span>
                <span style={{ fontVariantNumeric:"tabular-nums", fontSize:12,
                  color:v==null?"#3a5070":"#d8e6f3" }}>{v??"—"}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Realistic view */}
      {ofp && mode==="realistic" && (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {[["weights","Weights"],["fuel","Fuel"],["route","Route"],["navlog","Navlog"]].map(([k,l])=>(
              <button key={k} style={S.pill(sec===k)} onClick={()=>setSec(k)}>{l}</button>
            ))}
          </div>
          <div style={S.card}>
            {sec==="weights" && [
              ["PAX",     ofp.pax,      Users],
              ["Payload", ofp.payload!=null?`${Math.round(ofp.payload).toLocaleString()} ${ofp.units}`:null, Weight],
              ["ZFW",     ofp.zfw!=null?`${Math.round(ofp.zfw).toLocaleString()} ${ofp.units}`:null, Weight],
              ["TOW",     ofp.tow!=null?`${Math.round(ofp.tow).toLocaleString()} ${ofp.units}`:null, Weight],
              ["CI",      ofp.costindex, ArrowDownRight],
            ].map(([l,v,I])=>(
              <div key={l} style={S.row}>
                <span style={S.lbl}>{I&&<I size={11} color="#5a7a96"/>}{l}</span>
                <span style={{...S.val, color:v==null?"#3a5070":"#d8e6f3"}}>{v??"—"}</span>
              </div>
            ))}
            {sec==="fuel" && [
              ["Block",       ofp.blockFuel,   "#ffb454"],
              ["Trip burn",   ofp.enrouteBurn, null],
              ["Contingency", ofp.contFuel,    null],
              ["Alternate",   ofp.altFuel,     null],
              ["Reserve",     ofp.resFuel,     null],
              ["Extra",       ofp.extraFuel,   "#52e3b0"],
            ].map(([l,v,a])=>(
              <div key={l} style={S.row}>
                <span style={S.lbl}><Fuel size={11} color="#5a7a96"/>{l}</span>
                <span style={{...S.val, color:v==null?"#3a5070":(a||"#d8e6f3")}}>
                  {v!=null?`${Math.round(v).toLocaleString()} ${ofp.units}`:"—"}
                </span>
              </div>
            ))}
            {sec==="route" && (
              <div style={{ fontVariantNumeric:"tabular-nums", fontSize:12,
                lineHeight:1.8, wordBreak:"break-all", color:"#d8e6f3" }}>
                {ofp.route||"—"}
              </div>
            )}
            {sec==="navlog" && ofp.fixes.map((f,i)=>(
              <div key={f.ident+i} style={{ display:"flex", gap:10,
                padding:"5px 0", borderBottom:"1px solid rgba(28,45,66,.6)" }}>
                <span style={{ color:"#5ec8ff", width:60, fontSize:12,
                  fontVariantNumeric:"tabular-nums" }}>{f.ident}</span>
                <span style={{ color:"#5a7a96", flex:1, fontSize:11 }}>{f.stage||"—"}</span>
                <span style={{ fontVariantNumeric:"tabular-nums", fontSize:12 }}>
                  {f.altitude!=null?`${Math.round(f.altitude).toLocaleString()} ft`:"—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

/* ══ VATSIM TAB ══════════════════════════════════════════════════ */
function VatsimTab() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [opened,  setOpened]  = useState({});

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch("https://data.vatsim.net/v3/vatsim-data.json");
      const d = await r.json();
      setData(d);
    } catch {}
    setLoading(false);
  };
  useEffect(()=>{ load(); const t=setInterval(load,60000); return()=>clearInterval(t); },[]);

  const FAC={0:"OBS",1:"FSS",2:"DEL",3:"GND",4:"TWR",5:"APP",6:"CTR"};
  const FC={DEL:"var(--pu)",GND:"var(--gn)",TWR:"var(--cy)",APP:"var(--am)",CTR:"var(--rd)",FSS:"#94a3b8",OBS:"var(--dim)"};
  const atisMap={};
  (data?.atis||[]).forEach(a=>{atisMap[a.callsign]=a;});
  const ctrls=(data?.controllers||[]).filter(c=>c.facility>0).slice(0,60);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <SL>VATSIM ATC</SL>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          {data&&<span style={{ fontSize:10, color:"var(--dim)" }}>
            {(data.controllers||[]).filter(c=>c.facility>0).length} online
          </span>}
          <button onClick={load} className="btn-icon">
            <RefreshCw size={13} className={loading?"spin":""}/>
          </button>
        </div>
      </div>

      {loading&&!data&&(
        <div style={{ color:"var(--dim)", fontSize:12, textAlign:"center", padding:30 }}>Betöltés…</div>
      )}

      {ctrls.map((c,i) => {
        const fac=FAC[c.facility]||"CTR", fc=FC[fac]||"var(--dim)";
        const atis=atisMap[c.callsign]; const isOpen=opened[c.callsign];
        return (
          <div key={c.callsign}
            className="anim-up" style2=""
            style={{ cursor:atis?"pointer":"default",
              borderColor:isOpen?fc.replace("var(","").replace(")",""):"var(--line)",
              animationDelay:`${i*18}ms` }}
            onClick={()=>atis&&setOpened(p=>({...p,[c.callsign]:!p[c.callsign]}))}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span className="badge" style={{ background:`color-mix(in srgb, ${fc} 15%, transparent)`,
                border:`1px solid color-mix(in srgb, ${fc} 35%, transparent)`,
                color:fc, flexShrink:0 }}>{fac}</span>
              <div style={{ flex:1, minWidth:0 }}>
                <div className="mono" style={{ fontWeight:600, fontSize:13 }}>
                  {c.callsign}
                  {atis&&<span style={{ color:"var(--cy)", fontSize:10, marginLeft:6 }}>
                    ATIS {atis.atis_code}
                  </span>}
                </div>
                <div style={{ fontSize:10, color:"var(--dim)", marginTop:1 }}>{c.name}</div>
              </div>
              <div className="mono" style={{ fontSize:13, color:"var(--am)", flexShrink:0 }}>
                {c.frequency}
              </div>
            </div>
            {isOpen&&atis&&(
              <div className="anim-down" style={{ marginTop:8, padding:"8px 10px",
                background:"var(--bg)", border:"1px solid var(--line)", borderRadius:8,
                fontSize:11, color:"var(--dim)", lineHeight:1.65 }}>
                {atis.text_atis?.join(" ")}
              </div>
            )}
          </div>
        );
      })}

      {!loading&&ctrls.length===0&&(
        <div style={{ color:"var(--dim)", fontSize:12, textAlign:"center", padding:30 }}>
          Nincs online ATC.
        </div>
      )}
    </div>
  );
}


/* ══ CHARTS TAB — csak FlightPlanner + Navigraph ════════════════ */
function ChartsTab({ofp}) {
  const [icao, setIcao] = useState(ofp?.arr||ofp?.dep||"");
  useEffect(()=>{ if(ofp?.arr&&!icao) setIcao(ofp.arr); },[ofp]);

  const PROVIDERS = [
    { id:"lido",      name:"MSFS Flight Planner", desc:"Microsoft Lido chartok — beépített MSFS", url:()=>"https://planner.flightsimulator.com/",  color:"var(--cy)", badge:"MSFS",         external:true },
    { id:"navigraph", name:"Navigraph Charts",    desc:"Jeppesen-stílusú chartok",               url:()=>"https://charts.navigraph.com",          color:"var(--pu)", badge:"Előfizetéses", external:false },
  ];
  const quickIcaos=[ofp?.dep,ofp?.arr,ofp?.altn].filter(Boolean);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      <SL>Charts</SL>

      <div className="card">
        <div style={{ display:"flex", gap:10, alignItems:"flex-end" }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:9, color:"var(--dim)", letterSpacing:1.2, marginBottom:5 }}>AIRPORT ICAO</div>
            <input className="inp" value={icao} onChange={e=>setIcao(e.target.value.toUpperCase())}
              placeholder="pl. LHBP" maxLength={4}
              style={{ fontSize:18, letterSpacing:3, fontVariant:"small-caps", padding:"9px 12px" }}/>
          </div>
        </div>
        {quickIcaos.length>0&&(
          <div style={{ display:"flex", gap:5, marginTop:10 }}>
            {quickIcaos.map((ic,i)=>(
              <button key={ic} onClick={()=>setIcao(ic)}
                className={`btn-pill ${icao===ic?"active":""}`}
                style={{ color:icao===ic?"#070b12":["var(--gn)","var(--cy)","var(--am)"][i] }}>
                {ic} {["DEP","ARR","ALTN"][i]}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
        {PROVIDERS.map((p,i)=>(
          <button key={p.id} className={`tile-chart anim-up`}
            style={{ animationDelay:`${i*40}ms`, border:"none", cursor:"pointer",
              textAlign:"left", width:"100%" }}
            onClick={()=>p.external?py.openExternal(p.url(icao)):py.openInApp(p.url(icao))}>
            <div style={{ display:"flex", alignItems:"flex-start",
              justifyContent:"space-between", marginBottom:10 }}>
              <div style={{ width:34, height:34, borderRadius:9, background:"var(--p2)",
                border:"1px solid var(--line)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <Globe size={15} color={p.color}/>
              </div>
              <span className="badge" style={{
                background:`color-mix(in srgb, ${p.color} 12%, transparent)`,
                border:`1px solid color-mix(in srgb, ${p.color} 28%, transparent)`,
                color:p.color }}>{p.badge}</span>
            </div>
            <div style={{ fontSize:13, fontWeight:600, marginBottom:4 }}>{p.name}</div>
            <div style={{ fontSize:11, color:"var(--dim)", lineHeight:1.5 }}>{p.desc}</div>
            {icao&&<div style={{ marginTop:8, fontSize:11, color:p.color, opacity:.65 }}>{icao}</div>}
          </button>
        ))}
      </div>
    </div>
  );
}


/* ══ ALERTS TAB ══════════════════════════════════════════════════ */
function AlertsTab({triggers,onAdd,onDel,onToggle}) {
  const [kind,setKind]=useState("fix"); const [fix,setFix]=useState(""); const [lead,setLead]=useState("5");
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      <SL>Push Triggers</SL>
      <div className="card">
        <div style={{ display:"flex", gap:5, marginBottom:12 }}>
          {[["fix","Fix"],["tod","T/D"],["dest","Landing"]].map(([k,l])=>(
            <button key={k} onClick={()=>setKind(k)}
              className={`btn-pill ${kind===k?"active":""}`}>{l}</button>
          ))}
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"flex-end" }}>
          {kind==="fix"&&(
            <input className="inp" value={fix} onChange={e=>setFix(e.target.value)}
              placeholder="Fix pl. VETIK" style={{ flex:1 }}/>
          )}
          <input className="inp" value={lead} onChange={e=>setLead(e.target.value)}
            placeholder="min" type="number" style={{ width:72 }}/>
          <button onClick={()=>{ if(kind==="fix"&&!fix.trim())return;
            onAdd({kind,lead:Number(lead)||5,...(kind==="fix"?{fix:fix.toUpperCase()}:{})});}}
            className="btn-primary">
            <Plus size={13}/>Arm
          </button>
        </div>
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
        {triggers.length===0&&(
          <div style={{ color:"var(--dim)", fontSize:12, textAlign:"center", padding:24 }}>
            Nincs trigger.
          </div>
        )}
        {triggers.map((t,i)=>(
          <div key={t.id} className="anim-up" style2=""
            style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
              borderColor:t.fired?"var(--gn)":"var(--line)", animationDelay:`${i*30}ms` }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <button onClick={()=>onToggle(t.id,!t.armed)}
                className="btn-icon"
                style={{ width:28, height:28, borderRadius:8,
                  background:t.armed?"rgba(94,200,255,.1)":"var(--p2)",
                  border:"1px solid var(--line)",
                  color:t.armed?"var(--cy)":"var(--dim)" }}>
                <Bell size={12}/>
              </button>
              <div>
                <div className="mono" style={{ fontSize:13, fontWeight:600 }}>
                  {t.kind==="fix"?t.fix:t.kind.toUpperCase()}
                  <span style={{ color:"var(--dim)", fontWeight:400 }}> − {t.lead} min</span>
                </div>
                <div style={{ fontSize:10, marginTop:1,
                  color:t.armed?(t.fired?"var(--gn)":"var(--cy)"):"var(--dim)" }}>
                  {t.armed?(t.fired?"✓ fired":"armed"):"off"}
                </div>
              </div>
            </div>
            <button onClick={()=>onDel(t.id)} className="btn-icon"
              style={{ color:"var(--rd)" }}>
              <Trash2 size={13}/>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}


/* ══ CONTROL CENTER — database ══════════════════════════════════ */
const CC_DB = [
  {
    id:"fenix_a32x", name:"Fenix A320 Family", patterns:["fenix"],
    color:"var(--cy)",
    sidestick:{ ctrlKey:"tca_sidestick_airbus",
      axes:[
        {name:"Aileron (Roll)",    sens:0,  dz:0, react:100},
        {name:"Elevator (Pitch)", sens:0,  dz:0, react:100},
        {name:"Rudder",           sens:0,  dz:0, react:100},
      ],
      note:"Lineáris (0%) érzékenység, 100% reaktivitás — Fenix FBW veszi át.",
      src:"FenixSim Support Hub"
    },
    throttle:{ ctrlKey:"tca_quadrant_airbus",
      axes:[
        {name:"Throttle 1",  sens:0, dz:2, react:100},
        {name:"Throttle 2",  sens:0, dz:2, react:100},
        {name:"Spoilers",    sens:0, dz:0, react:100},
        {name:"Flaps",       sens:0, dz:0, react:100},
      ],
      note:"2% null zone a throttle tengelyeken TCA Quadrant-hoz.",
      src:"FenixSim Support Hub"
    },
  },
  {
    id:"pmdg_737", name:"PMDG 737", patterns:["pmdg 737","boeing 737","b737"],
    color:"var(--am)",
    yoke:{ ctrlKey:"tca_yoke_boeing",
      axes:[
        {name:"Aileron (Roll)",    sens:-30, dz:5, react:100},
        {name:"Elevator (Pitch)", sens:-30, dz:5, react:100},
        {name:"Rudder",           sens:0,   dz:5, react:100},
      ],
      note:"−30% érzékenység a felfúgatott vezérlőfelületek szimulálásához.",
      src:"PMDG forum + community"
    },
    throttle:{ ctrlKey:"tca_quadrant_boeing",
      axes:[
        {name:"Throttle 1",  sens:0, dz:3, react:100},
        {name:"Throttle 2",  sens:0, dz:3, react:100},
        {name:"Spoilers",    sens:0, dz:0, react:100},
        {name:"Flaps",       sens:0, dz:0, react:100},
      ],
      note:"3% null zone a throttle tengelyeken.",
      src:"Community"
    },
  },
  {
    id:"pmdg_777", name:"PMDG 777", patterns:["pmdg 777","boeing 777","b777"],
    color:"var(--gn)",
    yoke:{ ctrlKey:"tca_yoke_boeing",
      axes:[
        {name:"Aileron (Roll)",    sens:-30, dz:5, react:80},
        {name:"Elevator (Pitch)", sens:-30, dz:5, react:80},
        {name:"Rudder",           sens:0,   dz:5, react:100},
      ],
      note:"−30% érzékenység, 80% reaktivitás a 777 nehéz vezérlő érzet szimulálásához.",
      src:"PMDG forum community"
    },
    throttle:{ ctrlKey:"tca_quadrant_boeing",
      axes:[
        {name:"Throttle 1",  sens:0, dz:3, react:100},
        {name:"Throttle 2",  sens:0, dz:3, react:100},
        {name:"Spoilers",    sens:0, dz:0, react:100},
      ],
      note:"3% null zone.",
      src:"Community"
    },
  },
  {
    id:"pmdg_md11", name:"PMDG MD-11", patterns:["md-11","md11"],
    color:"var(--pu)",
    yoke:{ ctrlKey:"tca_yoke_boeing",
      axes:[
        {name:"Aileron (Roll)",    sens:-20, dz:5, react:90},
        {name:"Elevator (Pitch)", sens:-20, dz:5, react:90},
        {name:"Rudder",           sens:0,   dz:5, react:100},
      ],
      note:"−20% érzékenység, 90% reaktivitás az MD-11 karakterisztikájához.",
      src:"Community"
    },
    throttle:{ ctrlKey:"tca_quadrant_boeing",
      axes:[
        {name:"Throttle 1",       sens:0, dz:3, react:100},
        {name:"Throttle 2",       sens:0, dz:3, react:100},
        {name:"Throttle 3 (Cnt)", sens:0, dz:3, react:100},
        {name:"Spoilers",         sens:0, dz:0, react:100},
      ],
      note:"3 throttle tengely a háromhajtóműves konfigurációhoz.",
      src:"Community"
    },
  },
  {
    id:"fslabs_a321", name:"FSLabs A321 NEO", patterns:["fslabs","fs labs","a321 neo","a321neo"],
    color:"var(--rd)",
    sidestick:{ ctrlKey:"tca_sidestick_airbus",
      axes:[
        {name:"Aileron (Roll)",    sens:0, dz:0, react:100},
        {name:"Elevator (Pitch)", sens:0, dz:0, react:100},
        {name:"Rudder",           sens:0, dz:0, react:100},
      ],
      note:"Lineáris érzékenység — FSLabs FBW logika kezeli a vezérlést.",
      src:"FSLabs community"
    },
    throttle:{ ctrlKey:"tca_quadrant_airbus",
      axes:[
        {name:"Throttle 1",  sens:0, dz:2, react:100},
        {name:"Throttle 2",  sens:0, dz:2, react:100},
        {name:"Spoilers",    sens:0, dz:0, react:100},
        {name:"Flaps",       sens:0, dz:0, react:100},
      ],
      note:"2% null zone a throttle tengelyeken.",
      src:"Community"
    },
  },
];

const CC_CONTROLLERS = {
  tca_sidestick_airbus: { name:"TCA Sidestick Airbus", img:"/controllers/tca-sidestick-airbus.webp",
    patterns:["airbus edition","tca sidestick","tca-sidestick airbus"] },
  tca_quadrant_airbus:  { name:"TCA Quadrant Airbus",  img:"/controllers/tca-quadrant-airbus.webp",
    patterns:["tca quadrant airbus","quadrant airbus","tca-quadrant airbus"] },
  tca_yoke_boeing:      { name:"TCA Yoke Boeing",      img:"/controllers/tca-yoke-boeing.webp",
    patterns:["boeing yoke","tca yoke","yoke boeing"] },
  tca_quadrant_boeing:  { name:"TCA Quadrant Boeing",  img:"/controllers/tca-quadrant-boeing.jpg",
    patterns:["boeing throttle","quadrant boeing","tca quadrant boeing"] },
};

function detectAircraft(title) {
  if (!title) return null;
  const t = title.toLowerCase();
  return CC_DB.find(a => a.patterns.some(p => t.includes(p))) || null;
}

function matchedPresets(aircraft, gamepads) {
  if (!aircraft) return [];
  const results = [];
  // Which preset roles does this aircraft have?
  const roles = [];
  if (aircraft.sidestick) roles.push({ role:"sidestick", preset:aircraft.sidestick, ctrlKey:aircraft.sidestick.ctrlKey });
  if (aircraft.yoke)      roles.push({ role:"yoke",      preset:aircraft.yoke,      ctrlKey:aircraft.yoke.ctrlKey });
  if (aircraft.throttle)  roles.push({ role:"throttle",  preset:aircraft.throttle,  ctrlKey:aircraft.throttle.ctrlKey });

  for (const { role, preset, ctrlKey } of roles) {
    const ctrl = CC_CONTROLLERS[ctrlKey];
    // Check if user has this controller connected
    const gp = gamepads.find(g => {
      const id = g.id.toLowerCase();
      return ctrl.patterns.some(p => id.includes(p));
    });
    results.push({ role, preset, ctrlKey, ctrl, connected: !!gp });
  }
  return results;
}

function AxisRow({ ax }) {
  const sensColor = ax.sens < 0 ? "var(--am)" : ax.sens > 0 ? "var(--cy)" : "var(--dim)";
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 0",
      borderBottom:"1px solid rgba(28,45,66,.5)" }}>
      <div style={{ width:148, fontSize:11, color:"var(--tx)", flexShrink:0 }}>{ax.name}</div>
      <div style={{ flex:1, display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6 }}>
        {[
          ["Sensitivity", `${ax.sens >= 0 ? "+" : ""}${ax.sens}%`, sensColor],
          ["Deadzone",    `${ax.dz}%`,   "var(--gn)"],
          ["Reactivity",  `${ax.react}%`, "var(--pu)"],
        ].map(([lbl, val, col]) => (
          <div key={lbl} style={{ background:"var(--p2)", borderRadius:7,
            padding:"4px 8px", border:"1px solid var(--line)" }}>
            <div style={{ fontSize:9, color:"var(--dim)", letterSpacing:.8 }}>{lbl.toUpperCase()}</div>
            <div className="mono" style={{ fontSize:13, fontWeight:600, color:col, marginTop:1 }}>{val}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══ CONTROLLERS TAB (Control Center) ═══════════════════════════ */
function ControllersTab({ gamepads, axisMap, onSave, live }) {
  const [ccTab,     setCcTab]     = useState("official");
  const [applying,  setApplying]  = useState(null); // ctrlKey being applied
  const [applyMsg,  setApplyMsg]  = useState(null);
  const [customSel, setCustomSel] = useState(null);

  const aircraft = detectAircraft(live?.aircraftTitle);
  const presets  = matchedPresets(aircraft, gamepads);

  const handleApply = async (ctrlKey, preset) => {
    setApplying(ctrlKey);
    setApplyMsg(null);
    try {
      const r = await fetch("/api/control-center/apply", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          aircraft: aircraft?.name || "",
          controller: CC_CONTROLLERS[ctrlKey]?.name || ctrlKey,
          axes: preset.axes,
        }),
      });
      const d = await r.json();
      setApplyMsg(d.ok
        ? { type:"ok",  text:`✓ Profil mentve: ${d.path}` }
        : { type:"err", text: d.error || "Hiba" });
    } catch(e) { setApplyMsg({ type:"err", text: e.message }); }
    setApplying(null);
  };

  const AXIS_LABELS = ["Roll","Pitch","Throttle L","Throttle R","Rudder","Tiller","Flaps","Brakes","View H","View V"];

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <SL>Control Center</SL>
          {live?.aircraftTitle
            ? <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:3 }}>
                <div style={{ width:6, height:6, borderRadius:"50%",
                  background: aircraft ? "var(--gn)" : "var(--am)" }}/>
                <span style={{ fontSize:11, color: aircraft ? "var(--gn)" : "var(--am)" }}>
                  {aircraft ? aircraft.name : "Ismeretlen repülő"}
                </span>
                <span style={{ fontSize:10, color:"var(--dim)" }}>— {live.aircraftTitle}</span>
              </div>
            : <div style={{ fontSize:11, color:"var(--dim)", marginTop:3 }}>Várakozás a bridge adataira...</div>
          }
        </div>
        <div style={{ display:"flex", gap:6 }}>
          {[["official","Official"],["custom","Custom"]].map(([v,l]) => (
            <button key={v} onClick={() => setCcTab(v)}
              style={{ padding:"5px 14px", borderRadius:99, fontSize:11, fontWeight:600,
                cursor:"pointer", transition:"all .15s", border:"1px solid",
                background: ccTab===v ? "var(--cy)" : "transparent",
                color:       ccTab===v ? "#070b12"   : "var(--dim)",
                borderColor: ccTab===v ? "var(--cy)"  : "var(--line)" }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* ── Official tab ── */}
      {ccTab === "official" && (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {!aircraft && (
            <div className="card" style={{ textAlign:"center", padding:"36px 20px", color:"var(--dim)" }}>
              <Gamepad2 size={28} color="var(--line)" style={{ marginBottom:10 }}/>
              <div style={{ fontSize:13 }}>
                {live?.aircraftTitle
                  ? `Nincs preset ehhez: "${live.aircraftTitle}"`
                  : "Indítsd el a bridge-et és szállj be egy repülőbe."}
              </div>
              <div style={{ fontSize:11, marginTop:6 }}>
                Támogatott: Fenix A320 · PMDG 737 · PMDG 777 · PMDG MD-11 · FSLabs A321
              </div>
            </div>
          )}

          {presets.map(({ role, preset, ctrlKey, ctrl, connected }) => (
            <div key={ctrlKey} className="card anim-up" style={{ padding:0, overflow:"hidden" }}>
              {/* Card header */}
              <div style={{ display:"flex", alignItems:"center", gap:12, padding:"11px 16px",
                background:"var(--p2)", borderBottom:"1px solid var(--line)" }}>
                {ctrl.img && (
                  <img src={ctrl.img} alt={ctrl.name}
                    style={{ width:46, height:46, objectFit:"contain", borderRadius:8,
                      background:"#fff", padding:3, flexShrink:0 }}/>
                )}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:600, fontSize:13, display:"flex", alignItems:"center", gap:7 }}>
                    {ctrl.name}
                    <span style={{ fontSize:9, padding:"2px 7px", borderRadius:99,
                      background: connected ? "rgba(82,227,176,.1)" : "rgba(255,180,84,.08)",
                      border:`1px solid ${connected ? "rgba(82,227,176,.2)" : "rgba(255,180,84,.2)"}`,
                      color: connected ? "var(--gn)" : "var(--am)" }}>
                      {connected ? "Csatlakozva" : "Nincs csatlakoztatva"}
                    </span>
                  </div>
                  <div style={{ fontSize:10, color:"var(--dim)", marginTop:2 }}>
                    {aircraft?.name} · {preset.src}
                  </div>
                </div>
                <button onClick={() => handleApply(ctrlKey, preset)}
                  disabled={!!applying}
                  style={{ display:"flex", alignItems:"center", gap:5, padding:"7px 14px",
                    borderRadius:8, border:"1px solid var(--cy)", background:"rgba(94,200,255,.08)",
                    color:"var(--cy)", fontSize:12, fontWeight:600, cursor:applying?"default":"pointer",
                    opacity: applying ? .5 : 1, transition:"all .15s" }}>
                  {applying === ctrlKey
                    ? <Loader2 size={12} className="spin"/>
                    : <Check size={12}/>}
                  Apply
                </button>
              </div>
              {/* Axes */}
              <div style={{ padding:"4px 16px 12px" }}>
                {preset.axes.map((ax, i) => <AxisRow key={i} ax={ax}/>)}
                {preset.note && (
                  <div style={{ fontSize:10, color:"var(--dim)", marginTop:8,
                    padding:"6px 10px", background:"var(--bg)", borderRadius:7,
                    border:"1px solid var(--line)", lineHeight:1.6 }}>
                    💡 {preset.note}
                  </div>
                )}
              </div>
            </div>
          ))}

          {applyMsg && (
            <div style={{ padding:"8px 12px", borderRadius:9, fontSize:12,
              background: applyMsg.type==="ok" ? "rgba(82,227,176,.07)" : "rgba(240,96,128,.07)",
              border:`1px solid ${applyMsg.type==="ok" ? "rgba(82,227,176,.2)" : "rgba(240,96,128,.2)"}`,
              color: applyMsg.type==="ok" ? "var(--gn)" : "var(--rd)" }}>
              {applyMsg.text}
            </div>
          )}
        </div>
      )}

      {/* ── Custom tab ── */}
      {ccTab === "custom" && (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {/* Controller selector */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(2, 1fr)", gap:8 }}>
            {Object.entries(CC_CONTROLLERS).map(([key, ctrl]) => (
              <button key={key} onClick={() => setCustomSel(customSel===key ? null : key)}
                style={{ padding:10, borderRadius:12, border:"1px solid",
                  borderColor: customSel===key ? "var(--cy)" : "var(--line)",
                  background:  customSel===key ? "rgba(94,200,255,.06)" : "var(--p1)",
                  cursor:"pointer", textAlign:"center", transition:"all .15s" }}>
                <img src={ctrl.img} alt={ctrl.name}
                  style={{ width:"100%", height:66, objectFit:"contain", marginBottom:6 }}/>
                <div style={{ fontSize:10, fontWeight:600, color:"var(--tx)" }}>{ctrl.name}</div>
              </button>
            ))}
          </div>

          {customSel && (
            <div className="card" style={{ textAlign:"center", padding:"28px 20px", color:"var(--dim)" }}>
              <div style={{ fontSize:13, marginBottom:6 }}>🚧 Interaktív gomb konfiguráció</div>
              <div style={{ fontSize:11 }}>Hamarosan — fázis 3</div>
            </div>
          )}

          {/* Axis mapping (existing) */}
          {gamepads.length === 0 && (
            <div style={{ paddingTop:20, display:"flex", flexDirection:"column",
              alignItems:"center", gap:10, color:"var(--dim)" }}>
              <Gamepad2 size={28} color="#1e3a5f"/>
              <div style={{ fontSize:13 }}>Nem található gamepad / HOTAS.</div>
            </div>
          )}
          {gamepads.map((gp, gi) => (
            <div key={gp.id} className="card anim-up"
              style={{ padding:0, overflow:"hidden", animationDelay:`${gi*60}ms` }}>
              <div style={{ display:"flex", alignItems:"center", gap:10,
                padding:"12px 16px", background:"var(--p2)", borderBottom:"1px solid var(--line)" }}>
                <Gamepad2 size={16} color="var(--cy)"/>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:600, fontSize:13 }}>Controller {gi+1}</div>
                  <div style={{ fontSize:10, color:"var(--dim)", overflow:"hidden",
                    textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{gp.id}</div>
                </div>
                <span className="badge" style={{ background:"rgba(82,227,176,.1)",
                  border:"1px solid rgba(82,227,176,.2)", color:"var(--gn)" }}>Csatlakozva</span>
              </div>
              {gp.axes.map(ax => {
                const key = `${gp.id}:${ax.index}`, cur = axisMap[key] || "";
                const pct = Math.round((ax.value + 1) / 2 * 100);
                return (
                  <div key={ax.index} style={{ display:"flex", alignItems:"center", gap:10,
                    padding:"8px 16px", borderBottom:"1px solid rgba(28,45,66,.5)" }}>
                    <div className="mono" style={{ width:20, fontSize:10, color:"var(--dim)", flexShrink:0 }}>
                      A{ax.index}
                    </div>
                    <div style={{ width:80, height:4, background:"var(--p2)",
                      borderRadius:99, overflow:"hidden", flexShrink:0 }}>
                      <div style={{ width:`${pct}%`, height:"100%",
                        background:"linear-gradient(90deg, var(--cy), var(--pu))",
                        transition:"width .08s ease", borderRadius:99 }}/>
                    </div>
                    <div className="mono" style={{ width:36, fontSize:10, color:"var(--cy)", flexShrink:0 }}>
                      {ax.value.toFixed(2)}
                    </div>
                    <select value={cur} onChange={e => onSave(gp.id, ax.index, e.target.value)}
                      style={{ flex:1, background:"var(--p2)", border:"1px solid var(--line)",
                        color:cur?"var(--tx)":"var(--dim)", fontSize:11, borderRadius:7, padding:"4px 8px" }}>
                      <option value="">— nincs —</option>
                      {AXIS_LABELS.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                    {cur && <span style={{ display:"flex", alignItems:"center", gap:3,
                        fontSize:10, color:"var(--cy)", flexShrink:0 }}>
                      <Check size={10}/>{cur}
                    </span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


/* ══ SETTINGS TAB ════════════════════════════════════════════════ */
const SettingsTab = React.memo(function SettingsTab({settings, save, onLoadOFP}) {
  const [ver,     setVer]     = useState(null);
  const [devOpen, setDevOpen] = useState(false);
  const [editCn,  setEditCn]  = useState("");
  const [editCh,  setEditCh]  = useState("release");

  useEffect(() => {
    py.getVersion().then(v => {
      if (v) { setVer(v); setEditCn(v.codename||""); setEditCh(v.channel||"release"); }
    });
  }, []);

  const S = {
    row: {
      display:"flex", alignItems:"center", justifyContent:"space-between",
      padding:"12px 16px", background:"#0c1520", border:"1px solid #1c2d42",
      borderRadius:12, gap:12,
    },
    label: { fontSize:13, color:"#d8e6f3", fontWeight:500 },
    desc:  { fontSize:10, color:"#5a7a96", marginTop:3 },
    inp: {
      background:"#111c2b", border:"1px solid #1c2d42", color:"#d8e6f3",
      fontSize:13, borderRadius:8, padding:"7px 11px",
    },
    pill: (active) => ({
      borderRadius:99, padding:"5px 14px", fontSize:12, fontWeight:600,
      cursor:"pointer", border:"1px solid",
      background: active ? "#5ec8ff" : "#0d1825",
      color:       active ? "#070b12" : "#5a7a96",
      borderColor: active ? "#5ec8ff" : "#1c2d42",
    }),
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
      <div style={{ fontSize:10, fontWeight:700, letterSpacing:1.5,
        textTransform:"uppercase", color:"#5a7a96", marginBottom:4 }}>Settings</div>

      {/* Téma — color swatches */}
      <div style={S.row}>
        <div style={S.label}>Téma</div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          {[
            ["dark",    "#070b12","#5ec8ff"],
            ["midnight","#000008","#5ec8ff"],
            ["navy",    "#0a0e1a","#4db8ff"],
            ["green",   "#050f0a","#33e899"],
            ["amber",   "#0f0b04","#ffaa22"],
            ["light",   "#f0f4f8","#0a8fd4"],
          ].map(([v,bg,ac])=>{
            const active = (settings.theme||"dark")===v;
            return (
              <button key={v} onClick={()=>save("theme",v)}
                title={v}
                style={{
                  width:28, height:28, borderRadius:"50%",
                  background:`linear-gradient(135deg, ${bg} 50%, ${ac} 50%)`,
                  border: active ? `3px solid ${ac}` : "2px solid #1c2d42",
                  cursor:"pointer",
                  boxShadow: active ? `0 0 8px ${ac}88` : "none",
                  padding:0, flexShrink:0,
                }}/>
            );
          })}
        </div>
      </div>

      {/* SimBrief */}
      <div style={S.row}>
        <div>
          <div style={S.label}>SimBrief usernév</div>
          <div style={S.desc}>Automatikusan betölti az OFP-t induláskor</div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <input style={{...S.inp, width:180}}
            value={settings.sbUser}
            onChange={e=>save("sbUser",e.target.value)}
            placeholder="pl. ddnemet"/>
          <button style={{ background:"#5ec8ff", color:"#070b12", border:"none",
            borderRadius:8, padding:"7px 16px", fontSize:13, fontWeight:700, cursor:"pointer" }}
            onClick={onLoadOFP}>Betölt</button>
        </div>
      </div>

      {/* Fenix */}
      <div style={S.row}>
        <div>
          <div style={S.label}>Fenix EFB cím</div>
          <div style={S.desc}>Csak ha fut a Fenix EFB a szimulátorban</div>
        </div>
        <input style={{...S.inp, width:230}}
          value={settings.fenixUrl}
          onChange={e=>save("fenixUrl",e.target.value)}
          placeholder="http://192.168.1.x:8080"/>
      </div>

      {/* Session */}
      <div style={S.row}>
        <div>
          <div style={S.label}>Session kód</div>
          <div style={S.desc}>Firebase sync azonosító</div>
        </div>
        <input style={{...S.inp, width:170}}
          value={settings.sessionCode}
          onChange={e=>save("sessionCode",e.target.value)}
          placeholder="ddnemet-host"/>
      </div>

      {/* Linkek */}
      <div style={S.row}>
        <div style={S.label}>Linkek megnyitása</div>
        <div style={{ display:"flex", gap:6 }}>
          {[["Böngészőben",false],["App-ban",true]].map(([l,v])=>(
            <button key={String(v)} style={S.pill(settings.openLinksInApp===v)}
              onClick={()=>save("openLinksInApp",v)}>{l}</button>
          ))}
        </div>
      </div>

      {/* OFP mód */}
      <div style={S.row}>
        <div style={S.label}>OFP megjelenítés</div>
        <div style={{ display:"flex", gap:6 }}>
          {[["simplified","Simplified"],["realistic","Realistic"]].map(([v,l])=>(
            <button key={v} style={S.pill(settings.ofpMode===v)}
              onClick={()=>save("ofpMode",v)}>{l}</button>
          ))}
        </div>
      </div>

      {/* Verzió */}
      <div style={S.row}>
        <div style={S.label}>Verzió</div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontVariantNumeric:"tabular-nums", fontSize:12, color:"#5a7a96" }}>
            {ver ? `${ver.codename} · ${ver.version}` : "betöltés..."}
          </span>
          {ver?.channel==="dev" && (
            <span style={{ borderRadius:99, padding:"2px 8px", fontSize:10, fontWeight:700,
              background:"rgba(255,180,84,.12)", border:"1px solid rgba(255,180,84,.25)",
              color:"#ffb454" }}>DEV</span>
          )}
          <button style={{ background:"#111c2b", color:"#5a7a96", border:"1px solid #1c2d42",
            borderRadius:8, padding:"4px 10px", fontSize:11, cursor:"pointer" }}
            onClick={()=>setDevOpen(!devOpen)}>
            {devOpen ? "▲ Dev" : "⚙ Dev"}
          </button>
        </div>
      </div>

      {/* Dev options */}
      {devOpen && (
        <div style={{ background:"#0c1520", border:"1px solid #1c2d42",
          borderRadius:12, padding:14, display:"flex", flexDirection:"column", gap:10 }}>
          <div style={{ fontSize:12, fontWeight:600, color:"#ffb454" }}>⚙ Developer Options</div>
          <div style={{ display:"flex", gap:8, alignItems:"flex-end" }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:9, color:"#5a7a96", letterSpacing:1, marginBottom:4 }}>CODENAME</div>
              <input style={{...S.inp, width:"100%"}}
                value={editCn} onChange={e=>setEditCn(e.target.value)}
                placeholder="pl. Tahoe"/>
            </div>
            <div>
              <div style={{ fontSize:9, color:"#5a7a96", letterSpacing:1, marginBottom:4 }}>CHANNEL</div>
              <div style={{ display:"flex", gap:6 }}>
                {["release","dev"].map(ch=>(
                  <button key={ch} style={S.pill(editCh===ch)}
                    onClick={()=>setEditCh(ch)}>{ch}</button>
                ))}
              </div>
            </div>
            <button style={{ background:"#5ec8ff", color:"#070b12", border:"none",
              borderRadius:8, padding:"7px 16px", fontSize:12, fontWeight:700,
              cursor:"pointer", alignSelf:"flex-end" }}
              onClick={async()=>{
                await py.saveVersionSettings(editCn, editCh);
                const v = await py.getVersion();
                if (v) setVer(v);
              }}>Mentés</button>
          </div>
          <div style={{ fontSize:11, color:"#5a7a96", lineHeight:1.6 }}>
            A codename az auto-updater alapja. DEV csatornán megnyílik a dev console.
          </div>
        </div>
      )}
    </div>
  );
});
