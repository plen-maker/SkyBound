import React, { useState, useEffect, useCallback, useMemo, lazy, Suspense } from "react";
import { initializeApp, getApps } from "firebase/app";
import {
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, onAuthStateChanged,
} from "firebase/auth";
import { getDatabase, ref, onValue, push, remove, update } from "firebase/database";
import {
  Plane, Map as MapIcon, FileText, Bell, Link2, Settings as Cog,
  Music, MessageCircle, Globe, Radar, Navigation2, Wifi, WifiOff,
  Plus, Trash2, Users, Weight, Fuel, ArrowDownRight,
  Loader2, AlertCircle, Gamepad2, ExternalLink, Chrome,
  Check, RefreshCw, LogOut, Download, Radio, Eye, EyeOff,
} from "lucide-react";

const OFPTab    = lazy(() => import("./OFPTab.jsx"));
const VatsimTab = lazy(() => import("./VatsimTab.jsx"));
const ChartsTab = lazy(() => import("./ChartsTab.jsx"));

/* ── Firebase ── */
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
// DB initialized lazily to avoid blocking startup
let _db = null;
const getDB = () => {
  if (!_db) _db = getDatabase(fbApp);
  return _db;
};

/* ── helpers ── */
const ls = {
  get: (k,d=null) => { try { const v=localStorage.getItem(k); return v!=null?JSON.parse(v):d; } catch { return d; } },
  set: (k,v) => { try { localStorage.setItem(k,JSON.stringify(v)); } catch {} },
};
const open = (url, inApp=false) => {
  if (!url) return;
  if (inApp && window.sb?.openInApp) { window.sb.openInApp(url); return; }
  window.sb?.openExternal(url) ?? window.open(url,"_blank");
};

