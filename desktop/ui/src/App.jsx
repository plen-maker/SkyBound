import React, { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
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
  Check, LogOut, Radio, Eye, EyeOff, RefreshCw, Layers, StickyNote,
  BookOpen, Book, Activity, Server, TrendingDown, PackageOpen,
  Search, FolderOpen, X, ToggleLeft, ToggleRight, ChevronDown,
  GitMerge, Download, RotateCcw,
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
  openExternal: async url => {
    try {
      const { open } = await import("@tauri-apps/plugin-shell");
      return open(url);
    } catch { window.open(url, "_blank"); }
  },
  openInApp: async url => {
    window.dispatchEvent(new CustomEvent("sb:openInApp", { detail: url }));
  },
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

/* CSS is in global.css — no inline style injection needed */

/* (CSS moved to global.css) */


/* ══ TABS CONFIG ═════════════════════════════════════════════════ */
const TABS = [
  { id:"home",        label:"Home",    icon:Plane,        color:"#5ec8ff" },
  { id:"map",         label:"Map",     icon:MapIcon,      color:"#52e3b0" },
  { id:"ground",      label:"Ground",  icon:Layers,       color:"#52e3b0" },
  { id:"ofp",         label:"OFP",     icon:FileText,     color:"#ffb454" },
  { id:"vatsim",      label:"VATSIM",  icon:Radio,        color:"#52e3b0" },
  { id:"charts",      label:"Charts",  icon:MapIcon,      color:"#a78bfa" },
  null,
  { id:"alerts",      label:"Alerts",  icon:Bell,         color:"#f06080" },
  { id:"notes",       label:"Notes",   icon:StickyNote,   color:"#ffb454" },
  { id:"controllers", label:"Ctrl",    icon:Gamepad2,     color:"#a78bfa" },
  { id:"bridge",      label:"Bridge",  icon:Server,       color:"#52e3b0" },
  null,
  { id:"landing",     label:"Land",    icon:TrendingDown, color:"#5ec8ff" },
  { id:"logbook",     label:"Log",     icon:Book,         color:"#ffb454" },
  { id:"dict",        label:"Dict",    icon:BookOpen,     color:"#a78bfa" },
  { id:"mods",        label:"Mods",    icon:PackageOpen,  color:"#ff9d4d" },
  null,
  { id:"settings",    label:"Setup",   icon:Cog,          color:"#5a7a96" },
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

/* ══ IN-APP BROWSER ═══════════════════════════════════════════════ */
function InAppBrowser({ url, onClose }) {
  const [current, setCurrent] = useState(url);
  const [input,   setInput]   = useState(url);
  const iframeRef = useRef(null);

  const go = (u) => { const safe = u.startsWith("http")?u:`https://${u}`; setCurrent(safe); setInput(safe); };

  return (
    <div style={{
      position:"fixed", inset:0, zIndex:9999,
      background:"rgba(7,11,18,.92)", backdropFilter:"blur(12px)",
      display:"flex", flexDirection:"column",
    }} className="anim-in">
      {/* Toolbar */}
      <div style={{
        height:48, display:"flex", alignItems:"center", gap:8, padding:"0 12px",
        background:"var(--panel)", borderBottom:"1px solid var(--line)", flexShrink:0,
      }}>
        <button className="btn-icon" onClick={()=>go(current)} title="Újratölt">
          <RefreshCw size={14}/>
        </button>
        <input
          value={input}
          onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&go(input)}
          style={{
            flex:1, background:"var(--p2)", border:"1px solid var(--line)",
            color:"var(--tx)", fontSize:12, borderRadius:8, padding:"6px 10px",
          }}/>
        <button className="btn-ghost" onClick={()=>{ py.openExternal(current); }}
          style={{ flexShrink:0, fontSize:11 }} title="Megnyitás böngészőben">
          <ExternalLink size={12}/>Böngésző
        </button>
        <button className="btn-icon" onClick={onClose} title="Bezárás">
          <X size={16}/>
        </button>
      </div>
      {/* WebView */}
      <iframe
        ref={iframeRef}
        src={current}
        style={{ flex:1, border:"none", background:"#fff" }}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
        title="In-app browser"
      />
    </div>
  );
}

/* ══ APP SHELL ════════════════════════════════════════════════════ */
function AppShell({ user }) {
  const [tab, setTab]           = useState("home");
  const [prevTab, setPrevTab]   = useState(null);
  const [settings, setSettings] = useState(() => ({
    sbUser:"", fenixUrl:"", sessionCode:"",
    openLinksInApp:false, ofpMode:"simplified", theme:"dark",
    ...ls.get("sb_settings",{}),
    // Always override sbUser default if not set
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
      const r = await invoke("fetch_ofp", { username: un });
      if (!r) { setOfpState("error"); setOfpErr("Nincs válasz a szervertől."); }
      else if (r?.error) { setOfpState("error"); setOfpErr(String(r.error)); }
      else if (r?.ofp) { setOfp(r.ofp); setOfpState("idle"); save("sbUser", un); }
      else { setOfpState("error"); setOfpErr("Ismeretlen hiba."); }
    } catch(e) { setOfpState("error"); setOfpErr(String(e)); }
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

  /* In-app browser */
  const [inAppUrl, setInAppUrl] = useState(null);
  useEffect(()=>{
    const h = e => setInAppUrl(e.detail);
    window.addEventListener("sb:openInApp", h);
    return () => window.removeEventListener("sb:openInApp", h);
  },[]);

  const shortcuts = SHORTCUTS.map(s=>({
    ...s,
    resolvedUrl:s.urlKey?settings[s.urlKey]:s.url,
    disabled:s.urlKey?!settings[s.urlKey]:false,
  }));
  const inApp = settings.openLinksInApp;

  return (
    <div style={{ height:"100vh", display:"flex", flexDirection:"column",
      background:"var(--bg)", overflow:"hidden" }}>

      {/* ── In-app browser overlay ── */}
      {inAppUrl && <InAppBrowser url={inAppUrl} onClose={()=>setInAppUrl(null)}/>}

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
        <div style={{ width:80, borderRight:"1px solid #1c2d42",
          background:"#09111e",
          display:"flex", flexDirection:"column", padding:"8px 6px",
          gap:1, flexShrink:0, overflowY:"auto" }}>
          {TABS.map((t,i) => {
            if (t === null) return <div key={`sep-${i}`} className="nav-sep"/>;
            const I = t.icon;
            const isActive = tab === t.id;
            return (
              <button key={t.id} onPointerDown={(e)=>{ e.preventDefault(); changeTab(t.id); }}
                className={`nav-item anim-right ${isActive?"active":""}`}
                style={{
                  animationDelay:`${i*14}ms`, width:"100%", cursor:"pointer",
                  ...(isActive ? {
                    background: `${t.color}18`,
                    color: t.color,
                    boxShadow: `inset 3px 0 0 ${t.color}`,
                  } : {}),
                }}>
                <I size={18}/>
                <span style={{ fontSize:10, letterSpacing:.2, fontWeight:600 }}>{t.label}</span>
              </button>
            );
          })}
          <div style={{ flex:1 }}/>
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
          {tab==="notes"       && <NotesTab/>}
          {tab==="controllers" && <ControllersTab gamepads={gamepads} axisMap={axisMap} onSave={saveAxis} live={live}/>}
          {tab==="bridge"      && <BridgeTab live={live} sessionCode={settings.sessionCode}/>}
          {tab==="landing"     && <LandingTab sessionCode={settings.sessionCode}/>}
          {tab==="logbook"     && <LogbookTab/>}
          {tab==="dict"        && <DictTab/>}
          {tab==="mods"        && <ModsTab/>}
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
const GROUND_LAYERS = [
  { id:"hybrid",    label:"Hybrid",    emoji:"🛰" },
  { id:"chart",     label:"Chart",     emoji:"🗺" },
  { id:"satellite", label:"Satellite", emoji:"📡" },
];

async function icaoToLatLon(icao) {
  try {
    const r = await fetch(
      `https://aviationweather.gov/api/data/airport?ids=${encodeURIComponent(icao.toUpperCase())}&format=json`
    );
    const d = await r.json();
    if (d?.[0]?.latitude) return { lat: d[0].latitude, lon: d[0].longitude, name: d[0].site };
  } catch {}
  // fallback: Nominatim
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(icao)}+airport&format=json&limit=1`,
      { headers: { "Accept-Language": "en" } }
    );
    const d = await r.json();
    if (d?.[0]) return { lat: parseFloat(d[0].lat), lon: parseFloat(d[0].lon), name: d[0].display_name };
  } catch {}
  return null;
}

function GroundTab({ live, ofp }) {
  const mapRef         = React.useRef(null);
  const leafRef        = React.useRef(null);
  const planeRef       = React.useRef(null);
  const layerRefs      = React.useRef({});
  const chartLayersRef = React.useRef([]);
  const chartCacheRef  = React.useRef({ lat: null, lon: null, ways: null, nodes: null });
  const [following,     setFollowing]     = React.useState(true);
  const [mapLayer,      setMapLayer]      = React.useState("hybrid");
  const [icaoInput,     setIcaoInput]     = React.useState("");
  const [icaoSearching, setIcaoSearching] = React.useState(false);
  const [icaoErr,       setIcaoErr]       = React.useState("");
  const [chartLoading,  setChartLoading]  = React.useState(false);

  const clearChartLayers = () => {
    const map = leafRef.current;
    chartLayersRef.current.forEach(l => { try { map?.removeLayer(l); } catch {} });
    chartLayersRef.current = [];
  };

  const drawChartLayers = React.useCallback((ways, nodes) => {
    const map = leafRef.current;
    const L   = window.L;
    if (!map || !L) return;
    clearChartLayers();

    // Draw order: apron/terminal → runway → taxilane → taxiway → badges last
    const ORDER = { apron:0, terminal:0, gate:0, runway:1, taxilane:2, taxiway:3 };
    const sorted = [...ways].sort((a,b) => (ORDER[a.tags?.aeroway]??4) - (ORDER[b.tags?.aeroway]??4));

    const badges = [];
    sorted.forEach(way => {
      const coords = (way.nodes||[]).map(id=>nodes[id]).filter(Boolean);
      if (coords.length < 2) return;
      const type = way.tags?.aeroway;
      const label = (way.tags?.ref || way.tags?.name || "").trim();
      const closed = coords.length > 3
        && coords[0][0]===coords[coords.length-1][0]
        && coords[0][1]===coords[coords.length-1][1];

      let layer;
      if (type === "runway") {
        layer = L.polyline(coords, { color:"#3a4858", weight:26, opacity:1, lineCap:"square" });
      } else if (type === "apron" || type === "terminal" || type === "gate") {
        layer = closed
          ? L.polygon(coords, { color:"#2a3848", fillColor:"#2a3848", fillOpacity:0.9, weight:0 })
          : L.polyline(coords, { color:"#2a3848", weight:10, opacity:0.8 });
      } else if (type === "taxilane") {
        layer = L.polyline(coords, { color:"#4a5e6e", weight:3, opacity:0.9, lineCap:"round" });
      } else { // taxiway
        layer = L.polyline(coords, { color:"#5a6e80", weight:7, opacity:1, lineCap:"round" });
      }
      layer.addTo(map);
      chartLayersRef.current.push(layer);

      if ((type==="taxiway"||type==="taxilane") && label) {
        const mid = coords[Math.floor(coords.length/2)];
        badges.push({ mid, label });
      }
    });

    // Badges on top of everything
    badges.forEach(({ mid, label }) => {
      const w = Math.max(label.length * 7 + 10, 20);
      const badge = L.marker(mid, {
        icon: L.divIcon({
          html: `<div style="background:#f5c518;color:#000;border-radius:3px;padding:2px 5px;font-size:11px;font-weight:900;font-family:'Consolas','Courier New',monospace;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.8);border:1.5px solid #c09000;letter-spacing:.5px;line-height:15px;">${label}</div>`,
          iconSize: [w, 19],
          iconAnchor: [w/2, 9],
          className: "",
        }),
        zIndexOffset: 1000,
      });
      badge.addTo(map);
      chartLayersRef.current.push(badge);
    });
  }, []);

  const loadAirportChart = React.useCallback(async (lat, lon) => {
    const map = leafRef.current;
    const L   = window.L;
    if (!map || !L) return;

    // Return cache if same airport (within ~1.1 km)
    const cache = chartCacheRef.current;
    if (cache.ways && cache.lat !== null
      && Math.abs(lat - cache.lat) < 0.01
      && Math.abs(lon - cache.lon) < 0.01) {
      drawChartLayers(cache.ways, cache.nodes);
      return;
    }

    setChartLoading(true);
    const d = 0.05;
    const bbox = `${lat-d},${lon-d},${lat+d},${lon+d}`;
    const q = `[out:json][timeout:30];(way["aeroway"~"runway|taxiway|taxilane|apron|terminal|gate"](${bbox}););out body;>;out skel qt;`;
    try {
      const r = await fetch("https://overpass-api.de/api/interpreter", { method:"POST", body:q });
      const data = await r.json();
      const nodes = {};
      data.elements.forEach(el => { if (el.type==="node") nodes[el.id]=[el.lat,el.lon]; });
      const ways = data.elements.filter(el => el.type==="way");
      chartCacheRef.current = { lat, lon, ways, nodes };
      drawChartLayers(ways, nodes);
    } catch(e) { console.warn("Airport chart:", e); }
    setChartLoading(false);
  }, [drawChartLayers]);

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
    const init = () => {
      if (!mapRef.current || leafRef.current) return;
      const L = window.L;
      const center = live ? [live.lat, live.lon] : [47.4338, 19.2613];
      const map = L.map(mapRef.current, { zoomControl: true, attributionControl: false }).setView(center, 17);
      leafRef.current = map;

      // Layer definitions
      layerRefs.current.satellite = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 20 }
      );
      // ArcGIS Transportation labels — clean roads + airport taxiways on satellite
      layerRefs.current.satLabels = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 20, opacity: 1 }
      );
      layerRefs.current.satPlaces = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 20, opacity: 1 }
      );
      // OSM standard (inverted via CSS to dark) — shows taxiway letters at zoom 18+
      layerRefs.current.osmChart = L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        { maxZoom: 20, className: "osm-invert" }
      );

      // Initial layer: hybrid (satellite + ArcGIS labels)
      layerRefs.current.satellite.addTo(map);
      layerRefs.current.satLabels.addTo(map);
      layerRefs.current.satPlaces.addTo(map);

      if (live) {
        planeRef.current = L.marker([live.lat, live.lon], {
          icon: makePlaneIcon(L, live.headingDeg || 0),
          zIndexOffset: 1000,
        }).addTo(map);
      }

      // Stop following when user drags
      map.on("mousedown touchstart", () => setFollowing(false));
    };

    if (window.L) { init(); }
    else { window.addEventListener("load", init, { once: true }); }
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

  const gotoIcao = React.useCallback(async (icao) => {
    const code = (icao || icaoInput).trim().toUpperCase();
    if (!code) return;
    setIcaoSearching(true); setIcaoErr("");
    const result = await icaoToLatLon(code);
    setIcaoSearching(false);
    if (!result) { setIcaoErr(`Nem találtam: ${code}`); return; }
    if (leafRef.current) {
      leafRef.current.setView([result.lat, result.lon], mapLayer === "chart" ? 17 : 17);
      setFollowing(false);
    }
    setIcaoInput(code);
    if (mapLayer === "chart") loadAirportChart(result.lat, result.lon);
  }, [icaoInput, mapLayer, loadAirportChart]);

  const switchLayer = React.useCallback((id) => {
    setMapLayer(id);
    const map = leafRef.current;
    const lr = layerRefs.current;
    if (!map || !lr.satellite) return;
    [lr.satellite, lr.satLabels, lr.satPlaces, lr.osmChart].forEach(l => { if (l && map.hasLayer(l)) map.removeLayer(l); });
    if (id === "satellite") {
      clearChartLayers();
      lr.satellite.addTo(map);
    } else if (id === "chart") {
      lr.osmChart.addTo(map);
      if (map.getZoom() < 17) map.setZoom(17);
      // render airport chart overlay from current map center
      const c = map.getCenter();
      loadAirportChart(c.lat, c.lng);
    } else { // hybrid
      clearChartLayers();
      lr.satellite.addTo(map);
      lr.satLabels.addTo(map);
      lr.satPlaces.addTo(map);
    }
  }, [loadAirportChart]);

  const recenter = () => {
    setFollowing(true);
    if (live && leafRef.current) leafRef.current.setView([live.lat, live.lon], 17);
  };

  return (
    <div style={{ position:"relative", borderRadius:14, overflow:"hidden",
      border:"1px solid var(--line)", height:"calc(100vh - 110px)" }}>
      <div ref={mapRef} style={{ width:"100%", height:"100%" }}/>
      {/* Chart loading indicator */}
      {chartLoading && (
        <div style={{ position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)",
          zIndex:1001, background:"rgba(7,11,18,.88)", border:"1px solid var(--line)",
          borderRadius:10, padding:"10px 18px", fontSize:13, color:"var(--cy)",
          display:"flex", alignItems:"center", gap:8, backdropFilter:"blur(10px)" }}>
          <Loader2 size={15} className="spin"/>Repülőtér térkép betöltése…
        </div>
      )}

      {/* Top toolbar: ICAO search + layer toggle */}
      <div style={{ position:"absolute", top:12, left:12, right:12, zIndex:1000,
        display:"flex", gap:8, alignItems:"center" }}>

        {/* ICAO search */}
        <div style={{ display:"flex", gap:4, alignItems:"center",
          background:"rgba(7,11,18,.92)", borderRadius:10, padding:"4px 4px",
          border:"1px solid rgba(94,200,255,.25)", backdropFilter:"blur(12px)", flex:"0 0 auto",
          boxShadow:"0 4px 16px rgba(0,0,0,.5)" }}>
          <input
            value={icaoInput}
            onChange={e => { setIcaoInput(e.target.value.toUpperCase()); setIcaoErr(""); }}
            onKeyDown={e => e.key==="Enter" && gotoIcao()}
            placeholder="ICAO…"
            maxLength={4}
            style={{ width:76, background:"transparent", border:"none", outline:"none",
              color:"var(--tx)", fontSize:14, fontFamily:"monospace", fontWeight:700,
              letterSpacing:1.5, padding:"4px 8px", caretColor:"var(--cy)" }}
          />
          {icaoSearching
            ? <Loader2 size={15} color="var(--cy)" className="spin" style={{ margin:"4px 8px" }}/>
            : <button onClick={() => gotoIcao()}
                style={{ background:"rgba(94,200,255,.18)", border:"1px solid rgba(94,200,255,.3)",
                  borderRadius:7, color:"var(--cy)", cursor:"pointer",
                  padding:"4px 10px", fontSize:13, fontWeight:700 }}>
                Go
              </button>
          }
        </div>

        {/* OFP quick buttons */}
        {ofp && (
          <div style={{ display:"flex", gap:4 }}>
            {[ofp.dep, ofp.arr].filter(Boolean).map(icao => (
              <button key={icao} onClick={() => gotoIcao(icao)}
                style={{ background:"rgba(7,11,18,.92)", border:"1px solid rgba(94,200,255,.25)",
                  backdropFilter:"blur(12px)", borderRadius:8, padding:"6px 12px",
                  fontSize:13, fontWeight:700, color:"var(--cy)", cursor:"pointer",
                  fontFamily:"monospace", letterSpacing:.8,
                  boxShadow:"0 4px 16px rgba(0,0,0,.5)" }}>
                {icao}
              </button>
            ))}
          </div>
        )}

        {icaoErr && (
          <div style={{ background:"rgba(240,96,128,.18)", border:"1px solid rgba(240,96,128,.4)",
            borderRadius:8, padding:"5px 12px", fontSize:13, color:"var(--rd)",
            fontWeight:600 }}>
            {icaoErr}
          </div>
        )}

        <div style={{ flex:1 }}/>

        {/* Layer toggle */}
        <div style={{ display:"flex", gap:2,
          background:"rgba(7,11,18,.92)", borderRadius:10, padding:4,
          border:"1px solid rgba(94,200,255,.2)", backdropFilter:"blur(12px)",
          boxShadow:"0 4px 16px rgba(0,0,0,.5)" }}>
          {GROUND_LAYERS.map(l => (
            <button key={l.id} onClick={() => switchLayer(l.id)}
              style={{ padding:"6px 12px", borderRadius:7, border:"none", cursor:"pointer",
                fontSize:12, fontWeight:700, transition:"all .15s ease",
                background: mapLayer===l.id ? "rgba(94,200,255,.22)" : "transparent",
                color: mapLayer===l.id ? "var(--cy)" : "var(--tx)",
              }}>
              {l.emoji} {l.label}
            </button>
          ))}
        </div>
      </div>

      {/* HUD overlay — bottom-left to avoid toolbar overlap */}
      {live && (
        <div style={{ position:"absolute", bottom:56, left:12, zIndex:1000,
          background:"rgba(7,11,18,.88)", border:"1px solid rgba(94,200,255,.2)",
          borderRadius:10, padding:"8px 14px", color:"#d8e6f3",
          display:"flex", flexDirection:"column", gap:5, pointerEvents:"none",
          backdropFilter:"blur(10px)", boxShadow:"0 4px 16px rgba(0,0,0,.5)" }}>
          <div style={{ fontWeight:700, fontSize:10, letterSpacing:1.2, color:"var(--cy)", marginBottom:2 }}>
            {live.onGround ? "ON GROUND" : "AIRBORNE"}
          </div>
          {live.gsKt      != null && <div style={{ fontSize:13 }}>GS  <b>{Math.round(live.gsKt)} kt</b></div>}
          {live.headingDeg!= null && <div style={{ fontSize:13 }}>HDG <b>{Math.round(live.headingDeg)}°</b></div>}
          {!live.onGround && live.altFt != null &&
            <div style={{ fontSize:13 }}>ALT <b>{Math.round(live.altFt).toLocaleString()} ft</b></div>}
        </div>
      )}

      {/* Re-center button */}
      {!following && live && (
        <button onClick={recenter}
          style={{ position:"absolute", bottom:20, right:20, zIndex:1000,
            background:"rgba(7,11,18,.9)", border:"1px solid var(--cy)", color:"var(--cy)",
            borderRadius:8, padding:"7px 16px", fontSize:13, fontWeight:700,
            cursor:"pointer", backdropFilter:"blur(8px)",
            boxShadow:"0 4px 16px rgba(94,200,255,.2)" }}>
          ⊕ Re-center
        </button>
      )}

      {/* No live data notice */}
      {!live && (
        <div style={{ position:"absolute", bottom:20, left:"50%", transform:"translateX(-50%)",
          zIndex:1000, background:"rgba(7,11,18,.88)", border:"1px solid #1c2d42",
          borderRadius:8, padding:"7px 16px", fontSize:13, color:"var(--dim)",
          whiteSpace:"nowrap" }}>
          Bridge nincs csatlakoztatva — nincs élő pozíció
        </div>
      )}

      <style>{`
        .leaflet-container{background:#06090f;font-family:var(--font);}
        .leaflet-control-zoom a{background:#0d1520;color:#cdd9ec;border-color:#1c2d42;}
        .leaflet-control-zoom a:hover{background:#111c2b;}
        .osm-invert { filter: invert(1) hue-rotate(180deg) brightness(0.55) contrast(1.1); }
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
            <button key={v} style={S_PILL(mode===v)} onClick={()=>setMode(v)}>{l}</button>
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
            placeholder="SimBrief felhasználónév"/>
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
            {[["weights","Weights"],["fuel","Fuel"],["route","Route"],["navlog","Navlog"],["dispatch","Full OFP"]].map(([k,l])=>(
              <button key={k} style={S_PILL(sec===k)} onClick={()=>setSec(k)}>{l}</button>
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
            {sec==="dispatch" && (
              ofp.ofpText
                ? <pre style={{
                    margin:0, padding:0,
                    fontFamily:"'SF Mono','Fira Mono','Consolas',monospace",
                    fontSize:10.5, lineHeight:1.55, color:"#b8d0e8",
                    whiteSpace:"pre-wrap", wordBreak:"break-word",
                  }}>{ofp.ofpText}</pre>
                : <div style={{ color:"var(--dim)", fontSize:12, textAlign:"center", padding:24 }}>
                    OFP szöveg nem érhető el
                  </div>
            )}
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

/* ══ NOTES TAB ════════════════════════════════════════════════════ */
const NOTES_KEY = 'xdeck_notes_v1';
function NotesTab() {
  const [text, setText] = useState(() => ls.get(NOTES_KEY, ''));

  function change(val) {
    setText(val);
    ls.set(NOTES_KEY, val);
  }

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', gap:0 }}>
      {/* toolbar */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
        <span style={{ fontSize:9, fontWeight:700, letterSpacing:2, color:'var(--dim)' }}>NOTES</span>
        <div style={{ flex:1 }}/>
        <button
          style={{ fontSize:11, padding:'4px 12px', background:'rgba(240,96,128,.08)',
            border:'1px solid rgba(240,96,128,.2)', borderRadius:6,
            color:'var(--rd)', cursor:'pointer' }}
          onClick={() => { if(window.confirm('Töröljük az összes feljegyzést?')) change(''); }}>
          Töröl
        </button>
        <button
          style={{ fontSize:11, padding:'4px 12px', background:'rgba(94,200,255,.08)',
            border:'1px solid rgba(94,200,255,.2)', borderRadius:6,
            color:'var(--cy)', cursor:'pointer' }}
          onClick={() => { try { navigator.clipboard.writeText(text); } catch {} }}>
          Másolás
        </button>
      </div>
      {/* editor */}
      <textarea
        value={text}
        onChange={e => change(e.target.value)}
        placeholder="Írj ide... (automatikusan menti)"
        spellCheck={false}
        style={{
          flex: 1,
          background: 'var(--panel)',
          border: '1px solid var(--line)',
          borderRadius: 10,
          color: 'var(--tx)',
          fontSize: 14,
          lineHeight: '1.7',
          padding: '14px 16px',
          resize: 'none',
          fontFamily: '"SF Mono","Fira Code","Consolas",monospace',
          outline: 'none',
          width: '100%',
        }}
      />
      <div style={{ marginTop:6, fontSize:10, color:'var(--dim)', textAlign:'right' }}>
        {text.length > 0 ? `${text.length} karakter · ${text.split('\n').filter(Boolean).length} sor` : 'üres'}
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
/* ── Settings helpers — must be OUTSIDE SettingsTab to prevent remount on re-render ── */
const S_ROW = {
  display:"flex", alignItems:"center", justifyContent:"space-between",
  padding:"12px 16px", background:"var(--panel)", border:"1px solid var(--line)",
  borderRadius:12, gap:12,
};
const S_LABEL = { fontSize:13, color:"var(--tx)", fontWeight:500 };
const S_DESC  = { fontSize:10, color:"var(--dim)", marginTop:3 };
const S_INP   = {
  background:"var(--p2)", border:"1px solid var(--line)", color:"var(--tx)",
  fontSize:13, borderRadius:8, padding:"7px 11px", fontFamily:"inherit",
};
const S_PILL = (active) => ({
  borderRadius:99, padding:"5px 14px", fontSize:12, fontWeight:600,
  cursor:"pointer", border:"1px solid",
  background: active ? "var(--cy)" : "var(--p2)",
  color:       active ? "#070b12"   : "var(--dim)",
  borderColor: active ? "var(--cy)" : "var(--line)",
  transition: "background 0.15s ease, color 0.15s ease, border-color 0.15s ease",
});

function SettingsRow({label, desc, children}) {
  return (
    <div style={S_ROW}>
      <div style={{ minWidth:0 }}>
        <div style={S_LABEL}>{label}</div>
        {desc && <div style={S_DESC}>{desc}</div>}
      </div>
      <div style={{ flexShrink:0 }}>{children}</div>
    </div>
  );
}

function SettingsSectionHead({label}) {
  return (
    <div style={{ fontSize:9, fontWeight:700, letterSpacing:1.8, textTransform:"uppercase",
      color:"var(--dim)", marginTop:12, marginBottom:2, paddingLeft:4 }}>{label}</div>
  );
}

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

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
      <div style={{ fontSize:18, fontWeight:700, marginBottom:8 }}>Settings</div>

      {/* ── Megjelenés ── */}
      <SettingsSectionHead label="Megjelenés"/>
      <SettingsRow label="Téma" desc="App színvilág">
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
              <button key={v} onClick={()=>save("theme",v)} title={v}
                style={{ width:28, height:28, borderRadius:"50%",
                  background:`linear-gradient(135deg, ${bg} 50%, ${ac} 50%)`,
                  border: active ? `3px solid ${ac}` : "2px solid #1c2d42",
                  cursor:"pointer",
                  boxShadow: active ? `0 0 10px ${ac}88` : "none",
                  padding:0, flexShrink:0, transition:"all .2s ease" }}/>
            );
          })}
        </div>
      </SettingsRow>

      <SettingsRow label="Linkek megnyitása" desc="Shortcutok hova nyíljanak">
        <div style={{ display:"flex", gap:6 }}>
          {[["Böngészőben",false],["App-ban",true]].map(([l,v])=>(
            <button key={String(v)} style={S_PILL(settings.openLinksInApp===v)}
              onClick={()=>save("openLinksInApp",v)}>{l}</button>
          ))}
        </div>
      </SettingsRow>

      <SettingsRow label="Súlyegység" desc="Üzemanyag és tömeg megjelenítés">
        <div style={{ display:"flex", gap:6 }}>
          {[["kg","KG"],["lbs","LBS"]].map(([v,l])=>(
            <button key={v} style={S_PILL((settings.weightUnit||"kg")===v)}
              onClick={()=>save("weightUnit",v)}>{l}</button>
          ))}
        </div>
      </SettingsRow>

      <SettingsRow label="Időzóna kijelzés" desc="Óra a titlebarban">
        <div style={{ display:"flex", gap:6 }}>
          {[["utc","UTC"],["local","Local"],["both","Both"]].map(([v,l])=>(
            <button key={v} style={S_PILL((settings.clockMode||"utc")===v)}
              onClick={()=>save("clockMode",v)}>{l}</button>
          ))}
        </div>
      </SettingsRow>

      {/* ── SimBrief / OFP ── */}
      <SettingsSectionHead label="SimBrief / OFP"/>
      <SettingsRow label="SimBrief usernév" desc="Dispatch felhasználónév">
        <div style={{ display:"flex", gap:8 }}>
          <input style={{...S_INP, width:180}}
            value={settings.sbUser||""}
            onChange={e=>save("sbUser",e.target.value)}
            placeholder="SimBrief felhasználónév"/>
          <button style={{ background:"var(--cy)", color:"#070b12", border:"none",
            borderRadius:8, padding:"7px 16px", fontSize:13, fontWeight:700, cursor:"pointer" }}
            onClick={onLoadOFP}>Betölt</button>
        </div>
      </SettingsRow>

      <SettingsRow label="OFP megjelenítés" desc="Dispatch oldal stílusa">
        <div style={{ display:"flex", gap:6 }}>
          {[["simplified","Simplified"],["realistic","Realistic"]].map(([v,l])=>(
            <button key={v} style={S_PILL((settings.ofpMode||"simplified")===v)}
              onClick={()=>save("ofpMode",v)}>{l}</button>
          ))}
        </div>
      </SettingsRow>

      <SettingsRow label="Auto OFP betöltés" desc="Induláskor automatikusan lekéri a legutóbbi OFP-t">
        <button style={S_PILL(settings.autoLoadOfp)}
          onClick={()=>save("autoLoadOfp",!settings.autoLoadOfp)}>
          {settings.autoLoadOfp ? "BE" : "KI"}
        </button>
      </SettingsRow>

      {/* ── Bridge / Kapcsolat ── */}
      <SettingsSectionHead label="Bridge / Kapcsolat"/>
      <SettingsRow label="Session kód" desc="Firebase sync azonosító — ezt add meg a mobilon is">
        <input style={{...S_INP, width:170}}
          value={settings.sessionCode||""}
          onChange={e=>save("sessionCode",e.target.value)}
          placeholder="pl. nev-host"/>
      </SettingsRow>

      <SettingsRow label="Auto-start Bridge" desc="App indításkor automatikusan elindítja a Bridge-et">
        <button style={S_PILL(settings.autoStartBridge)}
          onClick={()=>save("autoStartBridge",!settings.autoStartBridge)}>
          {settings.autoStartBridge ? "BE" : "KI"}
        </button>
      </SettingsRow>

      <SettingsRow label="Bridge mód" desc="Szimulátor kapcsolat típusa">
        <div style={{ display:"flex", gap:6 }}>
          {[["simconnect","SimConnect"],["fsuipc","FSUIPC"],["mock","Mock"]].map(([v,l])=>(
            <button key={v} style={S_PILL((settings.bridgeMode||"simconnect")===v)}
              onClick={()=>save("bridgeMode",v)}>{l}</button>
          ))}
        </div>
      </SettingsRow>

      {/* ── Külső alkalmazások ── */}
      <SettingsSectionHead label="Külső alkalmazások"/>
      <SettingsRow label="Fenix EFB URL" desc="Ha fut a Fenix EFB a szimulátorban">
        <input style={{...S_INP, width:230}}
          value={settings.fenixUrl||""}
          onChange={e=>save("fenixUrl",e.target.value)}
          placeholder="http://192.168.1.x:8080"/>
      </SettingsRow>

      <SettingsRow label="Navigraph Charts URL" desc="Egyedi URL ha szükséges">
        <input style={{...S_INP, width:230}}
          value={settings.navigraphUrl||""}
          onChange={e=>save("navigraphUrl",e.target.value)}
          placeholder="https://charts.navigraph.com"/>
      </SettingsRow>

      {/* ── Térkép ── */}
      <SettingsSectionHead label="Térkép"/>
      <SettingsRow label="Alapértelmezett map layer" desc="Ground tab induláskor melyik réteg legyen">
        <div style={{ display:"flex", gap:6 }}>
          {[["hybrid","Hybrid"],["chart","Chart"],["satellite","Satellite"]].map(([v,l])=>(
            <button key={v} style={S_PILL((settings.defaultMapLayer||"hybrid")===v)}
              onClick={()=>save("defaultMapLayer",v)}>{l}</button>
          ))}
        </div>
      </SettingsRow>

      <SettingsRow label="Útvonal vonalszín" desc="Map tab route line színe">
        <div style={{ display:"flex", gap:6 }}>
          {[["#5ec8ff","Cyan"],["#52e3b0","Green"],["#ffb454","Amber"],["#a78bfa","Purple"]].map(([v,l])=>(
            <button key={v} onClick={()=>save("routeColor",v)}
              style={{ width:24, height:24, borderRadius:"50%", background:v, border:"none",
                cursor:"pointer", border:(settings.routeColor||"#5ec8ff")===v?"3px solid white":"2px solid transparent" }}/>
          ))}
        </div>
      </SettingsRow>

      {/* ── Értesítések ── */}
      <SettingsSectionHead label="Értesítések"/>
      <SettingsRow label="Leszállás értesítés" desc="Push értesítés leszálláskor (mobilon)">
        <button style={S_PILL(settings.notifyLanding !== false)}
          onClick={()=>save("notifyLanding",!settings.notifyLanding)}>
          {settings.notifyLanding !== false ? "BE" : "KI"}
        </button>
      </SettingsRow>

      <SettingsRow label="TOD értesítés" desc="Descent figyelmeztetés 10 perccel előtte">
        <button style={S_PILL(settings.notifyTod !== false)}
          onClick={()=>save("notifyTod",!settings.notifyTod)}>
          {settings.notifyTod !== false ? "BE" : "KI"}
        </button>
      </SettingsRow>

      {/* ── Rendszer ── */}
      <SettingsSectionHead label="Rendszer"/>
      <SettingsRow label="Verzió">
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontVariantNumeric:"tabular-nums", fontSize:12, color:"var(--dim)" }}>
            {ver ? `${ver.codename} · ${ver.version}` : "betöltés..."}
          </span>
          {ver?.channel==="dev" && (
            <span style={{ borderRadius:99, padding:"2px 8px", fontSize:10, fontWeight:700,
              background:"rgba(255,180,84,.12)", border:"1px solid rgba(255,180,84,.25)",
              color:"#ffb454" }}>DEV</span>
          )}
          <button style={{ background:"#111c2b", color:"var(--dim)", border:"1px solid var(--line)",
            borderRadius:8, padding:"4px 10px", fontSize:11, cursor:"pointer" }}
            onClick={()=>setDevOpen(!devOpen)}>
            {devOpen ? "▲ Dev" : "⚙ Dev"}
          </button>
        </div>
      </SettingsRow>

      {/* Dev options */}
      {devOpen && (
        <div className="card anim-down" style={{ padding:14, borderColor:"rgba(255,180,84,.2)",
          background:"rgba(255,180,84,.03)", display:"flex", flexDirection:"column", gap:10 }}>
          <div style={{ fontSize:12, fontWeight:600, color:"#ffb454" }}>⚙ Developer Options</div>
          <div style={{ display:"flex", gap:8, alignItems:"flex-end" }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:9, color:"var(--dim)", letterSpacing:1, marginBottom:4 }}>CODENAME</div>
              <input style={{...S_INP, width:"100%"}}
                value={editCn} onChange={e=>setEditCn(e.target.value)}
                placeholder="pl. Tahoe"/>
            </div>
            <div>
              <div style={{ fontSize:9, color:"var(--dim)", letterSpacing:1, marginBottom:4 }}>CHANNEL</div>
              <div style={{ display:"flex", gap:6 }}>
                {["release","dev"].map(ch=>(
                  <button key={ch} style={S_PILL(editCh===ch)}
                    onClick={()=>setEditCh(ch)}>{ch}</button>
                ))}
              </div>
            </div>
            <button style={{ background:"var(--cy)", color:"#070b12", border:"none",
              borderRadius:8, padding:"7px 16px", fontSize:12, fontWeight:700,
              cursor:"pointer", alignSelf:"flex-end" }}
              onClick={async()=>{
                await py.saveVersionSettings(editCn, editCh);
                const v = await py.getVersion();
                if (v) setVer(v);
              }}>Mentés</button>
          </div>
          <div style={{ fontSize:11, color:"var(--dim)", lineHeight:1.6 }}>
            A codename az auto-updater alapja. DEV csatornán megnyílik a dev console.
          </div>
        </div>
      )}
    </div>
  );
});

/* ══ BRIDGE TAB ══════════════════════════════════════════════════ */
function BridgeTab({ live, sessionCode }) {
  const [running,     setRunning]     = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [err,         setErr]         = useState("");
  const [crashLog,    setCrashLog]    = useState("");
  const [installing,  setInstalling]  = useState(false);
  const [installDone, setInstallDone] = useState(false);
  const [log,         setLog]         = useState([]);
  const [showLog,     setShowLog]     = useState(false);
  const [liveLog,     setLiveLog]     = useState("");
  const logRef  = useRef(null);
  const liveRef = useRef(null);

  useEffect(() => {
    if (!showLog) return;
    const load = () => invoke("bridge_read_log").then(setLiveLog).catch(()=>{});
    load();
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, [showLog]);

  useEffect(() => {
    if (liveRef.current) liveRef.current.scrollTop = liveRef.current.scrollHeight;
  }, [liveLog]);
  const notInstalled = err.includes("nem található") || err.includes("not found");
  const connected = live != null;

  useEffect(() => {
    invoke("bridge_status").then(r => setRunning(r.running)).catch(()=>{});
    const t = setInterval(() => {
      invoke("bridge_status").then(r => setRunning(r.running)).catch(()=>{});
    }, 3000);
    // Listen for crash events
    let unlisten;
    listen("bridge:crashed", e => {
      setRunning(false);
      setCrashLog(String(e.payload));
    }).then(u => { unlisten = u; });
    return () => { clearInterval(t); unlisten?.(); };
  }, []);

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  async function startInstall() {
    setInstalling(true); setInstallDone(false); setLog([]); setErr("");
    const unlisten = await listen("bridge:log", e => {
      setLog(prev => [...prev, e.payload]);
    });
    try {
      const refreshToken = auth.currentUser?.refreshToken || "";
      await invoke("bridge_install", { sessionCode: sessionCode || "", refreshToken });
      setInstallDone(true);
    } catch(e) {
      setLog(prev => [...prev, `❌ Hiba: ${e}`]);
    }
    unlisten();
    setInstalling(false);
  }

  async function toggle() {
    setLoading(true); setErr(""); setCrashLog("");
    try {
      if (running) {
        await invoke("bridge_stop");
        setRunning(false);
      } else {
        const refreshToken = auth.currentUser?.refreshToken || "";
        await invoke("bridge_start", { refreshToken });
        setRunning(true);
      }
    } catch(e) { setErr(String(e)); }
    setLoading(false);
  }

  async function restart() {
    setLoading(true); setErr(""); setCrashLog("");
    try {
      if (running) {
        await invoke("bridge_stop");
        await new Promise(r => setTimeout(r, 600));
      }
      const refreshToken = auth.currentUser?.refreshToken || "";
      await invoke("bridge_start", { refreshToken });
      setRunning(true);
    } catch(e) { setErr(String(e)); }
    setLoading(false);
  }

  async function redownload() {
    setErr(""); setCrashLog("");
    if (running) {
      try { await invoke("bridge_stop"); setRunning(false); } catch {}
      await new Promise(r => setTimeout(r, 800));
    }
    startInstall();
  }

  // Install progress UI
  if (installing || (log.length > 0 && !running)) {
    const done = installDone;
    const pct  = done ? 100
      : log.some(l => l.includes("npm install")) ? 66
      : log.some(l => l.includes("git")) ? 33 : 10;
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        <div className="card anim-up" style={{ padding:"20px" }}>
          <div style={{ fontSize:14, fontWeight:700, color: done ? "var(--gn)" : "var(--cy)",
            marginBottom:12, display:"flex", alignItems:"center", gap:8 }}>
            {done ? <Check size={16}/> : <Loader2 size={16} className="spin"/>}
            {done ? "Bridge telepítve!" : "Telepítés folyamatban…"}
          </div>
          {/* Progress bar */}
          <div style={{ height:4, borderRadius:2, background:"var(--line)", marginBottom:14, overflow:"hidden" }}>
            <div style={{ height:"100%", borderRadius:2, width:`${pct}%`,
              background: done ? "var(--gn)" : "var(--cy)",
              transition:"width .4s ease" }}/>
          </div>
          {/* Log */}
          <div ref={logRef} style={{ background:"rgba(0,0,0,.3)", borderRadius:8, padding:"8px 10px",
            fontFamily:"monospace", fontSize:10, color:"var(--dim)", lineHeight:1.7,
            maxHeight:220, overflowY:"auto" }}>
            {log.map((l,i) => (
              <div key={i} style={{ color: l.startsWith("✓") ? "var(--gn)" : l.startsWith("❌") ? "var(--rd)" : l.startsWith("►") ? "var(--cy)" : "var(--dim)" }}>
                {l}
              </div>
            ))}
            {installing && <div style={{ color:"var(--cy)", animation:"pulse 1s infinite" }}>▌</div>}
          </div>
          {done && (
            <button className="btn-primary" onClick={() => { setLog([]); setErr(""); }}
              style={{ marginTop:12, width:"100%" }}>
              ▶ Bridge indítása
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:10 }}>

      {/* Not installed state */}
      {notInstalled && (
        <div className="card anim-up" style={{ padding:"22px 20px",
          border:"1px solid rgba(255,180,84,.25)", background:"rgba(255,180,84,.04)" }}>
          <div style={{ fontSize:15, fontWeight:700, color:"var(--am)", marginBottom:6 }}>
            Bridge nincs telepítve
          </div>
          <div style={{ fontSize:12, color:"var(--dim)", lineHeight:1.7, marginBottom:16 }}>
            Az app automatikusan letölti és beállítja a bridge-et.<br/>
            <b style={{ color:"var(--tx)" }}>Szükséges:</b> git + Node.js 18+
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button className="btn-primary" onClick={startInstall} style={{ flex:1 }}>
              <Server size={14}/> Telepítés
            </button>
            <button className="btn-ghost" onClick={() => py.openExternal("https://nodejs.org/en/download")}>
              Node.js
            </button>
          </div>
        </div>
      )}

      {/* Start / Stop kártya */}
      {!notInstalled && (
      <div className="card anim-up" style={{ padding:"24px 20px", textAlign:"center" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:10, marginBottom:18 }}>
          <div style={{
            width:12, height:12, borderRadius:"50%",
            background: connected ? "var(--gn)" : running ? "var(--am)" : "var(--rd)",
            boxShadow: connected ? "0 0 8px 3px rgba(82,227,176,.4)" : "none",
            transition:"all .4s"
          }}/>
          <div style={{ fontSize:13, fontWeight:700,
            color: connected ? "var(--gn)" : running ? "var(--am)" : "var(--dim)" }}>
            {connected ? "Sim csatlakozva" : running ? "Bridge fut, sim vár…" : "Bridge leállítva"}
          </div>
        </div>

        <button onClick={toggle} disabled={loading}
          style={{
            fontSize:16, fontWeight:800, padding:"14px 48px", borderRadius:14, border:"1.5px solid",
            cursor: loading ? "wait" : "pointer",
            background: running ? "rgba(240,96,128,.1)"  : "rgba(82,227,176,.1)",
            borderColor: running ? "rgba(240,96,128,.4)" : "rgba(82,227,176,.4)",
            color:       running ? "var(--rd)"           : "var(--gn)",
            transition:"all .2s",
          }}>
          {loading ? "⏳" : running ? "⏹  Stop" : "▶  Start"}
        </button>

        {/* Secondary actions */}
        <div style={{ display:"flex", gap:8, marginTop:12, justifyContent:"center" }}>
          <button onClick={restart} disabled={loading}
            className="btn-ghost" style={{ fontSize:12, padding:"6px 14px" }}>
            <RotateCcw size={13}/> Újraindítás
          </button>
          <button onClick={redownload} disabled={loading || installing}
            className="btn-ghost" style={{ fontSize:12, padding:"6px 14px" }}>
            <Download size={13}/> Újra letölt
          </button>
          <button onClick={() => setShowLog(v => !v)}
            className="btn-ghost" style={{ fontSize:12, padding:"6px 14px",
              color: showLog ? "var(--cy)" : undefined }}>
            Log
          </button>
          <button onClick={() => invoke("open_firewall")}
            className="btn-ghost" style={{ fontSize:12, padding:"6px 14px" }}
            title="Tűzfalszabály hozzáadása — szükséges a mobil WebView csatlakozáshoz">
            🔓 Tűzfal
          </button>
        </div>

        {err && <div style={{ marginTop:10, fontSize:11, color:"var(--rd)", lineHeight:1.5 }}>{err}</div>}

        <div style={{ marginTop:14, fontSize:10, color:"var(--dim)" }}>
          Session: <span style={{ color:"var(--cy)", fontFamily:"monospace" }}>{sessionCode || "—"}</span>
        </div>
      </div>
      )}

      {/* Live log */}
      {showLog && (
        <div className="card anim-up" style={{ padding:"10px 12px" }}>
          <div style={{ fontSize:10, fontWeight:700, color:"var(--cy)", marginBottom:6, letterSpacing:1 }}>
            BRIDGE.LOG (élő)
          </div>
          <div ref={liveRef} style={{ background:"rgba(0,0,0,.3)", borderRadius:6, padding:"6px 8px",
            fontFamily:"monospace", fontSize:9.5, color:"var(--dim)", lineHeight:1.7,
            maxHeight:200, overflowY:"auto", whiteSpace:"pre-wrap" }}>
            {liveLog || "— nincs log adat —"}
          </div>
        </div>
      )}

      {/* Crash log */}
      {crashLog && (
        <div className="card anim-up" style={{ padding:"12px 14px",
          border:"1px solid rgba(240,96,128,.3)", background:"rgba(240,96,128,.05)" }}>
          <div style={{ fontSize:11, fontWeight:700, color:"var(--rd)", marginBottom:6 }}>
            Bridge kilépett — bridge.log:
          </div>
          <pre style={{ fontSize:10, color:"var(--dim)", fontFamily:"monospace",
            whiteSpace:"pre-wrap", margin:0, lineHeight:1.6, maxHeight:160, overflowY:"auto" }}>
            {crashLog}
          </pre>
          <button className="btn-ghost" style={{ marginTop:8, fontSize:11 }}
            onClick={() => invoke("bridge_read_log").then(setCrashLog)}>
            <RefreshCw size={11}/> Frissítés
          </button>
        </div>
      )}

      {/* Live adatok ha csatlakozva */}
      {connected && (
        <div className="card anim-up" style={{ animationDelay:"60ms" }}>
          <div style={{ padding:"12px 16px", borderBottom:"1px solid var(--line)", fontSize:12,
            fontWeight:600, color:"var(--tx)" }}>{live.aircraftTitle || "Repülő"}</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:0 }}>
            {[
              ["ALT", `${Math.round(live.altFt||0).toLocaleString()} ft`, "var(--cy)"],
              ["GS",  `${Math.round(live.gsKt||0)} kt`,                   "var(--am)"],
              ["VS",  `${live.vsFpm>=0?"+":""}${Math.round(live.vsFpm||0)} fpm`,
                       live.vsFpm < -100 ? "var(--rd)" : "var(--gn)"],
            ].map(([l,v,c], i)=>(
              <div key={l} style={{ padding:"12px", textAlign:"center",
                borderRight: i<2 ? "1px solid var(--line)" : "none" }}>
                <div style={{ fontSize:9, color:"var(--dim)", letterSpacing:1 }}>{l}</div>
                <div style={{ fontSize:15, fontWeight:800, color:c, marginTop:3 }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ══ LANDING TAB ═════════════════════════════════════════════════ */
function LandingTab({ sessionCode }) {
  const [landing, setLanding] = useState(null);
  const [logbook, setLogbook] = useState([]);

  useEffect(() => {
    const lb = ls.get("xdeck_logbook", []);
    setLogbook(lb);
    if (!sessionCode) return;
    const r = ref(getDB(), `sessions/${sessionCode}/lastLanding`);
    const unsub = onValue(r, s => { const v = s.val(); if (v) setLanding(v); });
    return unsub;
  }, [sessionCode]);

  const qLabel = fpm => {
    const a = Math.abs(fpm);
    if (a <= 200) return ["Greaser", "var(--gn)"];
    if (a <= 400) return ["Smooth",  "var(--cy)"];
    if (a <= 600) return ["Firm",    "var(--am)"];
    if (a <= 900) return ["Hard",    "var(--rd)"];
    return           ["Bounce",  "var(--pu)"];
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
      <div className="section-label">Utolsó leszállás</div>

      {landing ? (
        <div className="card anim-up" style={{ padding:"18px 16px" }}>
          {(() => {
            const [ql, qc] = qLabel(landing.fpm);
            return (
              <>
                <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14 }}>
                  <div style={{ fontSize:28, fontWeight:800, color:qc }}>{Math.abs(landing.fpm)}</div>
                  <div>
                    <div style={{ fontSize:10, color:"var(--dim)", letterSpacing:1 }}>FPM</div>
                    <div style={{ fontSize:13, fontWeight:700, color:qc }}>{ql}</div>
                  </div>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
                  {[
                    ["GS",      `${landing.gs} kt`,            "var(--am)"],
                    ["IAS",     `${landing.ias||"—"} kt`,      "var(--cy)"],
                    ["Heading", `${landing.headingDeg||"—"}°`, "var(--pu)"],
                  ].map(([l,v,c])=>(
                    <div key={l} style={{ background:"var(--p2)", borderRadius:10, padding:"8px 10px",
                      border:"1px solid var(--line)", textAlign:"center" }}>
                      <div style={{ fontSize:9, color:"var(--dim)", letterSpacing:1 }}>{l}</div>
                      <div style={{ fontSize:13, fontWeight:700, color:c, marginTop:2 }}>{v}</div>
                    </div>
                  ))}
                </div>
                {landing.aircraftTitle && (
                  <div style={{ marginTop:10, fontSize:10, color:"var(--dim)" }}>{landing.aircraftTitle}</div>
                )}
              </>
            );
          })()}
        </div>
      ) : (
        <div className="card" style={{ padding:32, textAlign:"center", color:"var(--dim)", fontSize:13 }}>
          <TrendingDown size={28} color="#1e3a5f" style={{ marginBottom:8 }}/>
          <div>Nincs adat — indítsd el a bridge-et és szállj le.</div>
        </div>
      )}

      {logbook.length > 0 && (
        <>
          <div className="section-label" style={{ marginTop:4 }}>Logbook</div>
          {logbook.slice(0,10).map((e, i) => {
            const [ql, qc] = qLabel(e.fpm);
            return (
              <div key={e.ts} className="card anim-up"
                style={{ padding:"10px 14px", display:"flex", alignItems:"center", gap:12,
                  animationDelay:`${i*40}ms` }}>
                <div style={{ fontSize:15, fontWeight:800, color:qc, width:48, flexShrink:0 }}>
                  {Math.abs(e.fpm)}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:11, fontWeight:600 }}>
                    {e.dep && e.arr ? `${e.dep} → ${e.arr}` : "—"}
                  </div>
                  <div style={{ fontSize:10, color:"var(--dim)", overflow:"hidden",
                    textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {e.aircraft || "—"} · {ql} · {e.gs} kt GS
                  </div>
                </div>
                <div style={{ fontSize:10, color:"var(--dim)", flexShrink:0 }}>
                  {new Date(e.ts).toLocaleDateString("hu")}
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

/* ══ LOGBOOK TAB ═════════════════════════════════════════════════ */
function LogbookTab() {
  const [entries, setEntries] = useState(() => ls.get("xdeck_logbook", []));

  const qLabel = fpm => {
    const a = Math.abs(fpm);
    if (a <= 200) return ["Greaser", "var(--gn)"];
    if (a <= 400) return ["Smooth",  "var(--cy)"];
    if (a <= 600) return ["Firm",    "var(--am)"];
    if (a <= 900) return ["Hard",    "var(--rd)"];
    return           ["Bounce",  "var(--pu)"];
  };

  const clear = () => {
    if (!confirm("Törölni az összes leszállást?")) return;
    ls.set("xdeck_logbook", []);
    setEntries([]);
  };

  if (!entries.length) return (
    <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
      <div className="section-label">Logbook</div>
      <div className="card" style={{ padding:32, textAlign:"center", color:"var(--dim)", fontSize:13 }}>
        <Book size={28} color="#1e3a5f" style={{ marginBottom:8 }}/>
        <div>Még nincs rögzített leszállás.</div>
      </div>
    </div>
  );

  const avg = Math.round(entries.reduce((s,e)=>s+Math.abs(e.fpm),0)/entries.length);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div className="section-label" style={{ margin:0 }}>Logbook — {entries.length} repülés</div>
        <button className="btn-ghost" onClick={clear} style={{ fontSize:10, padding:"4px 10px" }}>
          Törlés
        </button>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
        {[
          ["Repülések", entries.length, "var(--cy)"],
          ["Átlag FPM", avg,            avg<=400?"var(--gn)":avg<=700?"var(--am)":"var(--rd)"],
          ["Legjobb",   Math.min(...entries.map(e=>Math.abs(e.fpm))), "var(--gn)"],
        ].map(([l,v,c])=>(
          <div key={l} className="card anim-up" style={{ padding:"10px 12px", textAlign:"center" }}>
            <div style={{ fontSize:9, color:"var(--dim)", letterSpacing:1 }}>{l}</div>
            <div style={{ fontSize:16, fontWeight:800, color:c, marginTop:2 }}>{v}</div>
          </div>
        ))}
      </div>

      {entries.map((e, i) => {
        const [ql, qc] = qLabel(e.fpm);
        return (
          <div key={e.ts} className="card anim-up"
            style={{ padding:"10px 14px", display:"flex", alignItems:"center", gap:12,
              borderLeft:`3px solid ${qc}`, animationDelay:`${i*30}ms` }}>
            <div style={{ fontSize:16, fontWeight:800, color:qc, width:50, flexShrink:0 }}>
              {Math.abs(e.fpm)}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:12, fontWeight:600 }}>
                {e.dep && e.arr ? `${e.dep} → ${e.arr}` : "Ismeretlen útvonal"}
              </div>
              <div style={{ fontSize:10, color:"var(--dim)", marginTop:2,
                overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                {e.aircraft || "—"} · {ql} · {e.gs} kt GS
                {e.ftMin ? ` · ${Math.floor(e.ftMin/60)}h ${e.ftMin%60}m` : ""}
              </div>
            </div>
            <div style={{ fontSize:10, color:"var(--dim)", flexShrink:0 }}>
              {new Date(e.ts).toLocaleDateString("hu")}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ══ DICT TAB ════════════════════════════════════════════════════ */
const CAT_COLORS = {
  nav:"#5ec8ff",alt:"#52e3b0",spd:"#ffb454",atc:"#a78bfa",
  wx:"#7dd3fc",sys:"#f06080",disp:"#c084fc",eng:"#fb923c",
  wgt:"#e6965c",gnd:"#4ade80",ops:"#c4d6ff",cert:"#fbbf24",
  aero:"#a3e635",emer:"#f43f5e",
};
const CAT_NAMES = {
  nav:"Navigáció & Eljárások",alt:"Magasságmérés",spd:"Sebességek",
  atc:"ATC & Kommunikáció",wx:"Időjárás",sys:"Fedélzeti Rendszerek",
  disp:"Kijelzők & Műszerek",eng:"Motor & Teljesítmény",wgt:"Tömeg & Egyensúly",
  gnd:"Repülőtér & Terep",ops:"Repülési Ops",cert:"Engedélyek",
  aero:"Aerodinamika",emer:"Vészhelyzet",
};

function DictTab() {
  const [terms, setTerms]   = useState(null);
  const [q, setQ]           = useState("");
  const [err, setErr]       = useState(null);

  useEffect(() => {
    fetch("/dict.json").then(r=>r.json()).then(setTerms).catch(()=>setErr("dict.json nem töltődött be"));
  }, []);

  const filtered = terms
    ? (q.trim()
        ? terms.filter(t => {
            const lq = q.toLowerCase();
            return t.a?.toLowerCase().includes(lq) || t.t?.toLowerCase().includes(lq) || t.d?.toLowerCase().includes(lq);
          })
        : terms)
    : [];

  const grouped = !q.trim() && filtered.length
    ? filtered.reduce((acc, t) => { (acc[t.c] = acc[t.c]||[]).push(t); return acc; }, {})
    : null;

  if (err) return (
    <div className="card" style={{ padding:24, color:"var(--rd)", fontSize:13 }}>{err}</div>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
      <div className="section-label">Aviatikai Szótár</div>

      <input
        value={q} onChange={e=>setQ(e.target.value)}
        placeholder="Keresés (pl. ILS, leszállás, sebesség…)"
        style={{ width:"100%", background:"var(--p2)", border:"1px solid var(--line)",
          color:"var(--tx)", borderRadius:8, padding:"9px 12px", fontSize:13, outline:"none",
          boxSizing:"border-box" }}
      />

      {!terms && (
        <div style={{ textAlign:"center", padding:32, color:"var(--dim)" }}>
          <Loader2 size={20} className="spin"/></div>
      )}

      {terms && (
        <div style={{ fontSize:10, color:"var(--dim)", textAlign:"right" }}>
          {filtered.length} / {terms.length} kifejezés
        </div>
      )}

      {grouped
        ? Object.entries(grouped).map(([cat, list]) => (
            <div key={cat}>
              <div className="section-label">{CAT_NAMES[cat]||cat} ({list.length})</div>
              {list.map(t => <DictCard key={t.a} t={t}/>)}
            </div>
          ))
        : filtered.map(t => <DictCard key={t.a} t={t}/>)
      }

      {terms && !filtered.length && (
        <div className="card" style={{ padding:24, textAlign:"center", color:"var(--dim)", fontSize:13 }}>
          Nincs találat: „{q}"
        </div>
      )}
    </div>
  );
}

function DictCard({ t }) {
  const cc = CAT_COLORS[t.c] || "var(--cy)";
  return (
    <div className="card anim-up"
      style={{ padding:"10px 14px", marginBottom:6, borderLeft:`3px solid ${cc}` }}>
      <div style={{ display:"flex", alignItems:"baseline", gap:10, marginBottom:3 }}>
        <div style={{ fontSize:13, fontWeight:700, color:cc, minWidth:60, flexShrink:0 }}>{t.a}</div>
        <div style={{ fontSize:10, color:"var(--dim)", flex:1 }}>{t.t}</div>
      </div>
      <div style={{ fontSize:12, color:"var(--tx)", lineHeight:1.55 }}>{t.d}</div>
    </div>
  );
}

/* ══ MOD MANAGER ═════════════════════════════════════════════════ */

const MOD_BRAND_COLORS = {
  "pmdg":         "#1a6ed4",
  "flybywire":    "#5ec8ff",
  "fnx":          "#ff7c2a",
  "aerosoft":     "#e53e3e",
  "fsdreamteam":  "#d69e2e",
  "orbx":         "#38a169",
  "bksq":         "#805ad5",
  "msfs":         "#a78bfa",
  "asobo":        "#52e3b0",
};

const MOD_TYPE_LABELS = {
  "AIRCRAFT": "Aircraft",
  "LIVERY":   "Livery",
  "SCENERY":  "Scenery",
  "AIRPORT":  "Airport",
  "SIMOBJECT":"SimObject",
  "CUSTOM":   "Utility",
};

function modBrandColor(folder) {
  const prefix = folder.toLowerCase().replace(/^_disabled_/, "");
  for (const [k,v] of Object.entries(MOD_BRAND_COLORS)) {
    if (prefix.startsWith(k)) return v;
  }
  return "var(--cy)";
}

function modTypeIcon(ct) {
  switch((ct||"").toUpperCase()) {
    case "AIRCRAFT":  return Plane;
    case "LIVERY":    return Activity;
    case "SCENERY":
    case "AIRPORT":   return Layers;
    default:          return PackageOpen;
  }
}

function fmtSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024*1024) return `${(bytes/1024).toFixed(0)} KB`;
  if (bytes < 1024*1024*1024) return `${(bytes/1024/1024).toFixed(1)} MB`;
  return `${(bytes/1024/1024/1024).toFixed(2)} GB`;
}

const MOD_FILTERS = ["All","Aircraft","Livery","Scenery","Utility"];

function ModsTab() {
  const [folder, setFolder]     = useState("");
  const [mods, setMods]         = useState(null);
  const [loading, setLoading]   = useState(false);
  const [err, setErr]           = useState("");
  const [q, setQ]               = useState("");
  const [filter, setFilter]     = useState("All");
  const [delConfirm, setDelConfirm] = useState(null);
  const [busy, setBusy]         = useState({});
  const [selected, setSelected] = useState(new Set());
  const [showAdd, setShowAdd]   = useState(false);
  const [addPath, setAddPath]   = useState("");
  const [adding, setAdding]     = useState(false);
  const [showMerge, setShowMerge] = useState(false);
  const [mergeName, setMergeName] = useState("");
  const [merging, setMerging]   = useState(false);

  async function detect() {
    setLoading(true); setErr("");
    try {
      const result = await invoke("mods_get_community_folder");
      if (result.path) { setFolder(result.path); await loadMods(result.path); }
      else setErr("Nem találtam automatikusan a community mappát. Add meg kézzel.");
    } catch(e) { setErr(String(e)); }
    setLoading(false);
  }

  async function loadMods(path) {
    setLoading(true); setErr("");
    try {
      const list = await invoke("mods_list", { path });
      setMods(list);
    } catch(e) { setErr(String(e)); }
    setLoading(false);
  }

  async function deleteMod(mod) {
    setBusy(b => ({...b, [mod.folder]: true}));
    try {
      await invoke("mod_delete", { path: mod.path });
      setMods(m => m.filter(x => x.folder !== mod.folder));
      setSelected(prev => { const n = new Set(prev); n.delete(mod.folder); return n; });
    } catch(e) { setErr(String(e)); }
    setBusy(b => ({...b, [mod.folder]: false}));
    setDelConfirm(null);
  }

  const toggleSelect = folder => setSelected(prev => {
    const n = new Set(prev);
    n.has(folder) ? n.delete(folder) : n.add(folder);
    return n;
  });

  async function addMod() {
    if (!addPath.trim() || !folder) return;
    setAdding(true); setErr("");
    try {
      await invoke("mod_add", { srcPath: addPath.trim(), communityPath: folder });
      setAddPath(""); setShowAdd(false);
      await loadMods(folder);
    } catch(e) { setErr(String(e)); }
    setAdding(false);
  }

  async function mergeMods() {
    if (selected.size < 2 || !mergeName.trim() || !folder) return;
    setMerging(true); setErr("");
    const paths = (mods || []).filter(m => selected.has(m.folder)).map(m => m.path);
    try {
      await invoke("mod_merge", { paths, targetName: mergeName.trim(), communityPath: folder });
      setSelected(new Set()); setMergeName(""); setShowMerge(false);
      await loadMods(folder);
    } catch(e) { setErr(String(e)); }
    setMerging(false);
  }

  useEffect(() => { detect(); }, []);

  const filtered = (mods || []).filter(m => {
    if (filter !== "All") {
      const ct = (m.contentType || "").toUpperCase();
      if (filter === "Aircraft" && ct !== "AIRCRAFT") return false;
      if (filter === "Livery"   && ct !== "LIVERY") return false;
      if (filter === "Scenery"  && ct !== "SCENERY" && ct !== "AIRPORT") return false;
      if (filter === "Utility"  && ct !== "CUSTOM" && ct !== "SIMOBJECT" && ct !== "") return false;
    }
    if (q.trim()) {
      const lq = q.toLowerCase();
      return m.title.toLowerCase().includes(lq) || m.folder.toLowerCase().includes(lq) || (m.creator||"").toLowerCase().includes(lq);
    }
    return true;
  });

  const enabledCount  = (mods||[]).filter(m => m.enabled).length;
  const disabledCount = (mods||[]).filter(m => !m.enabled).length;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12, height:"100%" }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
        <div>
          <div style={{ fontSize:18, fontWeight:700, display:"flex", alignItems:"center", gap:8 }}>
            <PackageOpen size={20} color="#ff9d4d"/> Mod Manager
          </div>
          <div style={{ fontSize:11, color:"var(--dim)", marginTop:2 }}>
            MSFS 2020/2024 community mappa kezelő
          </div>
        </div>
        <div style={{ display:"flex", gap:6 }}>
          {folder && (
            <button className="btn-ghost" onClick={()=>py.openExternal(`file:///${folder.replace(/\\/g,"/")}`)}>
              <FolderOpen size={13}/> Megnyitás
            </button>
          )}
          {selected.size >= 2 && (
            <button className="btn-ghost" onClick={()=>{ setShowMerge(true); setShowAdd(false); }}
              style={{ color:"var(--pu)", borderColor:"rgba(167,139,250,.3)" }}>
              <GitMerge size={13}/> Összevon ({selected.size})
            </button>
          )}
          {folder && (
            <button className="btn-ghost" onClick={()=>{ setShowAdd(s=>!s); setShowMerge(false); }}
              style={{ color:"var(--gn)" }}>
              <Plus size={13}/> Hozzáadás
            </button>
          )}
          <button className="btn-ghost" onClick={()=>loadMods(folder)} disabled={!folder||loading}>
            <RefreshCw size={13} className={loading?"spin":""}/>
            Frissítés
          </button>
        </div>
      </div>

      {/* Folder selector */}
      <div className="card" style={{ padding:"10px 14px", display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
        <FolderOpen size={15} color="var(--dim)" style={{ flexShrink:0 }}/>
        <input className="inp" value={folder} onChange={e=>setFolder(e.target.value)}
          placeholder="C:\Users\...\Community"
          style={{ flex:1, fontSize:11, padding:"5px 8px", fontFamily:"monospace" }}
          onBlur={()=>folder&&loadMods(folder)}/>
        <button className="btn-ghost" onClick={detect} style={{ flexShrink:0 }}>
          Auto-detect
        </button>
      </div>

      {/* Add panel */}
      {showAdd && (
        <div className="card anim-down" style={{ padding:"12px 14px", border:"1px solid rgba(82,227,176,.25)",
          background:"rgba(82,227,176,.04)", flexShrink:0 }}>
          <div style={{ fontSize:11, fontWeight:700, color:"var(--gn)", marginBottom:8 }}>
            <Plus size={12}/> Mod hozzáadása
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <input className="inp" value={addPath} onChange={e=>setAddPath(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&addMod()}
              placeholder="C:\letöltések\valami-mod-mappa"
              style={{ flex:1, fontSize:11, padding:"6px 9px", fontFamily:"monospace" }}/>
            <button className="btn-primary" onClick={addMod} disabled={adding||!addPath.trim()}
              style={{ padding:"6px 16px", fontSize:12, flexShrink:0 }}>
              {adding ? <Loader2 size={13} className="spin"/> : <Check size={13}/>} Másol
            </button>
            <button className="btn-icon" onClick={()=>{ setShowAdd(false); setAddPath(""); }}>
              <X size={14}/>
            </button>
          </div>
          <div style={{ fontSize:10, color:"var(--dim)", marginTop:6 }}>
            A megadott mappa (neve szerint) bemásolódik a community mappába.
          </div>
        </div>
      )}

      {/* Merge panel */}
      {showMerge && selected.size >= 2 && (
        <div className="card anim-down" style={{ padding:"12px 14px", border:"1px solid rgba(167,139,250,.25)",
          background:"rgba(167,139,250,.04)", flexShrink:0 }}>
          <div style={{ fontSize:11, fontWeight:700, color:"var(--pu)", marginBottom:6 }}>
            <GitMerge size={12}/> {selected.size} mod összevonása
          </div>
          <div style={{ fontSize:10, color:"var(--dim)", marginBottom:8 }}>
            {(mods||[]).filter(m=>selected.has(m.folder)).map(m=>m.title).join(" + ")}
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <input className="inp" value={mergeName} onChange={e=>setMergeName(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&mergeMods()}
              placeholder="összevont-mod-neve"
              style={{ flex:1, fontSize:11, padding:"6px 9px", fontFamily:"monospace" }}/>
            <button className="btn-primary" onClick={mergeMods} disabled={merging||!mergeName.trim()}
              style={{ padding:"6px 16px", fontSize:12, flexShrink:0,
                background:"rgba(167,139,250,.2)", borderColor:"rgba(167,139,250,.5)", color:"var(--pu)" }}>
              {merging ? <Loader2 size={13} className="spin"/> : <GitMerge size={13}/>} Összevon
            </button>
            <button className="btn-icon" onClick={()=>{ setShowMerge(false); setMergeName(""); }}>
              <X size={14}/>
            </button>
          </div>
          <div style={{ fontSize:10, color:"var(--dim)", marginTop:6 }}>
            Az eredeti modok megmaradnak — ellenőrzés után törölheted őket.
          </div>
        </div>
      )}

      {/* Stats bar */}
      {mods !== null && (
        <div style={{ display:"flex", alignItems:"center", gap:16, fontSize:11, color:"var(--dim)", flexShrink:0 }}>
          <span><b style={{ color:"var(--tx)" }}>{mods.length}</b> total mod</span>
          <span><b style={{ color:"var(--gn)" }}>{enabledCount}</b> aktív</span>
          {disabledCount > 0 && <span><b style={{ color:"var(--rd)" }}>{disabledCount}</b> letiltva</span>}
          {selected.size > 0 && (
            <span style={{ cursor:"pointer" }} onClick={()=>setSelected(new Set())}>
              <b style={{ color:"var(--pu)" }}>{selected.size}</b> kijelölve
              <span style={{ color:"var(--dim)", marginLeft:4 }}>✕</span>
            </span>
          )}
          <div style={{ flex:1 }}/>
          {/* Filter chips */}
          <div style={{ display:"flex", gap:4 }}>
            {MOD_FILTERS.map(f => (
              <button key={f} className={`btn-pill ${filter===f?"active":""}`}
                onClick={()=>setFilter(f)} style={{ fontSize:10, padding:"3px 10px" }}>
                {f}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      {mods !== null && (
        <div style={{ position:"relative", flexShrink:0 }}>
          <Search size={13} style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"var(--dim)", pointerEvents:"none" }}/>
          <input className="inp" value={q} onChange={e=>setQ(e.target.value)}
            placeholder="Keresés név, creator, mappa alapján…"
            style={{ paddingLeft:30 }}/>
        </div>
      )}

      {/* Error */}
      {err && (
        <div className="card" style={{ padding:"10px 14px", border:"1px solid rgba(240,96,128,.3)",
          background:"rgba(240,96,128,.06)", color:"var(--rd)", fontSize:12, flexShrink:0 }}>
          {err}
        </div>
      )}

      {/* Empty/loading state */}
      {loading && !mods && (
        <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", color:"var(--dim)", gap:10 }}>
          <Loader2 size={20} className="spin"/> Betöltés…
        </div>
      )}

      {/* No folder */}
      {!loading && !mods && !err && (
        <div className="card" style={{ flex:1, display:"flex", flexDirection:"column",
          alignItems:"center", justifyContent:"center", gap:12, textAlign:"center" }}>
          <FolderOpen size={36} color="var(--dim)"/>
          <div style={{ fontSize:14, fontWeight:600 }}>MSFS community mappa</div>
          <div style={{ fontSize:12, color:"var(--dim)", maxWidth:320, lineHeight:1.6 }}>
            Kattints az <b>Auto-detect</b> gombra, vagy add meg kézzel az MSFS community mappa elérési útját.
          </div>
          <button className="btn-primary" onClick={detect}>
            <Search size={14}/> Auto-detect
          </button>
        </div>
      )}

      {/* Mod list */}
      {mods !== null && !loading && (
        <div style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column", gap:4 }}>
          {filtered.length === 0 && (
            <div className="card" style={{ padding:24, textAlign:"center", color:"var(--dim)", fontSize:12 }}>
              {q ? `Nincs találat: „${q}"` : "Nincs mod ebben a mappában."}
            </div>
          )}
          {filtered.map(mod => {
            const color = modBrandColor(mod.folder);
            const TypeIcon = modTypeIcon(mod.contentType);
            const isBusy = busy[mod.folder];
            const isSelected = selected.has(mod.folder);
            return (
              <div key={mod.folder} className="card"
                style={{ padding:"10px 12px", display:"flex", alignItems:"center", gap:10,
                  opacity: mod.enabled ? 1 : 0.5,
                  borderLeft: `3px solid ${isSelected ? "var(--pu)" : mod.enabled ? color : "var(--line)"}`,
                  background: isSelected ? "rgba(167,139,250,.06)" : undefined,
                }}>
                {/* Checkbox */}
                <input type="checkbox" checked={isSelected} onChange={()=>toggleSelect(mod.folder)}
                  style={{ accentColor:"var(--pu)", width:15, height:15, flexShrink:0, cursor:"pointer" }}/>
                {/* Icon */}
                <div style={{ width:32, height:32, borderRadius:8, flexShrink:0,
                  background: `${color}18`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <TypeIcon size={15} color={color}/>
                </div>

                {/* Info */}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:600, whiteSpace:"nowrap",
                    overflow:"hidden", textOverflow:"ellipsis" }}>
                    {mod.title}
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:2 }}>
                    {mod.creator && <span style={{ fontSize:10, color:"var(--dim)" }}>{mod.creator}</span>}
                    {mod.version && <span style={{ fontSize:10, color:"var(--dim)" }}>v{mod.version}</span>}
                    {mod.contentType && (
                      <span style={{ fontSize:9, fontWeight:700, letterSpacing:.5,
                        color:color, background:`${color}18`, borderRadius:4, padding:"1px 5px" }}>
                        {MOD_TYPE_LABELS[mod.contentType?.toUpperCase()] || mod.contentType}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize:9, color:"var(--p3)", marginTop:1, fontFamily:"monospace",
                    whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                    {mod.folder}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display:"flex", alignItems:"center", gap:4, flexShrink:0 }}>
                  {/* Delete */}
                  {delConfirm === mod.folder ? (
                    <div style={{ display:"flex", gap:3 }}>
                      <button className="btn-icon" onClick={()=>deleteMod(mod)} disabled={isBusy}
                        style={{ color:"var(--rd)" }} title="Biztos törlés">
                        <Check size={14}/>
                      </button>
                      <button className="btn-icon" onClick={()=>setDelConfirm(null)}
                        style={{ color:"var(--dim)" }} title="Mégsem">
                        <X size={14}/>
                      </button>
                    </div>
                  ) : (
                    <button className="btn-icon" onClick={()=>setDelConfirm(mod.folder)}
                      title="Törlés" style={{ color:"var(--dim)" }}>
                      <Trash2 size={14}/>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
