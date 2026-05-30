import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { initializeApp, getApps } from "firebase/app";
import { getDatabase, ref, onValue, set, push, remove, update } from "firebase/database";
import {
  Plane, Map as MapIcon, FileText, Bell, Link2, Settings as Cog, BookOpen,
  Music, MessageCircle, Globe, Radar, Navigation2, Wifi, WifiOff, Smartphone,
  Plus, Trash2, ChevronRight, ChevronLeft, Users, Weight, Fuel, ArrowDownRight,
  Loader2, AlertCircle, Gamepad2, ExternalLink, Chrome, Check, Sliders,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════
   SkyBound EFB — Desktop
   Firebase project: simapp-99f40 · session: loaded from settings
   ═══════════════════════════════════════════════════════════════════════════ */

const FB_CONFIG = {
  apiKey: "AIzaSyAxHmLWOIJl4xC44uHsRbxqzRhF4mA0kqE",
  authDomain: "simapp-99f40.firebaseapp.com",
  databaseURL: "https://simapp-99f40-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "simapp-99f40",
  storageBucket: "simapp-99f40.firebasestorage.app",
  messagingSenderId: "993511543138",
  appId: "1:993511543138:web:ec3a0d3e19713160111c3b",
};

let _fbApp, _db;
function getDB() {
  if (!_db) {
    _fbApp = getApps().length ? getApps()[0] : initializeApp(FB_CONFIG);
    _db = getDatabase(_fbApp);
  }
  return _db;
}

const ls = {
  get: (k, d = null) => { try { const v = localStorage.getItem(k); return v != null ? JSON.parse(v) : d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

const openUrl = (url, inApp = false) => {
  if (!url) return;
  if (inApp && window.skybound?.openInApp) { window.skybound.openInApp(url); return; }
  if (window.skybound?.openExternal) window.skybound.openExternal(url);
  else window.open(url, "_blank");
};

/* ── Controller DB ─────────────────────────────────────────────────────── */
const KNOWN_CONTROLLERS = {
  "TCA Sidestick Airbus Edition": {
    image: "https://static.thrustmaster.com/wp-content/uploads/2019/11/TCA-Sidestick-Airbus-Edition.png",
    axes: ["Roll", "Pitch", "Throttle", "Rudder"],
  },
  "TCA Captain Pack X Airbus": {
    image: "https://static.thrustmaster.com/wp-content/uploads/2021/03/TCA-Captain-Pack-X-Airbus.png",
    axes: ["Roll", "Pitch", "Throttle L", "Throttle R", "Rudder", "Tiller", "Flaps"],
  },
  "Honeycomb Alpha Flight Controls": {
    image: "https://honeycombaeronaut.com/wp-content/uploads/2020/03/Alpha_Flight_Controls_2.png",
    axes: ["Ailerons", "Elevator"],
  },
};

const SHORTCUTS = [
  { id:"fenix",      label:"Fenix EFB",  sub:"IP:8080",           icon:Plane,         color:"#5ec8ff", urlKey:"fenixUrl" },
  { id:"navigraph",  label:"Navigraph",  sub:"Charts",            icon:MapIcon,       color:"#7c8cff", url:"https://charts.navigraph.com" },
  { id:"vatsim",     label:"VATSIM",     sub:"Radar",             icon:Radar,         color:"#52e3b0", url:"https://radar.vatsim.net" },
  { id:"simbrief",   label:"SimBrief",   sub:"Dispatch",          icon:FileText,      color:"#ffb454", url:"https://dispatch.simbrief.com" },
  { id:"spotify",    label:"Spotify",    sub:"Music",             icon:Music,         color:"#52e37a", url:"https://open.spotify.com" },
  { id:"ytmusic",    label:"YT Music",   sub:"Music",             icon:Music,         color:"#ff6b6b", url:"https://music.youtube.com" },
  { id:"discord",    label:"Discord",    sub:"Crew",              icon:MessageCircle, color:"#7c8cff", url:"https://discord.com/app" },
  { id:"skybound",   label:"Skybound",   sub:"skybound.cx",       icon:Globe,         color:"#5ec8ff", url:"https://skybound.cx" },
];

const TABS = [
  { id:"home",       label:"Home",       icon:Plane },
  { id:"map",        label:"Map",        icon:MapIcon },
  { id:"ofp",        label:"SimBrief",   icon:FileText },
  { id:"alerts",     label:"Alerts",     icon:Bell },
  { id:"bind",       label:"Bind",       icon:Link2 },
  { id:"controllers",label:"Controls",   icon:Gamepad2 },
  { id:"settings",   label:"Settings",   icon:Cog },
];

/* ══════════════════ MAIN APP ══════════════════════════════════════════════ */
export default function SkyBoundEFB() {
  const [tab, setTab] = useState("home");
  const [showTut, setShowTut] = useState(ls.get("sb_tut_seen") !== true);

  // Settings (persisted)
  const [settings, setSettings] = useState(() => ({
    sbUser: "", fenixUrl: "", sessionCode: "ddnemet-host",
    openLinksInApp: false, ...ls.get("sb_settings", {}),
  }));
  const saveSetting = useCallback((key, val) => {
    setSettings(prev => {
      const next = { ...prev, [key]: val };
      ls.set("sb_settings", next);
      window.skybound?.saveSettings?.(next);
      return next;
    });
  }, []);

  // Firebase RTDB live data
  const [live, setLive] = useState(null);
  const [rtdbConnected, setRtdbConnected] = useState(false);
  useEffect(() => {
    if (!settings.sessionCode) return;
    const db = getDB();
    const liveRef = ref(db, `sessions/${settings.sessionCode}/live`);
    const connRef = ref(db, ".info/connected");
    const u1 = onValue(liveRef, snap => setLive(snap.val()));
    const u2 = onValue(connRef, snap => setRtdbConnected(snap.val() === true));
    return () => { u1(); u2(); };
  }, [settings.sessionCode]);

  // SimBrief
  const [ofp, setOfp] = useState(null);
  const [ofpState, setOfpState] = useState("idle");
  const [ofpError, setOfpError] = useState("");
  const loadOFP = useCallback(async (user = settings.sbUser) => {
    const u = (user || "").trim();
    if (!u) { setOfpState("error"); setOfpError("Adj meg SimBrief usernevet."); return; }
    setOfpState("loading"); setOfpError("");
    const r = await (window.skybound?.fetchOFP?.(u) ?? fetch(`https://www.simbrief.com/api/xml.fetcher.php?username=${encodeURIComponent(u)}&json=1`).then(r=>r.json()).then(d=>({ofp:d})));
    if (r?.error) { setOfpState("error"); setOfpError(r.error); }
    else { setOfp(r.ofp); setOfpState("idle"); saveSetting("sbUser", u); }
  }, [settings.sbUser, saveSetting]);
  useEffect(() => { if (settings.sbUser) loadOFP(settings.sbUser); }, []);

  // Triggers (Firebase)
  const [triggers, setTriggers] = useState([]);
  useEffect(() => {
    if (!settings.sessionCode) return;
    const db = getDB();
    return onValue(ref(db, `sessions/${settings.sessionCode}/triggers`), snap => {
      const v = snap.val();
      setTriggers(v ? Object.entries(v).map(([id,d])=>({id,...d})) : []);
    });
  }, [settings.sessionCode]);
  const addTrigger = (t) => push(ref(getDB(), `sessions/${settings.sessionCode}/triggers`), { armed:true, ...t });
  const delTrigger = (id) => remove(ref(getDB(), `sessions/${settings.sessionCode}/triggers/${id}`));
  const togTrigger = (id, armed) => update(ref(getDB(), `sessions/${settings.sessionCode}/triggers/${id}`), { armed });

  // Gamepads
  const [gamepads, setGamepads] = useState([]);
  useEffect(() => {
    const poll = setInterval(() => {
      const gps = Array.from(navigator.getGamepads?.() || []).filter(Boolean).map(g => ({
        id: g.id, index: g.index,
        axes: Array.from(g.axes).map((v,i) => ({ index:i, value:v })),
        buttons: g.buttons.length,
      }));
      setGamepads(gps);
    }, 200);
    return () => clearInterval(poll);
  }, []);

  const [axisMap, setAxisMap] = useState(() => ls.get("sb_axes", {}));
  const saveAxis = (gpId, axisIdx, label) => {
    const next = { ...axisMap, [`${gpId}:${axisIdx}`]: label };
    setAxisMap(next); ls.set("sb_axes", next);
  };

  /* ── CSS ── */
  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700&family=Chivo:wght@400;500&family=Azeret+Mono:wght@500;600&display=swap');
    *{box-sizing:border-box;}
    .efb{--bg:#070b12;--panel:#0d1520;--p2:#111c2b;--line:#1a2a3d;--cy:#5ec8ff;--am:#ffb454;--gn:#52e3b0;--rd:#f06080;--tx:#cdd9ec;--dim:#5a7090;font-family:'Chivo',sans-serif;color:var(--tx);}
    .mono{font-family:'Azeret Mono',monospace;font-variant-numeric:tabular-nums;}
    .disp{font-family:'Sora',sans-serif;}
    /* Mac-style spring animations */
    .spring{transition:transform .38s cubic-bezier(.34,1.56,.64,1),opacity .22s ease,box-shadow .22s ease,border-color .22s ease;}
    .spring:hover{transform:translateY(-3px) scale(1.025);box-shadow:0 12px 32px -10px rgba(94,200,255,.18);}
    .spring:active{transform:translateY(0) scale(.97);transition-duration:.12s;}
    .tab-in{animation:tabIn .32s cubic-bezier(.34,1.2,.64,1);}
    @keyframes tabIn{from{opacity:0;transform:translateY(10px) scale(.98)}to{opacity:1;transform:none}}
    .fade-up{animation:fadeUp .4s cubic-bezier(.2,.9,.4,1) both;}
    @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
    .slide-in{animation:slideIn .35s cubic-bezier(.34,1.2,.64,1) both;}
    @keyframes slideIn{from{opacity:0;transform:translateX(-16px)}to{opacity:1;transform:none}}
    .pop{animation:pop .3s cubic-bezier(.34,1.56,.64,1) both;}
    @keyframes pop{from{opacity:0;transform:scale(.82)}to{opacity:1;transform:scale(1)}}
    .spin{animation:sp 1s linear infinite;}@keyframes sp{to{transform:rotate(360deg)}}
    .pulse-dot{animation:pd 2s ease-in-out infinite;}@keyframes pd{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1.2)}}
    .glow{box-shadow:0 0 0 1px var(--line),0 16px 36px -18px rgba(0,0,0,.85);}
    .navbtn{transition:background .18s,color .18s,transform .18s cubic-bezier(.34,1.56,.64,1);}
    .navbtn:hover{background:var(--p2);transform:scale(1.06);}
    .navbtn:active{transform:scale(.94);}
    .tile{border:1px solid var(--line);cursor:pointer;}
    .tile:hover{border-color:var(--cy);}
    .tile.off{opacity:.45;pointer-events:none;}
    input,select{outline:none;}
    input:focus,select:focus{border-color:var(--cy)!important;box-shadow:0 0 0 3px rgba(94,200,255,.12);}
    ::-webkit-scrollbar{width:5px;}::-webkit-scrollbar-track{background:transparent;}::-webkit-scrollbar-thumb{background:var(--line);border-radius:99px;}
    .axis-bar{transition:width .15s ease;}
    .chip{transition:background .15s,color .15s,transform .12s cubic-bezier(.34,1.56,.64,1);}
    .chip:hover{transform:scale(1.06);}
    .chip:active{transform:scale(.94);}
  `;

  const inApp = settings.openLinksInApp;
  const open = (url) => openUrl(url, inApp);

  const shortcuts = useMemo(() => SHORTCUTS.map(s => ({
    ...s,
    resolvedUrl: s.urlKey ? settings[s.urlKey] : s.url,
    disabled: s.urlKey ? !settings[s.urlKey] : false,
  })), [settings]);

  return (
    <div className="efb" style={{ height:"100vh", background:"var(--bg)", display:"flex", flexDirection:"column", overflow:"hidden" }}>
      <style>{css}</style>

      {/* ── Title bar / status ── */}
      <div className="flex items-center justify-between px-5" style={{ height:58, borderBottom:"1px solid var(--line)", background:"rgba(13,21,32,.92)", backdropFilter:"blur(20px)", WebkitAppRegion:"drag", flexShrink:0 }}>
        <div className="flex items-center gap-3" style={{ WebkitAppRegion:"no-drag" }}>
          <div className="flex items-center justify-center rounded-xl" style={{ width:36,height:36,background:"linear-gradient(135deg,#5ec8ff,#7c8cff)", boxShadow:"0 4px 16px rgba(94,200,255,.35)" }}>
            <Navigation2 size={18} color="#070b12" />
          </div>
          <div>
            <div className="disp" style={{ fontWeight:700, fontSize:15, letterSpacing:.4 }}>
              SKYBOUND <span style={{ color:"var(--cy)" }}>EFB</span>
            </div>
            <div className="mono" style={{ fontSize:10, color:"var(--dim)" }}>
              {ofp ? `${ofp.dep||"----"}→${ofp.arr||"----"}` : "nincs aktív OFP"} · {settings.sessionCode || "—"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-5" style={{ WebkitAppRegion:"no-drag" }}>
          <Readout label="GS"  value={live ? Math.round(live.gsKt) : null} unit="kt" />
          <Readout label="ALT" value={live ? Math.round(live.altFt)?.toLocaleString() : null} unit="ft" />
          <Readout label="UTC" value={new Date().toUTCString().slice(17,22)} unit="z" />
          <div className="flex items-center gap-2 pl-4" style={{ borderLeft:"1px solid var(--line)" }}>
            <StatusPill ok={rtdbConnected && !!live} on={<><Wifi size={12}/>SIM</>} off={<><WifiOff size={12}/>SIM</>} />
            <StatusPill ok={false} on={<><Smartphone size={12}/>PHONE</>} off={<><Smartphone size={12}/>NO LINK</>} />
          </div>
        </div>
      </div>

      <div className="flex flex-1" style={{ overflow:"hidden" }}>
        {/* ── Sidebar ── */}
        <div className="flex flex-col py-3 px-2 gap-0.5" style={{ width:90, borderRight:"1px solid var(--line)", background:"rgba(13,21,32,.7)", backdropFilter:"blur(12px)", flexShrink:0 }}>
          {TABS.map((t,i) => {
            const I=t.icon; const active=tab===t.id;
            return (
              <div key={t.id} onClick={()=>setTab(t.id)} className="navbtn flex flex-col items-center gap-1 rounded-xl py-2.5 slide-in"
                style={{ animationDelay:`${i*30}ms`, background:active?"var(--p2)":"transparent", color:active?"var(--cy)":"var(--dim)", border:active?"1px solid var(--line)":"1px solid transparent" }}>
                <I size={18}/><span style={{ fontSize:9,letterSpacing:.5,fontWeight:600 }}>{t.label}</span>
              </div>
            );
          })}
          <div onClick={()=>setShowTut(true)} className="navbtn flex flex-col items-center gap-1 rounded-xl py-2.5 mt-auto" style={{ color:"var(--dim)" }}>
            <BookOpen size={17}/><span style={{ fontSize:9 }}>Help</span>
          </div>
        </div>

        {/* ── Main content ── */}
        <div key={tab} className="flex-1 overflow-auto tab-in efb-grid" style={{ padding:20 }}>

          {/* ── HOME ── */}
          {tab==="home" && (
            <div className="flex flex-col gap-4">
              {!live && (
                <div className="flex items-center gap-2 rounded-xl px-3 py-2 fade-up" style={{ background:"rgba(255,180,84,.06)", border:"1px solid rgba(255,180,84,.18)", color:"var(--am)", fontSize:12.5 }}>
                  <AlertCircle size={14}/> Sim bridge nincs csatlakoztatva — élő adatok (sebesség, magasság, térkép, triggerek) akkor jelennek meg, ha fut a bridge a MSFS-es gépen.
                </div>
              )}
              <div className="grid grid-cols-4 gap-3">
                {[["Dest ETE", live ? Math.floor(live.destEteMin/60)+":"+String(Math.round(live.destEteMin)%60).padStart(2,"0"):null,"","var(--cy)"],
                  ["GS", live?Math.round(live.gsKt):null,"kt",null],
                  ["ALT", live?Math.round(live.altFt).toLocaleString():null,"ft",null],
                  ["V/S", live?Math.round(live.vsFpm):null,"fpm",live?.vsFpm<-100?"var(--am)":null]
                ].map(([l,v,u,a],i)=>(
                  <div key={l} className="rounded-xl p-3 glow fade-up" style={{ background:"var(--p2)", border:"1px solid var(--line)", animationDelay:`${i*50}ms` }}>
                    <div style={{ fontSize:10, color:"var(--dim)", letterSpacing:1, textTransform:"uppercase" }}>{l}</div>
                    <div className="mono" style={{ fontSize:24, marginTop:2, color:v==null?"var(--dim)":(a||"var(--tx)") }}>{v??  "—"}<span style={{ fontSize:11,color:"var(--dim)",marginLeft:3 }}>{v!=null?u:""}</span></div>
                  </div>
                ))}
              </div>

              <div>
                <SLabel>Shortcuts</SLabel>
                <div className="grid grid-cols-4 gap-3 mt-2">
                  {shortcuts.map((s,i) => {
                    const I=s.icon;
                    return (
                      <div key={s.id} className={`spring tile rounded-2xl p-3 glow fade-up ${s.disabled?"off":""}`}
                        style={{ background:"var(--panel)", animationDelay:`${60+i*35}ms` }}
                        onClick={()=>!s.disabled&&open(s.resolvedUrl)}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center justify-center rounded-xl" style={{ width:38,height:38,background:"var(--p2)",border:"1px solid var(--line)" }}>
                            <I size={18} color={s.color}/>
                          </div>
                          {inApp
                            ? <Chrome size={12} color="var(--dim)" />
                            : <ExternalLink size={12} color="var(--dim)" />}
                        </div>
                        <div className="disp" style={{ fontSize:13,fontWeight:600 }}>{s.label}</div>
                        <div className="mono" style={{ fontSize:10,color:"var(--dim)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{s.disabled?"állítsd be ▸ Settings":s.sub}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 rounded-2xl overflow-hidden glow" style={{ border:"1px solid var(--line)",height:190 }}>
                  <MiniMap ofp={ofp} live={live}/>
                </div>
                <div className="rounded-2xl p-3 glow" style={{ background:"var(--panel)",border:"1px solid var(--line)" }}>
                  <SLabel>Load · SimBrief</SLabel>
                  {ofp ? (
                    <div className="mt-1">
                      <LRow icon={Users}         label="PAX"     value={ofp.pax}/>
                      <LRow icon={Weight}        label="Payload" value={ofp.payload!=null?`${ofp.payload} ${ofp.units}`:null}/>
                      <LRow icon={Fuel}          label="Block"   value={ofp.blockFuel!=null?`${ofp.blockFuel} ${ofp.units}`:null}/>
                      <LRow icon={Weight}        label="ZFW"     value={ofp.zfw!=null?`${ofp.zfw} ${ofp.units}`:null}/>
                      <LRow icon={ArrowDownRight} label="CI"     value={ofp.costindex}/>
                    </div>
                  ) : (
                    <div style={{ fontSize:12,color:"var(--dim)",marginTop:8,lineHeight:1.6 }}>Nincs OFP. Add meg a SimBrief usernevet.</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── MAP ── */}
          {tab==="map" && (
            <div className="rounded-2xl overflow-hidden glow" style={{ border:"1px solid var(--line)",height:"calc(100vh - 120px)" }}>
              <MiniMap ofp={ofp} live={live} big/>
            </div>
          )}

          {/* ── SIMBRIEF ── */}
          {tab==="ofp" && (
            <OFPTab sbUser={settings.sbUser} setSbUser={v=>saveSetting("sbUser",v)} ofp={ofp} state={ofpState} error={ofpError} onLoad={loadOFP}/>
          )}

          {/* ── ALERTS ── */}
          {tab==="alerts" && (
            <AlertsTab triggers={triggers} onAdd={addTrigger} onDel={delTrigger} onToggle={togTrigger} ofp={ofp} live={live}/>
          )}

          {/* ── BIND ── */}
          {tab==="bind" && <BindTab sessionCode={settings.sessionCode} live={live} rtdbConnected={rtdbConnected}/>}

          {/* ── CONTROLLERS ── */}
          {tab==="controllers" && (
            <ControllersTab gamepads={gamepads} axisMap={axisMap} onSaveAxis={saveAxis}/>
          )}

          {/* ── SETTINGS ── */}
          {tab==="settings" && (
            <SettingsTab settings={settings} saveSetting={saveSetting} onLoadOFP={()=>loadOFP()}/>
          )}
        </div>
      </div>

      {showTut && <Tutorial onClose={()=>{ setShowTut(false); ls.set("sb_tut_seen",true); }}/>}
    </div>
  );
}

/* ══════════════ SMALL ATOMS ════════════════════════════════════════════════ */
function Readout({ label, value, unit }) {
  return (
    <div className="text-right">
      <div style={{ fontSize:9,color:"var(--dim)",letterSpacing:1,textTransform:"uppercase" }}>{label}</div>
      <div className="mono" style={{ fontSize:15,color:value==null?"var(--dim)":"var(--tx)" }}>
        {value??  "—"}<span style={{ fontSize:9,color:"var(--dim)",marginLeft:2 }}>{value!=null?unit:""}</span>
      </div>
    </div>
  );
}
function StatusPill({ ok, on, off }) {
  return (
    <div className="flex items-center gap-1 rounded-full px-2 py-1" style={{ fontSize:10,
      background:ok?"rgba(82,227,176,.1)":"rgba(90,112,144,.08)",
      color:ok?"#52e3b0":"var(--dim)", border:`1px solid ${ok?"rgba(82,227,176,.25)":"rgba(90,112,144,.2)"}` }}>
      {ok
        ? <><span className="pulse-dot" style={{ width:5,height:5,borderRadius:"50%",background:"#52e3b0",display:"inline-block" }}/>{on}</>
        : off}
    </div>
  );
}
function SLabel({ children }) {
  return <div className="disp" style={{ fontSize:10.5,fontWeight:700,letterSpacing:1.6,textTransform:"uppercase",color:"var(--dim)" }}>{children}</div>;
}
function LRow({ icon:I, label, value }) {
  return (
    <div className="flex items-center justify-between py-1.5" style={{ borderBottom:"1px solid var(--line)" }}>
      <span className="flex items-center gap-2" style={{ fontSize:12,color:"var(--tx)" }}><I size={12} color="var(--dim)"/>{label}</span>
      <span className="mono" style={{ fontSize:12.5,color:value==null?"var(--dim)":"var(--tx)" }}>{value??  "—"}</span>
    </div>
  );
}

/* ══════════════ MAP ════════════════════════════════════════════════════════ */
function MiniMap({ ofp, live, big }) {
  const W=1000, H=big?560:380;
  const fixes=(ofp?.fixes||[]).filter(f=>f.lat!=null);
  if (!fixes.length && !live) return (
    <div className="flex flex-col items-center justify-center gap-3" style={{ width:"100%",height:"100%",background:"radial-gradient(ellipse at 30% 20%,#14233a,#0a121e 60%,#070b12)",color:"var(--dim)" }}>
      <MapIcon size={28} color="#1e3a5f"/><span style={{ fontSize:12.5 }}>Nincs OFP / bridge</span>
    </div>
  );
  const pts=[...fixes, ...(live?[{lat:live.lat,lon:live.lon}]:[])];
  const lats=pts.map(p=>p.lat), lons=pts.map(p=>p.lon);
  const minLat=Math.min(...lats),maxLat=Math.max(...lats),minLon=Math.min(...lons),maxLon=Math.max(...lons);
  const pad=70;
  const sx=lon=>pad+(maxLon===minLon?.5:(lon-minLon)/(maxLon-minLon))*(W-2*pad);
  const sy=lat=>pad+(maxLat===minLat?.5:1-(lat-minLat)/(maxLat-minLat))*(H-2*pad);
  const route=fixes.map(f=>`${sx(f.lon)},${sy(f.lat)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%",height:"100%",display:"block",background:"radial-gradient(ellipse at 30% 20%,#14233a,#0a121e 60%,#070b12)" }}>
      {Array.from({length:11}).map((_,i)=><line key={"v"+i} x1={i*W/10} y1={0} x2={i*W/10} y2={H} stroke="#5ec8ff" strokeOpacity=".045"/>)}
      {Array.from({length:8}).map((_,i)=><line key={"h"+i} x1={0} y1={i*H/7} x2={W} y2={i*H/7} stroke="#5ec8ff" strokeOpacity=".045"/>)}
      {fixes.length>1 && <polyline points={route} fill="none" stroke="#5ec8ff" strokeOpacity=".45" strokeWidth="2.5" strokeDasharray="7 5"/>}
      {fixes.map((f,i)=>(
        <g key={f.ident+i}>
          <circle cx={sx(f.lon)} cy={sy(f.lat)} r={i===0||i===fixes.length-1?6:4} fill={i===0||i===fixes.length-1?"#5ec8ff":"#3a7aaa"} stroke="#5ec8ff" strokeWidth={i===0||i===fixes.length-1?"1.5":"0"}/>
          {(i===0||i===fixes.length-1||i%Math.max(1,Math.floor(fixes.length/8))===0) &&
            <text x={sx(f.lon)+9} y={sy(f.lat)+4} fill="#8fafe0" fontSize="12" fontFamily="Azeret Mono,monospace">{f.ident}</text>}
        </g>
      ))}
      {live && (
        <g transform={`translate(${sx(live.lon)},${sy(live.lat)})`}>
          <circle r={18} fill="rgba(94,200,255,.08)" stroke="rgba(94,200,255,.25)" strokeWidth="1"/>
          <path d="M0,-13 L9,11 L0,5 L-9,11 Z" fill="#fff" stroke="#5ec8ff" strokeWidth="1.5" style={{ filter:"drop-shadow(0 0 8px #5ec8ff)" }}/>
        </g>
      )}
    </svg>
  );
}

/* ══════════════ OFP TAB ════════════════════════════════════════════════════ */
function OFPTab({ sbUser, setSbUser, ofp, state, error, onLoad }) {
  return (
    <div className="flex flex-col gap-4">
      <SLabel>SimBrief OFP</SLabel>
      <div className="rounded-2xl p-4 glow flex items-end gap-3" style={{ background:"var(--panel)",border:"1px solid var(--line)" }}>
        <div className="flex-1">
          <div style={{ fontSize:10,color:"var(--dim)",letterSpacing:1,marginBottom:6 }}>SIMBRIEF USERNÉV</div>
          <input value={sbUser} onChange={e=>setSbUser(e.target.value)} placeholder="pl. chris_vatsim"
            onKeyDown={e=>e.key==="Enter"&&onLoad(sbUser)}
            style={{ background:"var(--p2)",border:"1px solid var(--line)",color:"var(--tx)",fontSize:13,borderRadius:8,padding:"8px 10px",width:"100%",fontFamily:"Azeret Mono,monospace" }}/>
        </div>
        <button onClick={()=>onLoad(sbUser)} className="spring flex items-center gap-2 rounded-xl px-5 py-2.5"
          style={{ background:"var(--cy)",color:"#070b12",fontSize:13,fontWeight:700,flexShrink:0 }}>
          {state==="loading"?<Loader2 size={15} className="spin"/>:<><FileText size={14}/>Betölt</>}
        </button>
      </div>
      {state==="error" && (
        <div className="flex items-center gap-2 rounded-xl px-3 py-2 pop" style={{ background:"rgba(240,96,128,.08)",border:"1px solid rgba(240,96,128,.25)",color:"var(--rd)",fontSize:13 }}>
          <AlertCircle size={14}/>{error}
        </div>
      )}
      {ofp && (
        <>
          <div className="grid grid-cols-4 gap-3">
            {[["Route",`${ofp.dep||"?"}→${ofp.arr||"?"}`],["PAX",ofp.pax??  "—"],["Payload",ofp.payload!=null?`${ofp.payload} ${ofp.units}`:"—"],["Block",ofp.blockFuel!=null?`${ofp.blockFuel} ${ofp.units}`:"—"]].map(([l,v],i)=>(
              <div key={l} className="rounded-xl p-3 glow fade-up" style={{ background:"var(--p2)",border:"1px solid var(--line)",animationDelay:`${i*40}ms` }}>
                <div style={{ fontSize:10,color:"var(--dim)",letterSpacing:1 }}>{l.toUpperCase()}</div>
                <div className="mono" style={{ fontSize:18,marginTop:2 }}>{v}</div>
              </div>
            ))}
          </div>
          <div className="rounded-2xl p-3 glow" style={{ background:"var(--panel)",border:"1px solid var(--line)" }}>
            <div style={{ fontSize:10,color:"var(--dim)",marginBottom:6,letterSpacing:1 }}>ROUTE</div>
            <div className="mono" style={{ fontSize:12.5,lineHeight:1.8,wordBreak:"break-all" }}>{ofp.route||"—"}</div>
          </div>
          <div className="rounded-2xl overflow-hidden glow" style={{ border:"1px solid var(--line)" }}>
            <table style={{ width:"100%",borderCollapse:"collapse",fontFamily:"Azeret Mono,monospace",fontSize:12 }}>
              <thead><tr style={{ color:"var(--dim)",textAlign:"left",background:"var(--p2)" }}>
                <th style={{ padding:"8px 12px" }}>FIX</th><th style={{ padding:"8px 12px" }}>STAGE</th><th style={{ padding:"8px 12px" }}>ALT ft</th>
              </tr></thead>
              <tbody>
                {ofp.fixes.map((f,i)=>(
                  <tr key={f.ident+i} style={{ borderTop:"1px solid var(--line)" }}>
                    <td style={{ padding:"6px 12px",color:"var(--cy)" }}>{f.ident}</td>
                    <td style={{ padding:"6px 12px",color:"var(--dim)" }}>{f.stage||"—"}</td>
                    <td style={{ padding:"6px 12px" }}>{f.altitude??  "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

/* ══════════════ ALERTS TAB ═════════════════════════════════════════════════ */
function AlertsTab({ triggers, onAdd, onDel, onToggle, ofp, live }) {
  const [kind, setKind] = useState("fix");
  const [fix, setFix] = useState("");
  const [lead, setLead] = useState("5");
  const fixOpts = ofp?.fixes?.map(f=>f.ident)||[];
  const add = () => {
    if (kind==="fix"&&!fix) return;
    onAdd({ kind, lead:Number(lead)||5, ...(kind==="fix"?{fix:fix.toUpperCase()}:{}) });
  };
  return (
    <div className="flex flex-col gap-4">
      <SLabel>Push triggers</SLabel>
      {!live && (
        <div className="flex items-center gap-2 rounded-xl px-3 py-2 fade-up" style={{ background:"rgba(255,180,84,.06)",border:"1px solid rgba(255,180,84,.18)",color:"var(--am)",fontSize:12.5 }}>
          <AlertCircle size={14}/> Triggereket beállíthatod, de csak élő bridge-del tüzelnek.
        </div>
      )}
      <div className="rounded-2xl p-4 glow" style={{ background:"var(--panel)",border:"1px solid var(--line)" }}>
        <div className="flex gap-2 mb-3">
          {[["fix","Fix"],["tod","T/D"],["dest","Landing"]].map(([k,l])=>(
            <button key={k} onClick={()=>setKind(k)} className="chip rounded-full px-4 py-1.5"
              style={{ fontSize:12,fontWeight:600,background:kind===k?"var(--cy)":"var(--p2)",color:kind===k?"#070b12":"var(--dim)",border:"1px solid var(--line)" }}>{l}</button>
          ))}
        </div>
        <div className="flex items-end gap-3">
          {kind==="fix" && (
            <div className="flex-1">
              <div style={{ fontSize:10,color:"var(--dim)",marginBottom:5,letterSpacing:1 }}>FIX</div>
              {fixOpts.length
                ? <select value={fix} onChange={e=>setFix(e.target.value)} style={{ background:"var(--p2)",border:"1px solid var(--line)",color:"var(--tx)",fontSize:13,borderRadius:8,padding:"8px 10px",width:"100%" }}>
                    <option value="">— válassz —</option>
                    {fixOpts.map(f=><option key={f} value={f}>{f}</option>)}
                  </select>
                : <input value={fix} onChange={e=>setFix(e.target.value)} placeholder="VETIK"
                    style={{ background:"var(--p2)",border:"1px solid var(--line)",color:"var(--tx)",fontSize:13,borderRadius:8,padding:"8px 10px",width:"100%",fontFamily:"Azeret Mono,monospace" }}/>
              }
            </div>
          )}
          <div style={{ width:100 }}>
            <div style={{ fontSize:10,color:"var(--dim)",marginBottom:5,letterSpacing:1 }}>LEAD (min)</div>
            <input type="number" value={lead} onChange={e=>setLead(e.target.value)}
              style={{ background:"var(--p2)",border:"1px solid var(--line)",color:"var(--tx)",fontSize:13,borderRadius:8,padding:"8px 10px",width:"100%",fontFamily:"Azeret Mono,monospace" }}/>
          </div>
          <button onClick={add} className="spring flex items-center gap-1.5 rounded-xl px-4 py-2.5"
            style={{ background:"var(--cy)",color:"#070b12",fontSize:13,fontWeight:700,flexShrink:0 }}>
            <Plus size={14}/>Arm
          </button>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {triggers.length===0 && <div style={{ color:"var(--dim)",fontSize:13,textAlign:"center",padding:24 }}>Nincs trigger.</div>}
        {triggers.map((t,i)=>(
          <div key={t.id} className="flex items-center justify-between rounded-2xl px-4 py-3 glow fade-up" style={{ background:"var(--panel)",border:`1px solid ${t.fired?"var(--gn)":"var(--line)"}`,animationDelay:`${i*40}ms` }}>
            <div className="flex items-center gap-3">
              <button onClick={()=>onToggle(t.id,!t.armed)} className="spring flex items-center justify-center rounded-xl"
                style={{ width:30,height:30,background:t.armed?"rgba(94,200,255,.12)":"var(--p2)",border:"1px solid var(--line)",color:t.armed?"var(--cy)":"var(--dim)" }}>
                <Bell size={14}/>
              </button>
              <div>
                <div className="mono" style={{ fontSize:14 }}>{t.kind==="fix"?t.fix:t.kind.toUpperCase()} <span style={{ color:"var(--dim)" }}>− {t.lead} min</span></div>
                <div style={{ fontSize:10,color:t.armed?(t.fired?"var(--gn)":"var(--cy)"):"var(--dim)",marginTop:1 }}>{t.armed?(t.fired?"✓ fired":"armed"):"off"}</div>
              </div>
            </div>
            <button onClick={()=>onDel(t.id)} className="spring flex items-center justify-center rounded-xl"
              style={{ width:30,height:30,background:"var(--p2)",border:"1px solid var(--line)",color:"var(--rd)" }}>
              <Trash2 size={14}/>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════ BIND TAB ════════════════════════════════════════════════════ */
function BindTab({ sessionCode, live, rtdbConnected }) {
  return (
    <div className="flex flex-col gap-4">
      <SLabel>Device Binding</SLabel>
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl p-5 glow fade-up" style={{ background:"var(--panel)",border:"1px solid var(--line)" }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center rounded-xl" style={{ width:44,height:44,background:"var(--p2)",border:"1px solid var(--line)" }}>
              <Wifi size={20} color={rtdbConnected?"var(--gn)":"var(--dim)"}/>
            </div>
            <div>
              <div className="disp" style={{ fontWeight:700 }}>Firebase RTDB</div>
              <div style={{ fontSize:11,color:rtdbConnected?"var(--gn)":"var(--dim)",marginTop:2 }}>
                {rtdbConnected?"Csatlakozva ✓":"Csatlakozás…"}
              </div>
            </div>
          </div>
          <div style={{ fontSize:12,color:"var(--dim)",lineHeight:1.7 }}>
            Session: <span className="mono" style={{ color:"var(--cy)" }}>{sessionCode}</span><br/>
            A bridge ugyanezt a session-kódot használja a <span className="mono">.env</span>-ben.<br/>
            Live adat: <span style={{ color:live?"var(--gn)":"var(--dim)" }}>{live?"érkezik ✓":"nincs"}</span>
          </div>
        </div>
        <div className="rounded-2xl p-5 glow fade-up" style={{ background:"var(--panel)",border:"1px solid var(--line)",animationDelay:"60ms" }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center rounded-xl" style={{ width:44,height:44,background:"var(--p2)",border:"1px solid var(--line)" }}>
              <Smartphone size={20} color="var(--dim)"/>
            </div>
            <div>
              <div className="disp" style={{ fontWeight:700 }}>Telefon</div>
              <div style={{ fontSize:11,color:"var(--dim)",marginTop:2 }}>Nincs párosítva</div>
            </div>
          </div>
          <div style={{ fontSize:12,color:"var(--dim)",lineHeight:1.7 }}>
            A push értesítések (T/D, fixek, landing) a telefonra mennek FCM-en.<br/>
            Párosítás: az Expo app ugyanezzel a session-kóddal csatlakozik.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════ CONTROLLERS TAB ════════════════════════════════════════════ */
function ControllersTab({ gamepads, axisMap, onSaveAxis }) {
  const AXIS_LABELS = ["Roll","Pitch","Throttle L","Throttle R","Rudder","Tiller","Flaps","Brakes","View H","View V"];

  if (gamepads.length===0) return (
    <div className="flex flex-col items-center justify-center gap-3" style={{ paddingTop:60,color:"var(--dim)" }}>
      <Gamepad2 size={36} color="#1e3a5f"/>
      <div style={{ fontSize:14 }}>Nem található USB gamepad / HOTAS.</div>
      <div style={{ fontSize:12 }}>Csatlakoztasd az eszközt, az oldal automatikusan frissül.</div>
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <SLabel>Controller Axis Mapping</SLabel>
      {gamepads.map((gp,gi)=>{
        const known = Object.entries(KNOWN_CONTROLLERS).find(([name])=>gp.id.toLowerCase().includes(name.toLowerCase()));
        const info = known?.[1];
        return (
          <div key={gp.id} className="rounded-2xl glow fade-up" style={{ background:"var(--panel)",border:"1px solid var(--line)",overflow:"hidden",animationDelay:`${gi*60}ms` }}>
            {/* header */}
            <div className="flex items-center gap-4 p-4" style={{ borderBottom:"1px solid var(--line)",background:"var(--p2)" }}>
              {info?.image && (
                <img src={info.image} alt={gp.id}
                  onError={e=>e.target.style.display="none"}
                  style={{ width:72,height:48,objectFit:"contain",borderRadius:8,background:"#070b12",border:"1px solid var(--line)" }}/>
              )}
              {!info?.image && (
                <div className="flex items-center justify-center rounded-xl" style={{ width:72,height:48,background:"var(--p2)",border:"1px solid var(--line)" }}>
                  <Gamepad2 size={22} color="var(--cy)"/>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="disp" style={{ fontWeight:700,fontSize:14 }}>{known?.[0] || "USB Gamepad"}</div>
                <div className="mono" style={{ fontSize:10,color:"var(--dim)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginTop:2 }}>{gp.id}</div>
                <div style={{ fontSize:11,color:"var(--dim)",marginTop:2 }}>{gp.axes.length} axis · {gp.buttons} button</div>
              </div>
              <div className="flex items-center gap-2 rounded-full px-3 py-1" style={{ background:"rgba(82,227,176,.08)",border:"1px solid rgba(82,227,176,.2)",color:"var(--gn)",fontSize:11 }}>
                <span className="pulse-dot" style={{ width:5,height:5,borderRadius:"50%",background:"var(--gn)",display:"inline-block" }}/>
                Csatlakozva
              </div>
            </div>

            {/* axis rows */}
            <div style={{ padding:"8px 0" }}>
              {gp.axes.map((ax)=>{
                const mapKey=`${gp.id}:${ax.index}`;
                const current=axisMap[mapKey]||"";
                const pct=Math.round((ax.value+1)/2*100);
                return (
                  <div key={ax.index} className="flex items-center gap-3 px-4 py-2" style={{ borderBottom:"1px solid rgba(26,42,61,.5)" }}>
                    <div className="mono" style={{ width:24,fontSize:11,color:"var(--dim)",flexShrink:0 }}>A{ax.index}</div>
                    {/* live bar */}
                    <div style={{ width:120,height:6,background:"var(--p2)",borderRadius:99,overflow:"hidden",flexShrink:0,border:"1px solid var(--line)" }}>
                      <div className="axis-bar" style={{ width:`${pct}%`,height:"100%",background:`linear-gradient(90deg,var(--cy),#7c8cff)`,borderRadius:99 }}/>
                    </div>
                    <div className="mono" style={{ width:40,fontSize:11,color:"var(--cy)",flexShrink:0 }}>{ax.value.toFixed(2)}</div>
                    {/* label select */}
                    <select value={current} onChange={e=>onSaveAxis(gp.id,ax.index,e.target.value)}
                      style={{ flex:1,background:"var(--p2)",border:"1px solid var(--line)",color:current?"var(--tx)":"var(--dim)",fontSize:12,borderRadius:8,padding:"5px 8px",fontFamily:"Chivo,sans-serif" }}>
                      <option value="">— nincs hozzárendelve —</option>
                      {AXIS_LABELS.map(l=><option key={l} value={l}>{l}</option>)}
                    </select>
                    {current && (
                      <div className="flex items-center gap-1 rounded-full px-2 py-0.5" style={{ background:"rgba(94,200,255,.1)",border:"1px solid rgba(94,200,255,.2)",color:"var(--cy)",fontSize:10,flexShrink:0 }}>
                        <Check size={10}/>{current}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ══════════════ SETTINGS TAB ════════════════════════════════════════════════ */
function SettingsTab({ settings, saveSetting, onLoadOFP }) {
  const inp = { background:"var(--p2)",border:"1px solid var(--line)",color:"var(--tx)",fontSize:13,borderRadius:8,padding:"7px 10px",fontFamily:"Azeret Mono,monospace" };
  const Row = ({label,children}) => (
    <div className="flex items-center justify-between rounded-2xl px-4 py-3 glow" style={{ background:"var(--panel)",border:"1px solid var(--line)" }}>
      <span style={{ fontSize:13 }}>{label}</span>{children}
    </div>
  );
  return (
    <div className="flex flex-col gap-3">
      <SLabel>Settings</SLabel>
      <Row label="SimBrief usernév">
        <div className="flex gap-2">
          <input value={settings.sbUser} onChange={e=>saveSetting("sbUser",e.target.value)} placeholder="pl. chris_vatsim" style={{ ...inp,width:200 }}/>
          <button onClick={onLoadOFP} className="spring rounded-xl px-4 py-2" style={{ background:"var(--cy)",color:"#070b12",fontSize:12,fontWeight:700 }}>Betölt</button>
        </div>
      </Row>
      <Row label="Fenix EFB cím">
        <input value={settings.fenixUrl} onChange={e=>saveSetting("fenixUrl",e.target.value)} placeholder="http://192.168.1.x:8080" style={{ ...inp,width:240 }}/>
      </Row>
      <Row label="Session kód (bridge)">
        <input value={settings.sessionCode} onChange={e=>saveSetting("sessionCode",e.target.value)} placeholder="ddnemet-host" style={{ ...inp,width:200 }}/>
      </Row>
      <Row label="Linkek megnyitása">
        <div className="flex gap-2">
          {[["Böngészőben",false],[<><Chrome size={12}/>App-ban</>,true]].map(([l,v])=>(
            <button key={String(v)} onClick={()=>saveSetting("openLinksInApp",v)} className="chip flex items-center gap-1.5 rounded-full px-3 py-1.5"
              style={{ fontSize:12,fontWeight:600,background:settings.openLinksInApp===v?"var(--cy)":"var(--p2)",color:settings.openLinksInApp===v?"#070b12":"var(--dim)",border:"1px solid var(--line)" }}>{l}</button>
          ))}
        </div>
      </Row>
      <Row label="Egységek">
        <select style={{ ...inp,width:160 }}><option>nm · ft · kt</option><option>km · m · km/h</option></select>
      </Row>
    </div>
  );
}

/* ══════════════ TUTORIAL ════════════════════════════════════════════════════ */
function Tutorial({ onClose }) {
  const steps=[
    {icon:Plane,    t:"SkyBound EFB",         d:"Shortcutok, SimBrief OFP, élő térkép, controller axis konfig és push értesítések — egy helyen."},
    {icon:FileText, t:"SimBrief betöltés",     d:"Add meg a SimBrief usernevet a Settings vagy SimBrief fülön. Payload, pax, fuel, route és térkép-útvonal automatikusan betöltődik."},
    {icon:Globe,    t:"Shortcutok",            d:"A csempék a valódi oldalakat nyitják. Választhatsz: külső böngészőben, vagy az appon belüli mini-browserben (Settings → Linkek)."},
    {icon:Gamepad2, t:"Controller Axis Konfig",d:"Csatlakoztasd a HOTAS-t / sidestick-et. Az app felismeri, mutat egy képet az eszközről, és minden axishoz hozzárendelhetsz egy funkciót."},
    {icon:Bell,     t:"Push triggerek",        d:"Állíts be riasztásokat: T/D, fix, landing előtt X perccel — a bridge tüzeli, a push a telefonra megy."},
  ];
  const [i, setI]=useState(0);
  const S=steps[i].icon;
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(4,8,14,.78)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,backdropFilter:"blur(8px)" }}>
      <div className="pop glow" style={{ width:460,background:"var(--panel)",border:"1px solid var(--line)",borderRadius:20,padding:28 }}>
        <div className="flex items-center justify-center rounded-2xl mb-5" style={{ width:60,height:60,background:"linear-gradient(135deg,rgba(94,200,255,.15),rgba(124,140,255,.15))",border:"1px solid var(--line)",margin:"0 auto" }}>
          <S size={26} color="var(--cy)"/>
        </div>
        <div className="disp" style={{ fontSize:18,fontWeight:700,textAlign:"center" }}>{steps[i].t}</div>
        <div style={{ fontSize:13.5,color:"var(--dim)",lineHeight:1.7,textAlign:"center",marginTop:8 }}>{steps[i].d}</div>
        <div className="flex items-center justify-center gap-2 my-5">
          {steps.map((_,k)=><span key={k} style={{ width:k===i?20:6,height:6,borderRadius:99,background:k===i?"var(--cy)":"var(--line)",transition:"width .25s cubic-bezier(.34,1.56,.64,1)" }}/>)}
        </div>
        <div className="flex items-center justify-between">
          <button onClick={()=>i===0?onClose():setI(i-1)} className="spring flex items-center gap-1.5 rounded-xl px-4 py-2.5"
            style={{ background:"var(--p2)",border:"1px solid var(--line)",color:"var(--dim)",fontSize:13 }}>
            {i===0?"Skip":<><ChevronLeft size={14}/>Vissza</>}
          </button>
          <button onClick={()=>i===steps.length-1?onClose():setI(i+1)} className="spring flex items-center gap-1.5 rounded-xl px-5 py-2.5"
            style={{ background:"var(--cy)",color:"#070b12",fontSize:13,fontWeight:700 }}>
            {i===steps.length-1?"Kezdjük!":<>Tovább<ChevronRight size={14}/></>}
          </button>
        </div>
      </div>
    </div>
  );
}
