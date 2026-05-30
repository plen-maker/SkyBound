import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { initializeApp, getApps } from "firebase/app";
import { getDatabase, ref, onValue, set, push, remove, update } from "firebase/database";
import {
  Plane, Map as MapIcon, FileText, Bell, Link2, Settings as Cog, BookOpen,
  Music, MessageCircle, Globe, Radar, Navigation2, Wifi, WifiOff, Smartphone,
  Plus, Trash2, ChevronRight, ChevronLeft, Users, Weight, Fuel, ArrowDownRight,
  Loader2, AlertCircle, Gamepad2, ExternalLink, Chrome, Check, Download,
  RefreshCw, LogOut, ArrowRight,
} from "lucide-react";

const FB_CONFIG = {
  apiKey: "AIzaSyAxHmLWOIJl4xC44uHsRbxqzRhF4mA0kqE",
  authDomain: "simapp-99f40.firebaseapp.com",
  databaseURL: "https://simapp-99f40-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "simapp-99f40",
  storageBucket: "simapp-99f40.firebasestorage.app",
  messagingSenderId: "993511543138",
  appId: "1:993511543138:web:ec3a0d3e19713160111c3b",
};
let _db;
function getDB() {
  if (!_db) { const a = getApps().length ? getApps()[0] : initializeApp(FB_CONFIG); _db = getDatabase(a); }
  return _db;
}