/* ══ CSS ══════════════════════════════════════════════════════════════════ */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700&family=Chivo:wght@400;500&family=Azeret+Mono:wght@500;600&display=swap');
*{box-sizing:border-box;}
.efb{--bg:#070b12;--panel:#0d1520;--p2:#111c2b;--line:#1a2a3d;--cy:#5ec8ff;--am:#ffb454;--gn:#52e3b0;--rd:#f06080;--tx:#cdd9ec;--dim:#5a7090;font-family:'Chivo',sans-serif;color:var(--tx);}
.mono{font-family:'Azeret Mono',monospace;font-variant-numeric:tabular-nums;}
.disp{font-family:'Sora',sans-serif;}
.sp{transition:transform .35s cubic-bezier(.34,1.56,.64,1),box-shadow .2s;}
.sp:hover{transform:translateY(-2px) scale(1.02);box-shadow:0 10px 28px -8px rgba(94,200,255,.18);}
.sp:active{transform:scale(.97);transition-duration:.1s;}
.ti{animation:ti .28s cubic-bezier(.34,1.2,.64,1);}@keyframes ti{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.fu{animation:fu .35s cubic-bezier(.2,.9,.4,1) both;}@keyframes fu{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.pop{animation:pop .3s cubic-bezier(.34,1.56,.64,1) both;}@keyframes pop{from{opacity:0;transform:scale(.85)}to{opacity:1;transform:scale(1)}}
.spin{animation:sp2 1s linear infinite;}@keyframes sp2{to{transform:rotate(360deg)}}
.pd{animation:pd 2s ease-in-out infinite;}@keyframes pd{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1.2)}}
.glow{box-shadow:0 0 0 1px var(--line),0 14px 32px -16px rgba(0,0,0,.8);}
.nb{transition:background .15s,color .15s,transform .15s cubic-bezier(.34,1.56,.64,1);cursor:pointer;}
.nb:hover{background:var(--p2);transform:scale(1.05);}
.nb:active{transform:scale(.93);}
.tile{border:1px solid var(--line);cursor:pointer;transition:border-color .15s,transform .3s cubic-bezier(.34,1.56,.64,1),box-shadow .2s;}
.tile:hover{border-color:var(--cy);transform:translateY(-2px);box-shadow:0 8px 24px -8px rgba(94,200,255,.15);}
.tile.off{opacity:.4;pointer-events:none;}
input,select{outline:none;transition:border-color .15s,box-shadow .15s;}
input:focus,select:focus{border-color:var(--cy)!important;box-shadow:0 0 0 3px rgba(94,200,255,.1);}
::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-thumb{background:var(--line);border-radius:99px;}
.ax{transition:width .1s ease;}
.chip{transition:background .12s,color .12s,transform .12s cubic-bezier(.34,1.56,.64,1);cursor:pointer;}
.chip:hover{transform:scale(1.05);}
.upd{animation:slideDown .35s cubic-bezier(.34,1.2,.64,1);}
@keyframes slideDown{from{opacity:0;transform:translateY(-100%)}to{opacity:1;transform:none}}
@keyframes spin{to{transform:rotate(360deg)}}
`;

const TABS = [
  { id:"home",        label:"Home",    icon:Plane },
  { id:"map",         label:"Map",     icon:MapIcon },
  { id:"ofp",         label:"OFP",     icon:FileText },
  { id:"vatsim",      label:"VATSIM",  icon:Radio },
  { id:"charts",      label:"Charts",  icon:MapIcon },
  { id:"alerts",      label:"Alerts",  icon:Bell },
  { id:"controllers", label:"Ctrl",    icon:Gamepad2 },
  { id:"settings",    label:"Settings",icon:Cog },
];

const SHORTCUTS = [
  { id:"fenix",     label:"Fenix EFB",  sub:"IP:8080",    icon:Plane,        color:"#5ec8ff", urlKey:"fenixUrl" },
  { id:"navigraph", label:"Navigraph",  sub:"Charts",     icon:MapIcon,      color:"#7c8cff", url:"https://charts.navigraph.com" },
  { id:"vatsim",    label:"VATSIM",     sub:"Radar",      icon:Radar,        color:"#52e3b0", url:"https://radar.vatsim.net" },
  { id:"simbrief",  label:"SimBrief",   sub:"Dispatch",   icon:FileText,     color:"#ffb454", url:"https://dispatch.simbrief.com" },
  { id:"spotify",   label:"Spotify",    sub:"Music",      icon:Music,        color:"#52e37a", url:"https://open.spotify.com" },
  { id:"ytmusic",   label:"YT Music",   sub:"Music",      icon:Music,        color:"#ff6b6b", url:"https://music.youtube.com" },
  { id:"discord",   label:"Discord",    sub:"Crew",       icon:MessageCircle,color:"#7c8cff", url:"https://discord.com/app" },
  { id:"skybound",  label:"Skybound",   sub:"skybound.cx",icon:Globe,        color:"#5ec8ff", url:"https://skybound.cx" },
];

/* ══ LOGIN ════════════════════════════════════════════════════════════════ */
function LoginScreen() {
  const [email,    setEmail]    = useState(ls.get("sb_email","") || "");
  const [password, setPassword] = useState("");
  const [mode,     setMode]     = useState("login"); // login | register
  const [loading,  setLoading]  = useState(false);
  const [err,      setErr]      = useState("");
  const [showPw,   setShowPw]   = useState(false);

  const submit = async () => {
    if (!email || !password) { setErr("Töltsd ki mindkét mezőt."); return; }
    setLoading(true); setErr("");
    try {
      if (mode === "login") {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      ls.set("sb_email", email);
    } catch(e) {
      const msg = {
        "auth/invalid-email":        "Érvénytelen email.",
        "auth/user-not-found":       "Nincs ilyen fiók.",
        "auth/wrong-password":       "Hibás jelszó.",
        "auth/email-already-in-use": "Ez az email már használatban van.",
        "auth/weak-password":        "A jelszó túl gyenge (min. 6 karakter).",
        "auth/invalid-credential":   "Hibás email vagy jelszó.",
      }[e.code] || e.message;
      setErr(msg);
    }
    setLoading(false);
  };

  const inp = {
    width:"100%", background:"#111c2b", border:"1px solid #1a2a3d",
    color:"#cdd9ec", fontSize:14, borderRadius:10, padding:"10px 12px",
    fontFamily:"Chivo,sans-serif", outline:"none",
  };

  return (
    <div className="efb" style={{ height:"100vh", display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center", background:"var(--bg)", gap:16 }}>
      <style>{CSS}</style>
      <div style={{ width:64, height:64, borderRadius:18,
        background:"linear-gradient(135deg,#5ec8ff,#7c8cff)",
        display:"flex", alignItems:"center", justifyContent:"center",
        boxShadow:"0 6px 28px rgba(94,200,255,.4)" }}>
        <Navigation2 size={28} color="#070b12"/>
      </div>
      <div className="disp" style={{ fontSize:24, fontWeight:700, color:"var(--tx)" }}>
        SKYBOUND <span style={{ color:"var(--cy)" }}>EFB</span>
      </div>

      {/* mode tabs */}
      <div style={{ display:"flex", gap:6 }}>
        {[["login","Belépés"],["register","Regisztráció"]].map(([m,l])=>(
          <button key={m} onClick={()=>{ setMode(m); setErr(""); }}
            className="chip" style={{ fontSize:13, fontWeight:600, borderRadius:99,
              padding:"5px 16px", border:"1px solid var(--line)",
              background:mode===m?"var(--cy)":"var(--p2)",
              color:mode===m?"#070b12":"var(--dim)" }}>{l}</button>
        ))}
      </div>

      <div style={{ width:320, display:"flex", flexDirection:"column", gap:10 }}>
        <input value={email} onChange={e=>setEmail(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&submit()}
          placeholder="Email" type="email" style={inp}/>
        <div style={{ position:"relative" }}>
          <input value={password} onChange={e=>setPassword(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&submit()}
            placeholder="Jelszó" type={showPw?"text":"password"}
            style={{ ...inp, paddingRight:40 }}/>
          <button onClick={()=>setShowPw(!showPw)}
            style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)",
              background:"none", border:"none", cursor:"pointer", color:"var(--dim)" }}>
            {showPw ? <EyeOff size={16}/> : <Eye size={16}/>}
          </button>
        </div>
        {err && <div style={{ color:"var(--rd)", fontSize:12 }}>{err}</div>}
        <button onClick={submit} disabled={loading}
          style={{ background:"var(--cy)", color:"#070b12", border:"none",
            borderRadius:10, padding:"11px", fontSize:14, fontWeight:700,
            cursor:"pointer", display:"flex", alignItems:"center",
            justifyContent:"center", gap:8, opacity:loading?.7:1 }}>
          {loading ? <Loader2 size={16} className="spin"/> : (mode==="login"?"Belépés":"Fiók létrehozása")}
        </button>
      </div>
      <div style={{ fontSize:11, color:"var(--dim)", textAlign:"center", maxWidth:280 }}>
        A fiókod köti össze a desktopot, a telefont és a sim bridge-et.
      </div>
    </div>
  );
}

/* ══ UPDATE BANNER ════════════════════════════════════════════════════════ */
function UpdateBanner() {
  const [info, setInfo] = useState(null);
  useEffect(() => {
    setTimeout(async () => {
      const r = await window.sb?.checkUpdate?.();
      if (r?.update) setInfo(r);
    }, 4000);
  }, []);
  if (!info) return null;
  return (
    <div className="upd" style={{ display:"flex", alignItems:"center",
      justifyContent:"space-between", padding:"6px 20px", flexShrink:0,
      background:"rgba(255,180,84,.07)", borderBottom:"1px solid rgba(255,180,84,.22)" }}>
      <span style={{ fontSize:12.5, color:"var(--am)" }}>
        🆕 Új verzió: <strong>{info.codename}</strong>
      </span>
      <div style={{ display:"flex", gap:6 }}>
        {info.downloadUrl && (
          <button onClick={()=>window.sb?.openRelease(info.downloadUrl)}
            className="chip" style={{ fontSize:11, fontWeight:600, borderRadius:99,
              padding:"3px 10px", border:"1px solid rgba(255,180,84,.4)",
              background:"rgba(255,180,84,.15)", color:"var(--am)" }}>
            Letöltés
          </button>
        )}
        <button onClick={()=>window.sb?.openRelease(info.url)}
          className="chip" style={{ fontSize:11, fontWeight:600, borderRadius:99,
            padding:"3px 10px", border:"1px solid var(--line)",
            background:"var(--p2)", color:"var(--dim)" }}>
          Release notes
        </button>
      </div>
    </div>
  );
}

/* ══ APP SHELL ════════════════════════════════════════════════════════════ */
function AppShell({ user }) {
  const [tab, setTab] = useState("home");
  const [settings, setSettings] = useState(() => ({
    sbUser:"", fenixUrl:"", sessionCode:"ddnemet-host", openLinksInApp:false,
    ofpMode:"simplified", ...ls.get("sb_settings",{}),
  }));
  const save = useCallback((k,v) => setSettings(p=>{
    const n={...p,[k]:v}; ls.set("sb_settings",n); window.sb?.saveSettings?.(n); return n;
  }),[]);

  /* live */
  const [live,setLive]=useState(null);
  const [rtdb,setRtdb]=useState(false);
  useEffect(()=>{
    if(!settings.sessionCode)return;
    const u1=onValue(ref(getDB(),`sessions/${settings.sessionCode}/live`),s=>setLive(s.val()));
    const u2=onValue(ref(getDB(),".info/connected"),s=>setRtdb(s.val()===true));
    return()=>{u1();u2();};
  },[settings.sessionCode]);

  /* simbrief */
  const [ofp,setOfp]=useState(null);
  const [ofpState,setOfpState]=useState("idle");
  const [ofpErr,setOfpErr]=useState("");
  const loadOFP=useCallback(async(u=settings.sbUser)=>{
    const un=(u||"").trim();
    if(!un){setOfpState("error");setOfpErr("Adj meg SimBrief usernevet.");return;}
    setOfpState("loading");setOfpErr("");
    try{
      const r=await Promise.race([
        window.sb?.fetchOFP?.(un)??Promise.resolve({error:"csak Electronban"}),
        new Promise((_,rej)=>setTimeout(()=>rej(new Error("Timeout")),12000)),
      ]);
      if(r?.error){setOfpState("error");setOfpErr(r.error);}
      else{setOfp(r.ofp);setOfpState("idle");save("sbUser",un);}
    }catch(e){setOfpState("error");setOfpErr(e.message);}
  },[settings.sbUser,save]);
  useEffect(()=>{if(settings.sbUser)loadOFP(settings.sbUser);},[]);

  /* triggers */
  const [triggers,setTriggers]=useState([]);
  useEffect(()=>{
    if(!settings.sessionCode)return;
    return onValue(ref(getDB(),`sessions/${settings.sessionCode}/triggers`),s=>{
      const v=s.val();setTriggers(v?Object.entries(v).map(([id,d])=>({id,...d})):[]);
    });
  },[settings.sessionCode]);
  const addTr=t=>push(ref(getDB(),`sessions/${settings.sessionCode}/triggers`),{armed:true,...t});
  const delTr=id=>remove(ref(getDB(),`sessions/${settings.sessionCode}/triggers/${id}`));
  const togTr=(id,a)=>update(ref(getDB(),`sessions/${settings.sessionCode}/triggers/${id}`),{armed:a});

  /* gamepads */
  const [gamepads,setGamepads]=useState([]);
  const [axisMap,setAxisMap]=useState(()=>ls.get("sb_axes",{}));
  useEffect(()=>{
    const t=setInterval(()=>setGamepads(Array.from(navigator.getGamepads?.()??[]).filter(Boolean).map(g=>({
      id:g.id,axes:Array.from(g.axes).map((v,i)=>({index:i,value:v})),buttons:g.buttons.length,
    }))),200);
    return()=>clearInterval(t);
  },[]);
  const saveAxis=(gid,ai,label)=>{const n={...axisMap,[`${gid}:${ai}`]:label};setAxisMap(n);ls.set("sb_axes",n);};

  const shortcuts=useMemo(()=>SHORTCUTS.map(s=>({
    ...s,resolvedUrl:s.urlKey?settings[s.urlKey]:s.url,disabled:s.urlKey?!settings[s.urlKey]:false,
  })),[settings]);
  const inApp=settings.openLinksInApp;
  const openUrl=url=>open(url,inApp);

  const inp={background:"var(--p2)",border:"1px solid var(--line)",color:"var(--tx)",
    fontSize:13,borderRadius:8,padding:"7px 10px",fontFamily:"Azeret Mono,monospace"};

  return (
    <div className="efb" style={{ height:"100vh",display:"flex",flexDirection:"column",
      background:"var(--bg)",overflow:"hidden" }}>
      <style>{CSS}</style>
      <UpdateBanner/>

      {/* titlebar */}
      <div style={{ height:52,display:"flex",alignItems:"center",justifyContent:"space-between",
        padding:"0 18px",borderBottom:"1px solid var(--line)",
        background:"rgba(13,21,32,.92)",backdropFilter:"blur(20px)",
        WebkitAppRegion:"drag",flexShrink:0 }}>
        <div style={{ display:"flex",alignItems:"center",gap:10,WebkitAppRegion:"no-drag" }}>
          <div style={{ width:30,height:30,borderRadius:8,
            background:"linear-gradient(135deg,#5ec8ff,#7c8cff)",
            display:"flex",alignItems:"center",justifyContent:"center",
            boxShadow:"0 3px 12px rgba(94,200,255,.3)" }}>
            <Navigation2 size={15} color="#070b12"/>
          </div>
          <div>
            <div className="disp" style={{ fontWeight:700,fontSize:13,letterSpacing:.3 }}>
              SKYBOUND <span style={{ color:"var(--cy)" }}>EFB</span>
            </div>
            <div className="mono" style={{ fontSize:9,color:"var(--dim)" }}>
              {ofp?`${ofp.dep||"?"}→${ofp.arr||"?"}`:"nincs OFP"} · {settings.sessionCode}
            </div>
          </div>
        </div>
        <div style={{ display:"flex",alignItems:"center",gap:12,WebkitAppRegion:"no-drag" }}>
          {[["GS",live?Math.round(live.gsKt):null,"kt"],
            ["ALT",live?Math.round(live.altFt)?.toLocaleString():null,"ft"],
            ["UTC",new Date().toUTCString().slice(17,22),"z"]].map(([l,v,u])=>(
            <div key={l} style={{ textAlign:"right" }}>
              <div style={{ fontSize:9,color:"var(--dim)",letterSpacing:1 }}>{l}</div>
              <div className="mono" style={{ fontSize:13,color:v==null?"var(--dim)":"var(--tx)" }}>
                {v??"—"}{v!=null&&<span style={{ fontSize:9,color:"var(--dim)",marginLeft:2 }}>{u}</span>}
              </div>
            </div>
          ))}
          <div style={{ display:"flex",alignItems:"center",gap:6,paddingLeft:10,borderLeft:"1px solid var(--line)" }}>
            <Pill ok={rtdb&&!!live} on={<><Wifi size={11}/>SIM</>} off={<><WifiOff size={11}/>SIM</>}/>
            <div style={{ fontSize:11,color:"var(--dim)",maxWidth:120,overflow:"hidden",
              textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{user.email}</div>
            <button onClick={()=>signOut(auth)} className="nb"
              style={{ padding:4,borderRadius:6,color:"var(--dim)",background:"transparent",border:"none" }}
              title="Kijelentkezés"><LogOut size={13}/></button>
          </div>
        </div>
      </div>

      <div style={{ display:"flex",flex:1,overflow:"hidden" }}>
        {/* sidebar */}
        <div style={{ width:82,borderRight:"1px solid var(--line)",
          background:"rgba(13,21,32,.7)",backdropFilter:"blur(12px)",
          display:"flex",flexDirection:"column",padding:"8px 5px",gap:2,flexShrink:0 }}>
          {TABS.map((t,i)=>{const I=t.icon,active=tab===t.id;return(
            <div key={t.id} onClick={()=>setTab(t.id)} className="nb fu"
              style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:2,
                padding:"8px 0",borderRadius:10,animationDelay:`${i*20}ms`,
                background:active?"var(--p2)":"transparent",
                color:active?"var(--cy)":"var(--dim)",
                border:active?"1px solid var(--line)":"1px solid transparent" }}>
              <I size={16}/><span style={{ fontSize:9,letterSpacing:.5,fontWeight:600 }}>{t.label}</span>
            </div>
          );})}
          <div onClick={()=>signOut(auth)} className="nb"
            style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:2,
              padding:"8px 0",borderRadius:10,color:"var(--dim)",marginTop:"auto" }}>
            <LogOut size={14}/><span style={{ fontSize:9 }}>Out</span>
          </div>
        </div>

        {/* main */}
        <div key={tab} className="ti" style={{ flex:1,overflow:"auto",padding:16,
          background:"radial-gradient(ellipse at 0 0,rgba(94,200,255,.02),transparent 50%)" }}>

          {tab==="home"&&<HomeTab live={live} ofp={ofp} shortcuts={shortcuts} openUrl={openUrl} inApp={inApp}/>}
          {tab==="map"&&(
            <div className="glow" style={{ borderRadius:16,overflow:"hidden",border:"1px solid var(--line)",height:"calc(100vh-110px)" }}>
              <MiniMap ofp={ofp} live={live} big/>
            </div>
          )}
          {tab==="ofp"&&(
            <Suspense fallback={<Loader/>}>
              <OFPTab sbUser={settings.sbUser} setSbUser={v=>save("sbUser",v)}
                ofp={ofp} state={ofpState} error={ofpErr} onLoad={loadOFP}
                ofpMode={settings.ofpMode} setOfpMode={v=>save("ofpMode",v)}/>
            </Suspense>
          )}
          {tab==="vatsim"&&<Suspense fallback={<Loader/>}><VatsimTab ofp={ofp}/></Suspense>}
          {tab==="charts"&&<Suspense fallback={<Loader/>}><ChartsTab ofp={ofp}/></Suspense>}
          {tab==="alerts"&&<AlertsTab triggers={triggers} onAdd={addTr} onDel={delTr} onToggle={togTr} ofp={ofp} live={live}/>}
          {tab==="controllers"&&<ControllersTab gamepads={gamepads} axisMap={axisMap} onSave={saveAxis}/>}
          {tab==="settings"&&<SettingsTab settings={settings} save={save} onLoadOFP={()=>loadOFP()} inp={inp}/>}
        </div>
      </div>
    </div>
  );
}

/* ══ ROOT ════════════════════════════════════════════════════════════════ */
export default function App() {
  const [user,setUser]=useState(undefined);
  useEffect(()=>onAuthStateChanged(auth,setUser),[]);
  if(user===undefined)return(
    <div style={{ height:"100vh",background:"#070b12",display:"flex",alignItems:"center",justifyContent:"center" }}>
      <Loader2 size={28} color="#5ec8ff" style={{ animation:"spin 1s linear infinite" }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
  if(!user)return <LoginScreen/>;
  return <AppShell user={user}/>;
}

/* ══ ATOMS ═══════════════════════════════════════════════════════════════ */
function Loader(){return<div style={{ color:"var(--dim)",fontSize:13,textAlign:"center",paddingTop:40 }}>Betöltés…</div>;}
function Pill({ok,on,off}){return(
  <div style={{ display:"flex",alignItems:"center",gap:4,borderRadius:99,padding:"3px 8px",fontSize:10,
    background:ok?"rgba(82,227,176,.1)":"rgba(90,112,144,.08)",
    color:ok?"#52e3b0":"var(--dim)",border:`1px solid ${ok?"rgba(82,227,176,.25)":"rgba(90,112,144,.2)"}`}}>
    {ok?<><span className="pd" style={{ width:5,height:5,borderRadius:"50%",background:"#52e3b0",display:"inline-block"}}/>{on}</>:(off||on)}
  </div>
);}
function SLabel({children}){return<div className="disp" style={{ fontSize:10,fontWeight:700,letterSpacing:1.6,textTransform:"uppercase",color:"var(--dim)",marginBottom:6}}>{children}</div>;}
function LRow({icon:I,label,value}){return(
  <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid var(--line)"}}>
    <span style={{ display:"flex",alignItems:"center",gap:6,fontSize:11,color:"var(--tx)"}}><I size={11} color="var(--dim)"/>{label}</span>
    <span className="mono" style={{ fontSize:12,color:value==null?"var(--dim)":"var(--tx)"}}>{value??"—"}</span>
  </div>
);}
function Alert({children,type="warn"}){return(
  <div style={{ display:"flex",alignItems:"center",gap:8,borderRadius:12,padding:"8px 12px",fontSize:12,
    background:type==="error"?"rgba(240,96,128,.08)":"rgba(255,180,84,.06)",
    border:`1px solid ${type==="error"?"rgba(240,96,128,.25)":"rgba(255,180,84,.18)"}`,
    color:type==="error"?"var(--rd)":"var(--am)"}}>
    <AlertCircle size={13}/>{children}
  </div>
);}

/* ══ MAP ═════════════════════════════════════════════════════════════════ */
function MiniMap({ofp,live,big}){
  const W=1000,H=big?560:340;
  const fixes=(ofp?.fixes||[]).filter(f=>f.lat!=null);
  if(!fixes.length&&!live)return(
    <div style={{ width:"100%",height:"100%",background:"radial-gradient(ellipse at 30% 20%,#14233a,#070b12)",
      display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8,color:"var(--dim)"}}>
      <MapIcon size={24} color="#1e3a5f"/><span style={{ fontSize:12}}>Nincs OFP / bridge</span>
    </div>
  );
  const pts=[...fixes,...(live?[{lat:live.lat,lon:live.lon}]:[])];
  const lats=pts.map(p=>p.lat),lons=pts.map(p=>p.lon);
  const mnLat=Math.min(...lats),mxLat=Math.max(...lats),mnLon=Math.min(...lons),mxLon=Math.max(...lons);
  const pad=65;
  const sx=lon=>pad+(mxLon===mnLon?.5:(lon-mnLon)/(mxLon-mnLon))*(W-2*pad);
  const sy=lat=>pad+(mxLat===mnLat?.5:1-(lat-mnLat)/(mxLat-mnLat))*(H-2*pad);
  return(
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%",height:"100%",display:"block",background:"radial-gradient(ellipse at 30% 20%,#14233a,#0a121e 60%,#070b12)"}}>
      {Array.from({length:11}).map((_,i)=><line key={"v"+i} x1={i*W/10} y1={0} x2={i*W/10} y2={H} stroke="#5ec8ff" strokeOpacity=".04"/>)}
      {Array.from({length:8}).map((_,i)=><line key={"h"+i} x1={0} y1={i*H/7} x2={W} y2={i*H/7} stroke="#5ec8ff" strokeOpacity=".04"/>)}
      {fixes.length>1&&<polyline points={fixes.map(f=>`${sx(f.lon)},${sy(f.lat)}`).join(" ")} fill="none" stroke="#5ec8ff" strokeOpacity=".45" strokeWidth="2.5" strokeDasharray="7 5"/>}
      {fixes.map((f,i)=>(<g key={f.ident+i}><circle cx={sx(f.lon)} cy={sy(f.lat)} r={i===0||i===fixes.length-1?6:4} fill={i===0||i===fixes.length-1?"#5ec8ff":"#3a7aaa"}/>{(i===0||i===fixes.length-1||i%Math.max(1,Math.floor(fixes.length/8))===0)&&<text x={sx(f.lon)+9} y={sy(f.lat)+4} fill="#8fafe0" fontSize="12" fontFamily="Azeret Mono,monospace">{f.ident}</text>}</g>))}
      {live&&(<g transform={`translate(${sx(live.lon)},${sy(live.lat)})`}><circle r={15} fill="rgba(94,200,255,.06)" stroke="rgba(94,200,255,.2)" strokeWidth="1"/><path d="M0,-11 L7,9 L0,4 L-7,9 Z" fill="#fff" stroke="#5ec8ff" strokeWidth="1.5" style={{ filter:"drop-shadow(0 0 6px #5ec8ff)"}}/></g>)}
    </svg>
  );
}

/* ══ HOME TAB ════════════════════════════════════════════════════════════ */
function HomeTab({live,ofp,shortcuts,openUrl,inApp}){
  return(
    <div style={{ display:"flex",flexDirection:"column",gap:14}}>
      {!live&&<Alert>Sim bridge nincs csatlakoztatva — az élő adatok a bridge futásakor jelennek meg.</Alert>}
      <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
        {[["ETE",live?`${Math.floor(live.destEteMin/60)}:${String(Math.round(live.destEteMin)%60).padStart(2,"0")}`:null,"","var(--cy)"],
          ["GS",live?Math.round(live.gsKt):null,"kt",null],
          ["ALT",live?Math.round(live.altFt)?.toLocaleString():null,"ft",null],
          ["V/S",live?Math.round(live.vsFpm):null,"fpm",live?.vsFpm<-200?"var(--am)":null],
        ].map(([l,v,u,a],i)=>(
          <div key={l} className="fu glow" style={{ background:"var(--p2)",border:"1px solid var(--line)",
            borderRadius:12,padding:12,animationDelay:`${i*40}ms`}}>
            <div style={{ fontSize:9,color:"var(--dim)",letterSpacing:1,textTransform:"uppercase"}}>{l}</div>
            <div className="mono" style={{ fontSize:22,marginTop:2,color:v==null?"var(--dim)":(a||"var(--tx)")}}>
              {v??"—"}{v!=null&&<span style={{ fontSize:10,color:"var(--dim)",marginLeft:3}}>{u}</span>}
            </div>
          </div>
        ))}
      </div>
      <SLabel>Shortcuts</SLabel>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
        {shortcuts.map((s,i)=>{const I=s.icon;return(
          <div key={s.id} className={`sp tile fu glow ${s.disabled?"off":""}`}
            style={{ background:"var(--panel)",borderRadius:16,padding:12,animationDelay:`${i*25}ms`}}
            onClick={()=>!s.disabled&&openUrl(s.resolvedUrl)}>
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
              <div style={{ width:34,height:34,borderRadius:9,background:"var(--p2)",
                border:"1px solid var(--line)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                <I size={16} color={s.color}/>
              </div>
              {inApp?<Chrome size={10} color="var(--dim)"/>:<ExternalLink size={10} color="var(--dim)"/>}
            </div>
            <div className="disp" style={{ fontSize:12,fontWeight:600}}>{s.label}</div>
            <div className="mono" style={{ fontSize:9,color:"var(--dim)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
              {s.disabled?"állítsd be →":s.sub}
            </div>
          </div>
        );})}
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"2fr 1fr",gap:10}}>
        <div className="glow" style={{ borderRadius:16,overflow:"hidden",border:"1px solid var(--line)",height:180}}>
          <MiniMap ofp={ofp} live={live}/>
        </div>
        <div className="glow" style={{ background:"var(--panel)",border:"1px solid var(--line)",borderRadius:16,padding:12}}>
          <SLabel>Load · SimBrief</SLabel>
          {ofp?(<>
            <LRow icon={Users} label="PAX" value={ofp.pax}/>
            <LRow icon={Weight} label="Payload" value={ofp.payload!=null?`${ofp.payload} ${ofp.units}`:null}/>
            <LRow icon={Fuel} label="Block" value={ofp.blockFuel!=null?`${ofp.blockFuel} ${ofp.units}`:null}/>
            <LRow icon={Weight} label="ZFW" value={ofp.zfw!=null?`${ofp.zfw} ${ofp.units}`:null}/>
            <LRow icon={ArrowDownRight} label="CI" value={ofp.costindex}/>
          </>):<div style={{ fontSize:12,color:"var(--dim)",lineHeight:1.6}}>Nincs OFP.</div>}
        </div>
      </div>
    </div>
  );
}

/* ══ ALERTS TAB ══════════════════════════════════════════════════════════ */
function AlertsTab({triggers,onAdd,onDel,onToggle,ofp,live}){
  const [kind,setKind]=useState("fix");const [fix,setFix]=useState("");const [lead,setLead]=useState("5");
  const fixOpts=ofp?.fixes?.map(f=>f.ident)||[];
  const inp={background:"var(--p2)",border:"1px solid var(--line)",color:"var(--tx)",fontSize:13,borderRadius:8,padding:"7px 10px",fontFamily:"Azeret Mono,monospace"};
  return(<div style={{ display:"flex",flexDirection:"column",gap:12}}>
    <SLabel>Push Triggers</SLabel>
    {!live&&<Alert>Csak élő bridge-del tüzelnek.</Alert>}
    <div className="glow" style={{ background:"var(--panel)",border:"1px solid var(--line)",borderRadius:16,padding:14}}>
      <div style={{ display:"flex",gap:6,marginBottom:12}}>
        {[["fix","Fix"],["tod","T/D"],["dest","Landing"]].map(([k,l])=>(
          <button key={k} onClick={()=>setKind(k)} className="chip"
            style={{ fontSize:12,fontWeight:600,background:kind===k?"var(--cy)":"var(--p2)",
              color:kind===k?"#070b12":"var(--dim)",border:"1px solid var(--line)",borderRadius:99,padding:"5px 14px"}}>
            {l}
          </button>
        ))}
      </div>
      <div style={{ display:"flex",gap:10,alignItems:"flex-end"}}>
        {kind==="fix"&&(<div style={{ flex:1}}>
          <div style={{ fontSize:9,color:"var(--dim)",marginBottom:5,letterSpacing:1}}>FIX</div>
          {fixOpts.length
            ?<select value={fix} onChange={e=>setFix(e.target.value)} style={{ ...inp,width:"100%"}}>
              <option value="">— válassz —</option>{fixOpts.map(f=><option key={f} value={f}>{f}</option>)}</select>
            :<input value={fix} onChange={e=>setFix(e.target.value)} placeholder="VETIK" style={{ ...inp,width:"100%"}}/>}
        </div>)}
        <div style={{ width:90}}><div style={{ fontSize:9,color:"var(--dim)",marginBottom:5,letterSpacing:1}}>LEAD (min)</div>
          <input type="number" value={lead} onChange={e=>setLead(e.target.value)} style={{ ...inp,width:"100%"}}/></div>
        <button onClick={()=>{ if(kind==="fix"&&!fix)return; onAdd({kind,lead:Number(lead)||5,...(kind==="fix"?{fix:fix.toUpperCase()}:{})});}}
          className="sp" style={{ display:"flex",alignItems:"center",gap:5,background:"var(--cy)",color:"#070b12",
            border:"none",borderRadius:10,padding:"9px 16px",fontSize:13,fontWeight:700,cursor:"pointer",flexShrink:0}}>
          <Plus size={13}/>Arm
        </button>
      </div>
    </div>
    <div style={{ display:"flex",flexDirection:"column",gap:8}}>
      {triggers.length===0&&<div style={{ color:"var(--dim)",fontSize:13,textAlign:"center",padding:20}}>Nincs trigger.</div>}
      {triggers.map((t,i)=>(<div key={t.id} className="fu glow" style={{ display:"flex",alignItems:"center",
        justifyContent:"space-between",background:"var(--panel)",
        border:`1px solid ${t.fired?"var(--gn)":"var(--line)"}`,borderRadius:14,padding:"10px 14px",animationDelay:`${i*35}ms`}}>
        <div style={{ display:"flex",alignItems:"center",gap:10}}>
          <button onClick={()=>onToggle(t.id,!t.armed)} style={{ width:28,height:28,borderRadius:8,
            background:t.armed?"rgba(94,200,255,.12)":"var(--p2)",border:"1px solid var(--line)",
            color:t.armed?"var(--cy)":"var(--dim)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <Bell size={12}/>
          </button>
          <div>
            <div className="mono" style={{ fontSize:13}}>{t.kind==="fix"?t.fix:t.kind.toUpperCase()} <span style={{ color:"var(--dim)"}}>− {t.lead} min</span></div>
            <div style={{ fontSize:10,color:t.armed?(t.fired?"var(--gn)":"var(--cy)"):"var(--dim)",marginTop:1}}>{t.armed?(t.fired?"✓ fired":"armed"):"off"}</div>
          </div>
        </div>
        <button onClick={()=>onDel(t.id)} style={{ width:28,height:28,borderRadius:8,background:"var(--p2)",
          border:"1px solid var(--line)",color:"var(--rd)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
          <Trash2 size={12}/>
        </button>
      </div>))}
    </div>
  </div>);
}

/* ══ CONTROLLERS TAB ═════════════════════════════════════════════════════ */
function ControllersTab({gamepads,axisMap,onSave}){
  const LABELS=["Roll","Pitch","Throttle L","Throttle R","Rudder","Tiller","Flaps","Brakes","View H","View V"];
  if(!gamepads.length)return(<div style={{ paddingTop:60,display:"flex",flexDirection:"column",alignItems:"center",gap:12,color:"var(--dim)"}}>
    <Gamepad2 size={34} color="#1e3a5f"/><div style={{ fontSize:14}}>Nem található gamepad / HOTAS.</div>
  </div>);
  return(<div style={{ display:"flex",flexDirection:"column",gap:12}}>
    <SLabel>Controller Axis Mapping</SLabel>
    {gamepads.map((gp,gi)=>(<div key={gp.id} className="fu glow" style={{ background:"var(--panel)",border:"1px solid var(--line)",borderRadius:16,overflow:"hidden",animationDelay:`${gi*50}ms`}}>
      <div style={{ display:"flex",alignItems:"center",gap:12,padding:"12px 16px",background:"var(--p2)",borderBottom:"1px solid var(--line)"}}>
        <div style={{ width:38,height:38,borderRadius:9,background:"var(--panel)",border:"1px solid var(--line)",display:"flex",alignItems:"center",justifyContent:"center"}}>
          <Gamepad2 size={18} color="var(--cy)"/>
        </div>
        <div style={{ flex:1,minWidth:0}}>
          <div className="disp" style={{ fontWeight:700,fontSize:13}}>Controller</div>
          <div className="mono" style={{ fontSize:10,color:"var(--dim)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{gp.id}</div>
        </div>
        <Pill ok={true} on="Csatlakozva"/>
      </div>
      {gp.axes.map(ax=>{
        const key=`${gp.id}:${ax.index}`,cur=axisMap[key]||"",pct=Math.round((ax.value+1)/2*100);
        return(<div key={ax.index} style={{ display:"flex",alignItems:"center",gap:10,padding:"8px 16px",borderBottom:"1px solid rgba(26,42,61,.5)"}}>
          <div className="mono" style={{ width:20,fontSize:10,color:"var(--dim)",flexShrink:0}}>A{ax.index}</div>
          <div style={{ width:100,height:5,background:"var(--p2)",borderRadius:99,overflow:"hidden",flexShrink:0,border:"1px solid var(--line)"}}>
            <div className="ax" style={{ width:`${pct}%`,height:"100%",background:"linear-gradient(90deg,var(--cy),#7c8cff)",borderRadius:99}}/></div>
          <div className="mono" style={{ width:36,fontSize:10,color:"var(--cy)",flexShrink:0}}>{ax.value.toFixed(2)}</div>
          <select value={cur} onChange={e=>onSave(gp.id,ax.index,e.target.value)}
            style={{ flex:1,background:"var(--p2)",border:"1px solid var(--line)",color:cur?"var(--tx)":"var(--dim)",fontSize:11,borderRadius:7,padding:"4px 7px"}}>
            <option value="">— nincs —</option>
            {LABELS.map(l=><option key={l} value={l}>{l}</option>)}
          </select>
          {cur&&<div className="chip" style={{ display:"flex",alignItems:"center",gap:4,borderRadius:99,padding:"2px 8px",background:"rgba(94,200,255,.1)",border:"1px solid rgba(94,200,255,.2)",color:"var(--cy)",fontSize:10,flexShrink:0,whiteSpace:"nowrap"}}><Check size={9}/>{cur}</div>}
        </div>);
      })}
    </div>))}
  </div>);
}

/* ══ SETTINGS TAB ════════════════════════════════════════════════════════ */
function SettingsTab({settings,save,onLoadOFP,inp}){
  const Row=({label,children})=>(<div className="glow" style={{ display:"flex",alignItems:"center",
    justifyContent:"space-between",background:"var(--panel)",border:"1px solid var(--line)",
    borderRadius:14,padding:"10px 14px"}}><span style={{ fontSize:13}}>{label}</span>{children}</div>);
  return(<div style={{ display:"flex",flexDirection:"column",gap:10}}>
    <SLabel>Settings</SLabel>
    <Row label="SimBrief usernév"><div style={{ display:"flex",gap:8}}>
      <input value={settings.sbUser} onChange={e=>save("sbUser",e.target.value)} placeholder="pl. chris_vatsim" style={{ ...inp,width:180}}/>
      <button onClick={onLoadOFP} className="sp" style={{ background:"var(--cy)",color:"#070b12",border:"none",borderRadius:9,padding:"7px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}}>Betölt</button>
    </div></Row>
    <Row label="Fenix EFB cím">
      <input value={settings.fenixUrl} onChange={e=>save("fenixUrl",e.target.value)} placeholder="http://192.168.1.x:8080" style={{ ...inp,width:230}}/>
    </Row>
    <Row label="Session kód">
      <input value={settings.sessionCode} onChange={e=>save("sessionCode",e.target.value)} placeholder="ddnemet-host" style={{ ...inp,width:170}}/>
    </Row>
    <Row label="Linkek">
      <div style={{ display:"flex",gap:6}}>
        {[["Böngészőben",false],["App-ban",true]].map(([l,v])=>(
          <button key={String(v)} onClick={()=>save("openLinksInApp",v)} className="chip"
            style={{ fontSize:11,fontWeight:600,background:settings.openLinksInApp===v?"var(--cy)":"var(--p2)",
              color:settings.openLinksInApp===v?"#070b12":"var(--dim)",border:"1px solid var(--line)",borderRadius:99,padding:"5px 12px"}}>{l}</button>
        ))}
      </div>
    </Row>
    <Row label="OFP mód">
      <div style={{ display:"flex",gap:6}}>
        {[["simplified","Simplified"],["realistic","Realistic"]].map(([v,l])=>(
          <button key={v} onClick={()=>save("ofpMode",v)} className="chip"
            style={{ fontSize:11,fontWeight:600,background:settings.ofpMode===v?"var(--cy)":"var(--p2)",
              color:settings.ofpMode===v?"#070b12":"var(--dim)",border:"1px solid var(--line)",borderRadius:99,padding:"5px 12px"}}>{l}</button>
        ))}
      </div>
    </Row>
    <Row label="Verzió">
      <span className="mono" style={{ fontSize:12,color:"var(--dim)"}}>Sequoia</span>
    </Row>
  </div>);
}