const ls = {
  get: (k, d=null) => { try { const v=localStorage.getItem(k); return v!=null?JSON.parse(v):d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

const openUrl = (url, inApp=false) => {
  if (!url) return;
  if (inApp && window.skybound?.openInApp) { window.skybound.openInApp(url); return; }
  window.skybound?.openExternal(url) ?? window.open(url, "_blank");
};

/* ═══════════════════════════════════════════ UPDATER HOOK ═══════════════════ */
function useUpdater() {
  const [state, setState] = useState("idle"); // idle|checking|latest|available|downloading|ready
  const [info, setInfo]   = useState(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    window.skybound?.onUpdater((event, data) => {
      if (event==="checking")   { setState("checking"); }
      if (event==="latest")     { setState("latest"); setTimeout(()=>setState("idle"),3000); }
      if (event==="available")  { setState("available"); setInfo(data); }
      if (event==="progress")   { setState("downloading"); setProgress(Math.round(data.percent||0)); }
      if (event==="ready")      { setState("ready"); setInfo(data); }
    });
    // check on mount
    setTimeout(() => window.skybound?.checkUpdate(), 3000);
  }, []);

  const download = () => { setState("downloading"); window.skybound?.downloadUpdate(); };
  const install  = () => window.skybound?.installUpdate();
  const openRel  = () => window.skybound?.openRelease(info?.releaseUrl);

  return { state, info, progress, download, install, openRel };
}

/* ═══════════════════════════════════════════ AUTH ══════════════════════════ */
function useAuth() {
  const [user, setUser] = useState(() => ls.get("sb_user"));
  useEffect(() => {
    window.skybound?.onAuthSuccess(u => { setUser(u); ls.set("sb_user", u); });
  }, []);
  const login  = () => window.skybound?.openAuth();
  const logout = () => { setUser(null); ls.set("sb_user", null); };
  return { user, login, logout };
}

/* ═══════════════════════════════════════════ TABS ══════════════════════════ */
const TABS = [
  { id:"home",        label:"Home",     icon:Plane },
  { id:"map",         label:"Map",      icon:MapIcon },
  { id:"ofp",         label:"SimBrief", icon:FileText },
  { id:"alerts",      label:"Alerts",   icon:Bell },
  { id:"bind",        label:"Bind",     icon:Link2 },
  { id:"controllers", label:"Controls", icon:Gamepad2 },
  { id:"settings",    label:"Settings", icon:Cog },
];

const SHORTCUTS = [
  { id:"fenix",     label:"Fenix EFB",  sub:"IP:8080",    icon:Plane,         color:"#5ec8ff", urlKey:"fenixUrl" },
  { id:"navigraph", label:"Navigraph",  sub:"Charts",     icon:MapIcon,       color:"#7c8cff", url:"https://charts.navigraph.com" },
  { id:"vatsim",    label:"VATSIM",     sub:"Radar",      icon:Radar,         color:"#52e3b0", url:"https://radar.vatsim.net" },
  { id:"simbrief",  label:"SimBrief",   sub:"Dispatch",   icon:FileText,      color:"#ffb454", url:"https://dispatch.simbrief.com" },
  { id:"spotify",   label:"Spotify",    sub:"Music",      icon:Music,         color:"#52e37a", url:"https://open.spotify.com" },
  { id:"ytmusic",   label:"YT Music",   sub:"Music",      icon:Music,         color:"#ff6b6b", url:"https://music.youtube.com" },
  { id:"discord",   label:"Discord",    sub:"Crew",       icon:MessageCircle, color:"#7c8cff", url:"https://discord.com/app" },
  { id:"skybound",  label:"Skybound",   sub:"skybound.cx",icon:Globe,         color:"#5ec8ff", url:"https://skybound.cx" },
];

const KNOWN_CONTROLLERS = {
  "TCA Sidestick Airbus Edition":  { axes:["Roll","Pitch","Throttle","Rudder"] },
  "TCA Captain Pack X Airbus":     { axes:["Roll","Pitch","Throttle L","Throttle R","Rudder","Tiller","Flaps"] },
  "Honeycomb Alpha Flight Controls":{ axes:["Ailerons","Elevator"] },
};

/* ═══════════════════════════════════════════ CSS ════════════════════════════ */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700&family=Chivo:wght@400;500&family=Azeret+Mono:wght@500;600&display=swap');
*{box-sizing:border-box;}
.efb{--bg:#070b12;--panel:#0d1520;--p2:#111c2b;--line:#1a2a3d;--cy:#5ec8ff;--am:#ffb454;--gn:#52e3b0;--rd:#f06080;--tx:#cdd9ec;--dim:#5a7090;font-family:'Chivo',sans-serif;color:var(--tx);}
.mono{font-family:'Azeret Mono',monospace;font-variant-numeric:tabular-nums;}
.disp{font-family:'Sora',sans-serif;}
.spring{transition:transform .38s cubic-bezier(.34,1.56,.64,1),box-shadow .22s,border-color .22s;}
.spring:hover{transform:translateY(-3px) scale(1.025);box-shadow:0 12px 32px -10px rgba(94,200,255,.18);}
.spring:active{transform:scale(.97);transition-duration:.1s;}
.tab-in{animation:tabIn .3s cubic-bezier(.34,1.2,.64,1);}
@keyframes tabIn{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}
.fade-up{animation:fadeUp .38s cubic-bezier(.2,.9,.4,1) both;}
@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
.slide-in{animation:slideIn .3s cubic-bezier(.34,1.2,.64,1) both;}
@keyframes slideIn{from{opacity:0;transform:translateX(-14px)}to{opacity:1;transform:none}}
.pop{animation:pop .3s cubic-bezier(.34,1.56,.64,1) both;}
@keyframes pop{from{opacity:0;transform:scale(.82)}to{opacity:1;transform:scale(1)}}
.spin{animation:sp 1s linear infinite;}@keyframes sp{to{transform:rotate(360deg)}}
.pulse-dot{animation:pd 2s ease-in-out infinite;}@keyframes pd{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1.2)}}
.glow{box-shadow:0 0 0 1px var(--line),0 16px 36px -18px rgba(0,0,0,.85);}
.navbtn{transition:background .18s,color .18s,transform .18s cubic-bezier(.34,1.56,.64,1);cursor:pointer;}
.navbtn:hover{background:var(--p2);transform:scale(1.06);}
.navbtn:active{transform:scale(.94);}
.tile{border:1px solid var(--line);cursor:pointer;}
.tile:hover{border-color:var(--cy);}
.tile.off{opacity:.45;pointer-events:none;}
input,select{outline:none;}
input:focus,select:focus{border-color:var(--cy)!important;box-shadow:0 0 0 3px rgba(94,200,255,.12);}
::-webkit-scrollbar{width:5px;}::-webkit-scrollbar-thumb{background:var(--line);border-radius:99px;}
.axis-bar{transition:width .12s ease;}
.chip{transition:background .15s,color .15s,transform .12s cubic-bezier(.34,1.56,.64,1);cursor:pointer;}
.chip:hover{transform:scale(1.06);}
.chip:active{transform:scale(.94);}
.update-bar{animation:slideDown .4s cubic-bezier(.34,1.2,.64,1);}
@keyframes slideDown{from{opacity:0;transform:translateY(-100%)}to{opacity:1;transform:none}}
`;

/* ═══════════════════════════════════════════ LOGIN SCREEN ══════════════════ */
function LoginScreen({ onLogin }) {
  return (
    <div className="efb" style={{ height:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"var(--bg)",gap:20 }}>
      <style>{CSS}</style>
      <div className="pop" style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:20 }}>
        <div className="disp" style={{ width:64,height:64,borderRadius:18,background:"linear-gradient(135deg,#5ec8ff,#7c8cff)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 6px 28px rgba(94,200,255,.4)" }}>
          <Navigation2 size={28} color="#070b12"/>
        </div>
        <div style={{ textAlign:"center" }}>
          <div className="disp" style={{ fontSize:28,fontWeight:700 }}>SKYBOUND <span style={{ color:"var(--cy)" }}>EFB</span></div>
          <div style={{ color:"var(--dim)",fontSize:13,marginTop:4 }}>Electronic Flight Bag · MSFS</div>
        </div>
        <button onClick={onLogin} className="spring flex items-center gap-3 rounded-2xl px-6 py-3.5"
          style={{ background:"#fff",color:"#1a1a1a",border:"none",fontSize:15,fontWeight:700,cursor:"pointer",marginTop:8 }}>
          <GoogleIcon/>
          Belépés Google-lel
        </button>
        <div style={{ fontSize:11,color:"var(--dim)",textAlign:"center",maxWidth:260,lineHeight:1.6 }}>
          A Google-fiókod köti össze a desktop appot a telefonnal és a sim bridge-gel.
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48">
      <path fill="#4285F4" d="M45 24c0-1.6-.1-2.7-.4-3.9H24v7.4h12c-.2 1.9-1.6 4.8-4.5 6.7l6.6 5.1C42 35.6 45 30.4 45 24z"/>
      <path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.3l-6.6-5.1c-1.8 1.2-4.2 2-7.9 2-6 0-11.2-4-13-9.6l-6.8 5.3C8 41 15.4 46 24 46z"/>
      <path fill="#FBBC05" d="M11 28c-.5-1.4-.7-2.9-.7-4s.2-2.6.7-4l-6.8-5.3C2.8 17.4 2 20.6 2 24s.8 6.6 2.2 9.3L11 28z"/>
      <path fill="#EA4335" d="M24 9.5c3.3 0 5.5 1.4 6.8 2.6l5.8-5.7C33 3 28.9 1 24 1 15.4 1 8 6 4.2 14.7L11 20c1.8-5.6 7-10.5 13-10.5z"/>
    </svg>
  );
}

/* ═══════════════════════════════════════════ UPDATE BANNER ═════════════════ */
function UpdateBanner({ updater }) {
  const { state, info, progress, download, install, openRel } = updater;
  if (state==="idle"||state==="latest"||state==="checking") return null;

  const bg = state==="ready" ? "rgba(82,227,176,.08)" : "rgba(255,180,84,.08)";
  const border = state==="ready" ? "rgba(82,227,176,.25)" : "rgba(255,180,84,.25)";
  const color  = state==="ready" ? "var(--gn)" : "var(--am)";

  return (
    <div className="update-bar flex items-center justify-between px-5 py-2.5"
      style={{ background:bg, borderBottom:`1px solid ${border}`, flexShrink:0 }}>
      <div className="flex items-center gap-2" style={{ fontSize:12.5, color }}>
        {state==="downloading"
          ? <><Loader2 size={14} className="spin"/>Letöltés… {progress}%</>
          : state==="ready"
          ? <><Check size={14}/>v{info?.version} letöltve — készen áll a telepítésre</>
          : <><Download size={14}/>Új verzió elérhető: v{info?.version}</>}
      </div>
      <div className="flex items-center gap-2">
        {state==="available" && (
          <>
            <button onClick={download} className="chip rounded-full px-3 py-1"
              style={{ background:"var(--am)",color:"#070b12",fontSize:11,fontWeight:700 }}>
              Letöltés
            </button>
            <button onClick={openRel} className="chip rounded-full px-3 py-1"
              style={{ background:"var(--p2)",color:"var(--dim)",fontSize:11,border:"1px solid var(--line)" }}>
              Release notes
            </button>
          </>
        )}
        {state==="ready" && (
          <button onClick={install} className="chip rounded-full px-3 py-1"
            style={{ background:"var(--gn)",color:"#070b12",fontSize:11,fontWeight:700 }}>
            Újraindítás & Telepítés
          </button>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════ MAIN APP ══════════════════════ */
export default function SkyBoundEFB() {
  const { user, login, logout } = useAuth();
  const updater = useUpdater();

  if (!user) return <LoginScreen onLogin={login}/>;

  return <AppShell user={user} onLogout={logout} updater={updater}/>;
}

function AppShell({ user, onLogout, updater }) {
  const [tab, setTab] = useState("home");
  const [showTut, setShowTut] = useState(ls.get("sb_tut_seen")!==true);

  const [settings, setSettings] = useState(() => ({
    sbUser:"", fenixUrl:"", sessionCode:"ddnemet-host", openLinksInApp:false,
    ...ls.get("sb_settings", {}),
  }));
  const saveSetting = useCallback((key, val) => {
    setSettings(prev => { const n={...prev,[key]:val}; ls.set("sb_settings",n); window.skybound?.saveSettings?.(n); return n; });
  }, []);

  // RTDB live data
  const [live, setLive] = useState(null);
  const [rtdbOk, setRtdbOk] = useState(false);
  useEffect(() => {
    if (!settings.sessionCode) return;
    const db=getDB();
    const u1=onValue(ref(db,`sessions/${settings.sessionCode}/live`), s=>setLive(s.val()));
    const u2=onValue(ref(db,".info/connected"), s=>setRtdbOk(s.val()===true));
    return()=>{u1();u2();};
  }, [settings.sessionCode]);

  // SimBrief
  const [ofp,setOfp]=useState(null);
  const [ofpState,setOfpState]=useState("idle");
  const [ofpErr,setOfpErr]=useState("");
  const loadOFP=useCallback(async(u=settings.sbUser)=>{
    const un=(u||"").trim(); if(!un){setOfpState("error");setOfpErr("Adj meg SimBrief usernevet.");return;}
    setOfpState("loading");setOfpErr("");
    const r=await(window.skybound?.fetchOFP?.(un)??Promise.resolve({error:"csak Electronban"}));
    if(r?.error){setOfpState("error");setOfpErr(r.error);}
    else{setOfp(r.ofp);setOfpState("idle");saveSetting("sbUser",un);}
  },[settings.sbUser,saveSetting]);
  useEffect(()=>{if(settings.sbUser)loadOFP(settings.sbUser);},[]);

  // Triggers
  const [triggers,setTriggers]=useState([]);
  useEffect(()=>{
    if(!settings.sessionCode)return;
    return onValue(ref(getDB(),`sessions/${settings.sessionCode}/triggers`),s=>{
      const v=s.val(); setTriggers(v?Object.entries(v).map(([id,d])=>({id,...d})):[]);
    });
  },[settings.sessionCode]);
  const addTrigger=t=>push(ref(getDB(),`sessions/${settings.sessionCode}/triggers`),{armed:true,...t});
  const delTrigger=id=>remove(ref(getDB(),`sessions/${settings.sessionCode}/triggers/${id}`));
  const togTrigger=(id,armed)=>update(ref(getDB(),`sessions/${settings.sessionCode}/triggers/${id}`),{armed});

  // Gamepads
  const [gamepads,setGamepads]=useState([]);
  useEffect(()=>{
    const t=setInterval(()=>setGamepads(Array.from(navigator.getGamepads?.()??[]).filter(Boolean).map(g=>({
      id:g.id,index:g.index,axes:Array.from(g.axes).map((v,i)=>({index:i,value:v})),buttons:g.buttons.length,
    }))),200);
    return()=>clearInterval(t);
  },[]);
  const [axisMap,setAxisMap]=useState(()=>ls.get("sb_axes",{}));
  const saveAxis=(gpId,axisIdx,label)=>{const n={...axisMap,[`${gpId}:${axisIdx}`]:label};setAxisMap(n);ls.set("sb_axes",n);};

  const shortcuts=useMemo(()=>SHORTCUTS.map(s=>({...s,resolvedUrl:s.urlKey?settings[s.urlKey]:s.url,disabled:s.urlKey?!settings[s.urlKey]:false})),[settings]);
  const inApp=settings.openLinksInApp;
  const open=(url)=>openUrl(url,inApp);

  return (
    <div className="efb" style={{ height:"100vh",display:"flex",flexDirection:"column",background:"var(--bg)",overflow:"hidden" }}>
      <style>{CSS}</style>

      {/* Update banner */}
      <UpdateBanner updater={updater}/>

      {/* Title bar */}
      <div className="flex items-center justify-between px-5" style={{ height:56,borderBottom:"1px solid var(--line)",background:"rgba(13,21,32,.92)",backdropFilter:"blur(20px)",WebkitAppRegion:"drag",flexShrink:0 }}>
        <div className="flex items-center gap-3" style={{ WebkitAppRegion:"no-drag" }}>
          <div style={{ width:34,height:34,borderRadius:10,background:"linear-gradient(135deg,#5ec8ff,#7c8cff)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 3px 14px rgba(94,200,255,.32)" }}>
            <Navigation2 size={17} color="#070b12"/>
          </div>
          <div>
            <div className="disp" style={{ fontWeight:700,fontSize:14,letterSpacing:.4 }}>SKYBOUND <span style={{ color:"var(--cy)" }}>EFB</span></div>
            <div className="mono" style={{ fontSize:10,color:"var(--dim)" }}>{ofp?`${ofp.dep||"?"}→${ofp.arr||"?"}`:"nincs OFP"} · {settings.sessionCode}</div>
          </div>
        </div>
        <div className="flex items-center gap-4" style={{ WebkitAppRegion:"no-drag" }}>
          <Readout label="GS"  value={live?Math.round(live.gsKt):null}               unit="kt"/>
          <Readout label="ALT" value={live?Math.round(live.altFt).toLocaleString():null} unit="ft"/>
          <Readout label="UTC" value={new Date().toUTCString().slice(17,22)}          unit="z"/>
          <div className="flex items-center gap-2 pl-3" style={{ borderLeft:"1px solid var(--line)" }}>
            <StatusPill ok={rtdbOk&&!!live} on={<><Wifi size={11}/>SIM</>} off={<><WifiOff size={11}/>SIM</>}/>
          </div>
          {/* User avatar */}
          <div className="flex items-center gap-2 pl-3" style={{ borderLeft:"1px solid var(--line)" }}>
            {user.photoURL
              ? <img src={user.photoURL} style={{ width:26,height:26,borderRadius:"50%",border:"1px solid var(--line)" }}/>
              : <div style={{ width:26,height:26,borderRadius:"50%",background:"var(--cy)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:"#070b12" }}>{user.displayName?.[0]||"?"}</div>}
            <button onClick={onLogout} className="navbtn rounded-lg p-1.5" style={{ color:"var(--dim)" }} title="Kijelentkezés">
              <LogOut size={14}/>
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-1" style={{ overflow:"hidden" }}>
        {/* Sidebar */}
        <div className="flex flex-col py-3 px-2 gap-0.5" style={{ width:88,borderRight:"1px solid var(--line)",background:"rgba(13,21,32,.7)",backdropFilter:"blur(12px)",flexShrink:0 }}>
          {TABS.map((t,i)=>{
            const I=t.icon,active=tab===t.id;
            return(
              <div key={t.id} onClick={()=>setTab(t.id)} className="navbtn flex flex-col items-center gap-1 rounded-xl py-2.5 slide-in"
                style={{ animationDelay:`${i*25}ms`,background:active?"var(--p2)":"transparent",color:active?"var(--cy)":"var(--dim)",border:active?"1px solid var(--line)":"1px solid transparent" }}>
                <I size={17}/><span style={{ fontSize:9,letterSpacing:.5,fontWeight:600 }}>{t.label}</span>
              </div>
            );
          })}
          <div onClick={()=>setShowTut(true)} className="navbtn flex flex-col items-center gap-1 rounded-xl py-2 mt-auto" style={{ color:"var(--dim)" }}>
            <BookOpen size={15}/><span style={{ fontSize:9 }}>Help</span>
          </div>
        </div>

        {/* Main */}
        <div key={tab} className="flex-1 overflow-auto tab-in" style={{ padding:18,background:"radial-gradient(ellipse at 0% 0%,rgba(94,200,255,.025),transparent 60%)" }}>
          {tab==="home"        && <HomeTab live={live} ofp={ofp} shortcuts={shortcuts} open={open} inApp={inApp}/>}
          {tab==="map"         && <div className="rounded-2xl overflow-hidden glow" style={{ border:"1px solid var(--line)",height:"calc(100vh - 140px)" }}><MiniMap ofp={ofp} live={live} big/></div>}
          {tab==="ofp"         && <OFPTab sbUser={settings.sbUser} setSbUser={v=>saveSetting("sbUser",v)} ofp={ofp} state={ofpState} error={ofpErr} onLoad={loadOFP}/>}
          {tab==="alerts"      && <AlertsTab triggers={triggers} onAdd={addTrigger} onDel={delTrigger} onToggle={togTrigger} ofp={ofp} live={live}/>}
          {tab==="bind"        && <BindTab sessionCode={settings.sessionCode} live={live} rtdbOk={rtdbOk} user={user}/>}
          {tab==="controllers" && <ControllersTab gamepads={gamepads} axisMap={axisMap} onSave={saveAxis}/>}
          {tab==="settings"    && <SettingsTab settings={settings} saveSetting={saveSetting} onLoadOFP={()=>loadOFP()} updater={updater}/>}
        </div>
      </div>

      {showTut && <Tutorial onClose={()=>{setShowTut(false);ls.set("sb_tut_seen",true);}}/>}
    </div>
  );
}

/* ═══════════════════════════════ ATOMS ══════════════════════════════════════ */
function Readout({label,value,unit}){return(<div className="text-right"><div style={{fontSize:9,color:"var(--dim)",letterSpacing:1,textTransform:"uppercase"}}>{label}</div><div className="mono" style={{fontSize:14,color:value==null?"var(--dim)":"var(--tx)"}}>{value??"—"}<span style={{fontSize:9,color:"var(--dim)",marginLeft:2}}>{value!=null?unit:""}</span></div></div>);}
function StatusPill({ok,on,off}){return(<div className="flex items-center gap-1 rounded-full px-2 py-1" style={{fontSize:10,background:ok?"rgba(82,227,176,.1)":"rgba(90,112,144,.08)",color:ok?"#52e3b0":"var(--dim)",border:`1px solid ${ok?"rgba(82,227,176,.25)":"rgba(90,112,144,.2)"}`}}>{ok?<><span className="pulse-dot" style={{width:5,height:5,borderRadius:"50%",background:"#52e3b0",display:"inline-block"}}/>{on}</>:off}</div>);}
function SLabel({children}){return <div className="disp" style={{fontSize:10.5,fontWeight:700,letterSpacing:1.6,textTransform:"uppercase",color:"var(--dim)",marginBottom:8}}>{children}</div>;}
function LRow({icon:I,label,value}){return(<div className="flex items-center justify-between py-1.5" style={{borderBottom:"1px solid var(--line)"}}><span className="flex items-center gap-2" style={{fontSize:12}}><I size={12} color="var(--dim)"/>{label}</span><span className="mono" style={{fontSize:12.5,color:value==null?"var(--dim)":"var(--tx)"}}>{value??"—"}</span></div>);}
function Card({children,delay=0,style={}}){return <div className="rounded-2xl p-4 glow fade-up" style={{background:"var(--panel)",border:"1px solid var(--line)",animationDelay:`${delay}ms`,...style}}>{children}</div>;}

/* ═══════════════════════════════ HOME ═══════════════════════════════════════ */
function HomeTab({live,ofp,shortcuts,open,inApp}){
  return(
    <div className="flex flex-col gap-4">
      {!live&&<div className="flex items-center gap-2 rounded-xl px-3 py-2.5 fade-up" style={{background:"rgba(255,180,84,.06)",border:"1px solid rgba(255,180,84,.18)",color:"var(--am)",fontSize:12.5}}><AlertCircle size={14}/>Sim bridge nincs csatlakoztatva — élő adatok a bridge futásakor jelennek meg.</div>}
      <div className="grid grid-cols-4 gap-3">
        {[["Dest ETE",live?Math.floor(live.destEteMin/60)+":"+String(Math.round(live.destEteMin)%60).padStart(2,"0"):null,"","var(--cy)"],
          ["GS",live?Math.round(live.gsKt):null,"kt",null],
          ["ALT",live?Math.round(live.altFt).toLocaleString():null,"ft",null],
          ["V/S",live?Math.round(live.vsFpm):null,"fpm",live?.vsFpm<-200?"var(--am)":null]
        ].map(([l,v,u,a],i)=>(
          <div key={l} className="rounded-xl p-3 glow fade-up" style={{background:"var(--p2)",border:"1px solid var(--line)",animationDelay:`${i*45}ms`}}>
            <div style={{fontSize:10,color:"var(--dim)",letterSpacing:1,textTransform:"uppercase"}}>{l}</div>
            <div className="mono" style={{fontSize:22,marginTop:2,color:v==null?"var(--dim)":(a||"var(--tx)")}}>{v??"—"}<span style={{fontSize:11,color:"var(--dim)",marginLeft:3}}>{v!=null?u:""}</span></div>
          </div>
        ))}
      </div>
      <div>
        <SLabel>Shortcuts</SLabel>
        <div className="grid grid-cols-4 gap-3">
          {shortcuts.map((s,i)=>{const I=s.icon;return(
            <div key={s.id} className={`spring tile rounded-2xl p-3 glow fade-up ${s.disabled?"off":""}`}
              style={{background:"var(--panel)",animationDelay:`${i*30}ms`}} onClick={()=>!s.disabled&&open(s.resolvedUrl)}>
              <div className="flex items-center justify-between mb-2">
                <div style={{width:36,height:36,borderRadius:10,background:"var(--p2)",border:"1px solid var(--line)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <I size={17} color={s.color}/>
                </div>
                {inApp?<Chrome size={11} color="var(--dim)"/>:<ExternalLink size={11} color="var(--dim)"/>}
              </div>
              <div className="disp" style={{fontSize:12.5,fontWeight:600}}>{s.label}</div>
              <div className="mono" style={{fontSize:10,color:"var(--dim)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.disabled?"állítsd be ▸":s.sub}</div>
            </div>
          );})}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2 rounded-2xl overflow-hidden glow" style={{border:"1px solid var(--line)",height:190}}>
          <MiniMap ofp={ofp} live={live}/>
        </div>
        <Card>
          <SLabel>Load · SimBrief</SLabel>
          {ofp?(<>
            <LRow icon={Users} label="PAX" value={ofp.pax}/>
            <LRow icon={Weight} label="Payload" value={ofp.payload!=null?`${ofp.payload} ${ofp.units}`:null}/>
            <LRow icon={Fuel} label="Block" value={ofp.blockFuel!=null?`${ofp.blockFuel} ${ofp.units}`:null}/>
            <LRow icon={Weight} label="ZFW" value={ofp.zfw!=null?`${ofp.zfw} ${ofp.units}`:null}/>
            <LRow icon={ArrowDownRight} label="CI" value={ofp.costindex}/>
          </>):(<div style={{fontSize:12,color:"var(--dim)",lineHeight:1.6}}>Nincs OFP. Add meg a SimBrief usernevet.</div>)}
        </Card>
      </div>
    </div>
  );
}

/* ═══════════════════════════════ MAP ════════════════════════════════════════ */
function MiniMap({ofp,live,big}){
  const W=1000,H=big?560:380;
  const fixes=(ofp?.fixes||[]).filter(f=>f.lat!=null);
  if(!fixes.length&&!live)return(<div style={{width:"100%",height:"100%",background:"radial-gradient(ellipse at 30% 20%,#14233a,#0a121e 60%,#070b12)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:10,color:"var(--dim)"}}><MapIcon size={26} color="#1e3a5f"/><span style={{fontSize:12.5}}>Nincs OFP / bridge</span></div>);
  const pts=[...fixes,...(live?[{lat:live.lat,lon:live.lon}]:[])];
  const lats=pts.map(p=>p.lat),lons=pts.map(p=>p.lon);
  const mnLat=Math.min(...lats),mxLat=Math.max(...lats),mnLon=Math.min(...lons),mxLon=Math.max(...lons);
  const pad=70;
  const sx=lon=>pad+(mxLon===mnLon?.5:(lon-mnLon)/(mxLon-mnLon))*(W-2*pad);
  const sy=lat=>pad+(mxLat===mnLat?.5:1-(lat-mnLat)/(mxLat-mnLat))*(H-2*pad);
  const route=fixes.map(f=>`${sx(f.lon)},${sy(f.lat)}`).join(" ");
  return(<svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:"100%",display:"block",background:"radial-gradient(ellipse at 30% 20%,#14233a,#0a121e 60%,#070b12)"}}>
    {Array.from({length:11}).map((_,i)=><line key={"v"+i} x1={i*W/10} y1={0} x2={i*W/10} y2={H} stroke="#5ec8ff" strokeOpacity=".04"/>)}
    {Array.from({length:8}).map((_,i)=><line key={"h"+i} x1={0} y1={i*H/7} x2={W} y2={i*H/7} stroke="#5ec8ff" strokeOpacity=".04"/>)}
    {fixes.length>1&&<polyline points={route} fill="none" stroke="#5ec8ff" strokeOpacity=".45" strokeWidth="2.5" strokeDasharray="7 5"/>}
    {fixes.map((f,i)=>(<g key={f.ident+i}><circle cx={sx(f.lon)} cy={sy(f.lat)} r={i===0||i===fixes.length-1?6:4} fill={i===0||i===fixes.length-1?"#5ec8ff":"#3a7aaa"} stroke="#5ec8ff" strokeWidth={i===0||i===fixes.length-1?"1.5":"0"}/>{(i===0||i===fixes.length-1||i%Math.max(1,Math.floor(fixes.length/8))===0)&&<text x={sx(f.lon)+9} y={sy(f.lat)+4} fill="#8fafe0" fontSize="12" fontFamily="Azeret Mono,monospace">{f.ident}</text>}</g>))}
    {live&&(<g transform={`translate(${sx(live.lon)},${sy(live.lat)})`}><circle r={16} fill="rgba(94,200,255,.07)" stroke="rgba(94,200,255,.2)" strokeWidth="1"/><path d="M0,-12 L8,10 L0,5 L-8,10 Z" fill="#fff" stroke="#5ec8ff" strokeWidth="1.5" style={{filter:"drop-shadow(0 0 7px #5ec8ff)"}}/></g>)}
  </svg>);
}

/* ═══════════════════════════════ OFP ════════════════════════════════════════ */
function OFPTab({sbUser,setSbUser,ofp,state,error,onLoad}){
  return(<div className="flex flex-col gap-4">
    <SLabel>SimBrief OFP</SLabel>
    <Card>
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <div style={{fontSize:10,color:"var(--dim)",letterSpacing:1,marginBottom:6}}>SIMBRIEF USERNÉV</div>
          <input value={sbUser} onChange={e=>setSbUser(e.target.value)} placeholder="pl. chris_vatsim" onKeyDown={e=>e.key==="Enter"&&onLoad(sbUser)}
            style={{background:"var(--p2)",border:"1px solid var(--line)",color:"var(--tx)",fontSize:13,borderRadius:8,padding:"8px 10px",width:"100%",fontFamily:"Azeret Mono,monospace"}}/>
        </div>
        <button onClick={()=>onLoad(sbUser)} className="spring flex items-center gap-2 rounded-xl px-5 py-2.5"
          style={{background:"var(--cy)",color:"#070b12",fontSize:13,fontWeight:700,flexShrink:0}}>
          {state==="loading"?<Loader2 size={14} className="spin"/>:<><FileText size={13}/>Betölt</>}
        </button>
      </div>
    </Card>
    {state==="error"&&<div className="flex items-center gap-2 rounded-xl px-3 py-2 pop" style={{background:"rgba(240,96,128,.08)",border:"1px solid rgba(240,96,128,.25)",color:"var(--rd)",fontSize:13}}><AlertCircle size={14}/>{error}</div>}
    {ofp&&(<>
      <div className="grid grid-cols-4 gap-3">
        {[["Route",`${ofp.dep||"?"}→${ofp.arr||"?"}`],["PAX",ofp.pax??"—"],["Payload",ofp.payload!=null?`${ofp.payload} ${ofp.units}`:"—"],["Block",ofp.blockFuel!=null?`${ofp.blockFuel} ${ofp.units}`:"—"]].map(([l,v],i)=>(
          <div key={l} className="rounded-xl p-3 glow fade-up" style={{background:"var(--p2)",border:"1px solid var(--line)",animationDelay:`${i*35}ms`}}>
            <div style={{fontSize:10,color:"var(--dim)",letterSpacing:1}}>{l.toUpperCase()}</div>
            <div className="mono" style={{fontSize:17,marginTop:2}}>{v}</div>
          </div>
        ))}
      </div>
      <Card><div style={{fontSize:10,color:"var(--dim)",marginBottom:6,letterSpacing:1}}>ROUTE</div><div className="mono" style={{fontSize:12.5,lineHeight:1.8,wordBreak:"break-all"}}>{ofp.route||"—"}</div></Card>
      <div className="rounded-2xl overflow-hidden glow" style={{border:"1px solid var(--line)"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontFamily:"Azeret Mono,monospace",fontSize:12}}>
          <thead><tr style={{color:"var(--dim)",textAlign:"left",background:"var(--p2)"}}><th style={{padding:"8px 12px"}}>FIX</th><th style={{padding:"8px 12px"}}>STAGE</th><th style={{padding:"8px 12px"}}>ALT ft</th></tr></thead>
          <tbody>{ofp.fixes.map((f,i)=>(<tr key={f.ident+i} style={{borderTop:"1px solid var(--line)"}}><td style={{padding:"6px 12px",color:"var(--cy)"}}>{f.ident}</td><td style={{padding:"6px 12px",color:"var(--dim)"}}>{f.stage||"—"}</td><td style={{padding:"6px 12px"}}>{f.altitude??"—"}</td></tr>))}</tbody>
        </table>
      </div>
    </>)}
  </div>);
}

/* ═══════════════════════════════ ALERTS ════════════════════════════════════ */
function AlertsTab({triggers,onAdd,onDel,onToggle,ofp,live}){
  const [kind,setKind]=useState("fix");const [fix,setFix]=useState("");const [lead,setLead]=useState("5");
  const fixOpts=ofp?.fixes?.map(f=>f.ident)||[];
  const add=()=>{if(kind==="fix"&&!fix)return;onAdd({kind,lead:Number(lead)||5,...(kind==="fix"?{fix:fix.toUpperCase()}:{})});};
  return(<div className="flex flex-col gap-4">
    <SLabel>Push triggers</SLabel>
    {!live&&<div className="flex items-center gap-2 rounded-xl px-3 py-2.5 fade-up" style={{background:"rgba(255,180,84,.06)",border:"1px solid rgba(255,180,84,.18)",color:"var(--am)",fontSize:12.5}}><AlertCircle size={14}/>Csak élő bridge-del tüzelnek.</div>}
    <Card>
      <div className="flex gap-2 mb-3">
        {[["fix","Fix"],["tod","T/D"],["dest","Landing"]].map(([k,l])=>(
          <button key={k} onClick={()=>setKind(k)} className="chip rounded-full px-4 py-1.5"
            style={{fontSize:12,fontWeight:600,background:kind===k?"var(--cy)":"var(--p2)",color:kind===k?"#070b12":"var(--dim)",border:"1px solid var(--line)"}}>{l}</button>
        ))}
      </div>
      <div className="flex items-end gap-3">
        {kind==="fix"&&(<div className="flex-1"><div style={{fontSize:10,color:"var(--dim)",marginBottom:5,letterSpacing:1}}>FIX</div>
          {fixOpts.length
            ?<select value={fix} onChange={e=>setFix(e.target.value)} style={{background:"var(--p2)",border:"1px solid var(--line)",color:"var(--tx)",fontSize:13,borderRadius:8,padding:"8px 10px",width:"100%"}}>
              <option value="">— válassz —</option>{fixOpts.map(f=><option key={f} value={f}>{f}</option>)}</select>
            :<input value={fix} onChange={e=>setFix(e.target.value)} placeholder="VETIK"
              style={{background:"var(--p2)",border:"1px solid var(--line)",color:"var(--tx)",fontSize:13,borderRadius:8,padding:"8px 10px",width:"100%",fontFamily:"Azeret Mono,monospace"}}/>}
        </div>)}
        <div style={{width:100}}><div style={{fontSize:10,color:"var(--dim)",marginBottom:5,letterSpacing:1}}>LEAD (min)</div>
          <input type="number" value={lead} onChange={e=>setLead(e.target.value)} style={{background:"var(--p2)",border:"1px solid var(--line)",color:"var(--tx)",fontSize:13,borderRadius:8,padding:"8px 10px",width:"100%",fontFamily:"Azeret Mono,monospace"}}/></div>
        <button onClick={add} className="spring flex items-center gap-1.5 rounded-xl px-4 py-2.5"
          style={{background:"var(--cy)",color:"#070b12",fontSize:13,fontWeight:700,flexShrink:0}}><Plus size={13}/>Arm</button>
      </div>
    </Card>
    <div className="flex flex-col gap-2">
      {triggers.length===0&&<div style={{color:"var(--dim)",fontSize:13,textAlign:"center",padding:24}}>Nincs trigger.</div>}
      {triggers.map((t,i)=>(<div key={t.id} className="flex items-center justify-between rounded-2xl px-4 py-3 glow fade-up"
        style={{background:"var(--panel)",border:`1px solid ${t.fired?"var(--gn)":"var(--line)"}`,animationDelay:`${i*35}ms`}}>
        <div className="flex items-center gap-3">
          <button onClick={()=>onToggle(t.id,!t.armed)} className="spring flex items-center justify-center rounded-xl"
            style={{width:30,height:30,background:t.armed?"rgba(94,200,255,.12)":"var(--p2)",border:"1px solid var(--line)",color:t.armed?"var(--cy)":"var(--dim)"}}><Bell size={13}/></button>
          <div><div className="mono" style={{fontSize:13}}>{t.kind==="fix"?t.fix:t.kind.toUpperCase()} <span style={{color:"var(--dim)"}}>− {t.lead} min</span></div>
            <div style={{fontSize:10,color:t.armed?(t.fired?"var(--gn)":"var(--cy)"):"var(--dim)",marginTop:1}}>{t.armed?(t.fired?"✓ fired":"armed"):"off"}</div></div>
        </div>
        <button onClick={()=>onDel(t.id)} className="spring flex items-center justify-center rounded-xl"
          style={{width:30,height:30,background:"var(--p2)",border:"1px solid var(--line)",color:"var(--rd)"}}><Trash2 size={13}/></button>
      </div>))}
    </div>
  </div>);
}

/* ═══════════════════════════════ BIND ══════════════════════════════════════ */
function BindTab({sessionCode,live,rtdbOk,user}){
  return(<div className="flex flex-col gap-4">
    <SLabel>Device Binding</SLabel>
    <div className="grid grid-cols-2 gap-4">
      <Card delay={0}>
        <div className="flex items-center gap-3 mb-3">
          <div style={{width:42,height:42,borderRadius:12,background:"var(--p2)",border:"1px solid var(--line)",display:"flex",alignItems:"center",justifyContent:"center"}}><Wifi size={19} color={rtdbOk?"var(--gn)":"var(--dim)"}/></div>
          <div><div className="disp" style={{fontWeight:700}}>Firebase RTDB</div><div style={{fontSize:11,color:rtdbOk?"var(--gn)":"var(--dim)",marginTop:2}}>{rtdbOk?"Csatlakozva ✓":"Csatlakozás…"}</div></div>
        </div>
        <div style={{fontSize:12,color:"var(--dim)",lineHeight:1.7}}>Session: <span className="mono" style={{color:"var(--cy)"}}>{sessionCode}</span><br/>
          Live: <span style={{color:live?"var(--gn)":"var(--dim)"}}>{live?"érkezik ✓":"nincs"}</span><br/>
          User: <span style={{color:"var(--tx)"}}>{user.email}</span></div>
      </Card>
      <Card delay={60}>
        <div className="flex items-center gap-3 mb-3">
          <div style={{width:42,height:42,borderRadius:12,background:"var(--p2)",border:"1px solid var(--line)",display:"flex",alignItems:"center",justifyContent:"center"}}><Smartphone size={19} color="var(--dim)"/></div>
          <div><div className="disp" style={{fontWeight:700}}>Telefon</div><div style={{fontSize:11,color:"var(--dim)",marginTop:2}}>Nincs párosítva</div></div>
        </div>
        <div style={{fontSize:12,color:"var(--dim)",lineHeight:1.7}}>Push értesítések (T/D, fix, landing) FCM-en a telefonra.<br/>Párosítás: az Expo app ugyanezzel a session-kóddal.</div>
      </Card>
    </div>
  </div>);
}

/* ═══════════════════════════════ CONTROLLERS ════════════════════════════════ */
function ControllersTab({gamepads,axisMap,onSave}){
  const LABELS=["Roll","Pitch","Throttle L","Throttle R","Rudder","Tiller","Flaps","Brakes","View H","View V"];
  if(!gamepads.length)return(<div style={{paddingTop:60,display:"flex",flexDirection:"column",alignItems:"center",gap:12,color:"var(--dim)"}}><Gamepad2 size={34} color="#1e3a5f"/><div style={{fontSize:14}}>Nem található USB gamepad / HOTAS.</div><div style={{fontSize:12}}>Csatlakoztasd az eszközt, automatikusan megjelenik.</div></div>);
  return(<div className="flex flex-col gap-4">
    <SLabel>Controller Axis Mapping</SLabel>
    {gamepads.map((gp,gi)=>{
      const known=Object.entries(KNOWN_CONTROLLERS).find(([n])=>gp.id.toLowerCase().includes(n.toLowerCase()));
      return(<div key={gp.id} className="rounded-2xl glow fade-up" style={{background:"var(--panel)",border:"1px solid var(--line)",overflow:"hidden",animationDelay:`${gi*50}ms`}}>
        <div className="flex items-center gap-4 p-4" style={{borderBottom:"1px solid var(--line)",background:"var(--p2)"}}>
          <div style={{width:42,height:42,borderRadius:10,background:"var(--panel)",border:"1px solid var(--line)",display:"flex",alignItems:"center",justifyContent:"center"}}><Gamepad2 size={20} color="var(--cy)"/></div>
          <div className="flex-1 min-w-0">
            <div className="disp" style={{fontWeight:700,fontSize:13}}>{known?.[0]||"USB Controller"}</div>
            <div className="mono" style={{fontSize:10,color:"var(--dim)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginTop:2}}>{gp.id}</div>
            <div style={{fontSize:11,color:"var(--dim)",marginTop:1}}>{gp.axes.length} axis · {gp.buttons} button</div>
          </div>
          <div className="flex items-center gap-1.5 rounded-full px-3 py-1" style={{background:"rgba(82,227,176,.08)",border:"1px solid rgba(82,227,176,.2)",color:"var(--gn)",fontSize:11}}>
            <span className="pulse-dot" style={{width:5,height:5,borderRadius:"50%",background:"var(--gn)",display:"inline-block"}}/>Csatlakozva
          </div>
        </div>
        <div style={{padding:"4px 0"}}>
          {gp.axes.map(ax=>{
            const key=`${gp.id}:${ax.index}`,cur=axisMap[key]||"",pct=Math.round((ax.value+1)/2*100);
            return(<div key={ax.index} className="flex items-center gap-3 px-4 py-2" style={{borderBottom:"1px solid rgba(26,42,61,.5)"}}>
              <div className="mono" style={{width:22,fontSize:11,color:"var(--dim)",flexShrink:0}}>A{ax.index}</div>
              <div style={{width:110,height:5,background:"var(--p2)",borderRadius:99,overflow:"hidden",flexShrink:0,border:"1px solid var(--line)"}}>
                <div className="axis-bar" style={{width:`${pct}%`,height:"100%",background:"linear-gradient(90deg,var(--cy),#7c8cff)",borderRadius:99}}/></div>
              <div className="mono" style={{width:38,fontSize:11,color:"var(--cy)",flexShrink:0}}>{ax.value.toFixed(2)}</div>
              <select value={cur} onChange={e=>onSave(gp.id,ax.index,e.target.value)}
                style={{flex:1,background:"var(--p2)",border:"1px solid var(--line)",color:cur?"var(--tx)":"var(--dim)",fontSize:12,borderRadius:8,padding:"5px 8px"}}>
                <option value="">— nincs hozzárendelve —</option>
                {LABELS.map(l=><option key={l} value={l}>{l}</option>)}
              </select>
              {cur&&<div className="flex items-center gap-1 rounded-full px-2 py-0.5" style={{background:"rgba(94,200,255,.1)",border:"1px solid rgba(94,200,255,.2)",color:"var(--cy)",fontSize:10,flexShrink:0,whiteSpace:"nowrap"}}><Check size={10}/>{cur}</div>}
            </div>);
          })}
        </div>
      </div>);
    })}
  </div>);
}

/* ═══════════════════════════════ SETTINGS ═══════════════════════════════════ */
function SettingsTab({settings,saveSetting,onLoadOFP,updater}){
  const inp={background:"var(--p2)",border:"1px solid var(--line)",color:"var(--tx)",fontSize:13,borderRadius:8,padding:"7px 10px",fontFamily:"Azeret Mono,monospace"};
  const Row=({label,children})=>(<div className="flex items-center justify-between rounded-2xl px-4 py-3 glow" style={{background:"var(--panel)",border:"1px solid var(--line)"}}><span style={{fontSize:13}}>{label}</span>{children}</div>);
  return(<div className="flex flex-col gap-3">
    <SLabel>Settings</SLabel>
    <Row label="SimBrief usernév"><div className="flex gap-2"><input value={settings.sbUser} onChange={e=>saveSetting("sbUser",e.target.value)} placeholder="pl. chris_vatsim" style={{...inp,width:200}}/><button onClick={onLoadOFP} className="spring rounded-xl px-4 py-2" style={{background:"var(--cy)",color:"#070b12",fontSize:12,fontWeight:700}}>Betölt</button></div></Row>
    <Row label="Fenix EFB cím"><input value={settings.fenixUrl} onChange={e=>saveSetting("fenixUrl",e.target.value)} placeholder="http://192.168.1.x:8080" style={{...inp,width:240}}/></Row>
    <Row label="Session kód"><input value={settings.sessionCode} onChange={e=>saveSetting("sessionCode",e.target.value)} placeholder="ddnemet-host" style={{...inp,width:180}}/></Row>
    <Row label="Linkek megnyitása">
      <div className="flex gap-2">
        {[["Böngészőben",false],[<span className="flex items-center gap-1"><Chrome size={11}/>App-ban</span>,true]].map(([l,v])=>(
          <button key={String(v)} onClick={()=>saveSetting("openLinksInApp",v)} className="chip flex items-center gap-1.5 rounded-full px-3 py-1.5"
            style={{fontSize:12,fontWeight:600,background:settings.openLinksInApp===v?"var(--cy)":"var(--p2)",color:settings.openLinksInApp===v?"#070b12":"var(--dim)",border:"1px solid var(--line)"}}>{l}</button>
        ))}
      </div>
    </Row>
    <Row label="Frissítések">
      <div className="flex items-center gap-2">
        <span style={{fontSize:12,color:"var(--dim)"}}>
          {updater.state==="available"?`v${updater.info?.version} elérhető`:updater.state==="ready"?"Letöltve, telepítésre kész":"Naprakész"}
        </span>
        <button onClick={()=>window.skybound?.checkUpdate()} className="spring flex items-center gap-1.5 rounded-xl px-3 py-1.5"
          style={{background:"var(--p2)",border:"1px solid var(--line)",color:"var(--dim)",fontSize:12}}>
          <RefreshCw size={12}/>Ellenőrzés
        </button>
      </div>
    </Row>
  </div>);
}

/* ═══════════════════════════════ TUTORIAL ════════════════════════════════════ */
function Tutorial({onClose}){
  const steps=[
    {icon:Plane,    t:"SkyBound EFB",         d:"Shortcutok, SimBrief OFP, élő térkép, controller axis konfig és push értesítések."},
    {icon:Globe,    t:"Google bejelentkezés",  d:"A Google-fiókod köti össze az összes eszközt — desktop, telefon, bridge — egyetlen session-kódon keresztül."},
    {icon:FileText, t:"SimBrief",              d:"Add meg a SimBrief usernevet — betölti a payload, pax, fuel, route adatokat és felrajzolja a térképen az útvonalat."},
    {icon:Gamepad2, t:"Controller Axis",       d:"Csatlakoztasd a HOTAS-t/sidestick-et. Minden axishoz hozzárendelhetsz egy funkciót, az élő értéket animált bar mutatja."},
    {icon:Download, t:"Auto-update",           d:"Az app automatikusan ellenőrzi az új verziót. Megjelenik egy sáv — egy gombnyomás, és frissíti magát."},
  ];
  const [i,setI]=useState(0);const S=steps[i].icon;
  return(<div style={{position:"fixed",inset:0,background:"rgba(4,8,14,.8)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,backdropFilter:"blur(10px)"}}>
    <div className="pop glow" style={{width:460,background:"var(--panel)",border:"1px solid var(--line)",borderRadius:20,padding:28}}>
      <div style={{width:58,height:58,borderRadius:16,background:"linear-gradient(135deg,rgba(94,200,255,.15),rgba(124,140,255,.15))",border:"1px solid var(--line)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px"}}><S size={24} color="var(--cy)"/></div>
      <div className="disp" style={{fontSize:17,fontWeight:700,textAlign:"center"}}>{steps[i].t}</div>
      <div style={{fontSize:13.5,color:"var(--dim)",lineHeight:1.7,textAlign:"center",marginTop:8}}>{steps[i].d}</div>
      <div style={{display:"flex",justifyContent:"center",gap:8,margin:"18px 0"}}>
        {steps.map((_,k)=><span key={k} style={{width:k===i?20:6,height:6,borderRadius:99,background:k===i?"var(--cy)":"var(--line)",transition:"width .25s cubic-bezier(.34,1.56,.64,1)"}}/>)}
      </div>
      <div className="flex items-center justify-between">
        <button onClick={()=>i===0?onClose():setI(i-1)} className="spring flex items-center gap-1.5 rounded-xl px-4 py-2.5"
          style={{background:"var(--p2)",border:"1px solid var(--line)",color:"var(--dim)",fontSize:13}}>{i===0?"Skip":<><ChevronLeft size={13}/>Vissza</>}</button>
        <button onClick={()=>i===steps.length-1?onClose():setI(i+1)} className="spring flex items-center gap-1.5 rounded-xl px-5 py-2.5"
          style={{background:"var(--cy)",color:"#070b12",fontSize:13,fontWeight:700}}>{i===steps.length-1?"Kezdjük!":<>Tovább<ChevronRight size={13}/></>}</button>
      </div>
    </div>
  </div>);
}
