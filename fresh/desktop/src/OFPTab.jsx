import React, { useState, useEffect } from "react";
import {
  FileText, Loader2, AlertCircle, Wind, Eye, Cloud, Thermometer,
  Droplets, Navigation2, ChevronDown, ChevronUp, RefreshCw,
  Weight, Fuel, Users, ArrowDownRight, Gauge, Clock, MapPin,
} from "lucide-react";

/* ── Weather fetch (aviationweather.gov — ingyenes, no API key) ── */
async function fetchMetar(icao) {
  try {
    const r = await fetch(
      `https://aviationweather.gov/api/data/metar?ids=${icao}&format=json&hours=2`,
      { headers: { Accept: "application/json" } }
    );
    if (!r.ok) return null;
    const d = await r.json();
    return d?.[0] || null;
  } catch { return null; }
}

async function fetchTaf(icao) {
  try {
    const r = await fetch(
      `https://aviationweather.gov/api/data/taf?ids=${icao}&format=json`,
      { headers: { Accept: "application/json" } }
    );
    if (!r.ok) return null;
    const d = await r.json();
    return d?.[0] || null;
  } catch { return null; }
}

/* ── helpers ── */
const C = {
  bg:"#070b12", panel:"#0d1520", p2:"#111c2b", line:"#1a2a3d",
  cy:"#5ec8ff", am:"#ffb454", gn:"#52e3b0", rd:"#f06080", tx:"#cdd9ec", dim:"#5a7090",
};
const inp = {
  background:C.p2, border:`1px solid ${C.line}`, color:C.tx,
  fontSize:13, borderRadius:8, padding:"7px 10px", fontFamily:"Azeret Mono,monospace", outline:"none",
};
const card = {
  background:C.panel, border:`1px solid ${C.line}`, borderRadius:16,
  padding:14, boxShadow:`0 0 0 1px ${C.line},0 14px 32px -16px rgba(0,0,0,.8)`,
};

function flightCat(vis, ceiling) {
  if (vis == null) return null;
  const v = vis; const c = ceiling ?? 99999;
  if (v < 1600 || c < 500) return { label:"LIFR", color:"#c850f0" };
  if (v < 4800 || c < 1000) return { label:"IFR",  color:C.rd };
  if (v < 8000 || c < 3000) return { label:"MVFR", color:C.am };
  return { label:"VFR", color:C.gn };
}

function windDir(deg) {
  const dirs=["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  return dirs[Math.round(deg/22.5)%16];
}

/* ─────────────────────── WEATHER CARD ─────────────────────────── */
function WeatherCard({ icao, label }) {
  const [metar, setMetar] = useState(null);
  const [taf,   setTaf]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [showTaf, setShowTaf] = useState(false);

  const load = async () => {
    setLoading(true);
    const [m, t] = await Promise.all([fetchMetar(icao), fetchTaf(icao)]);
    setMetar(m); setTaf(t); setLoading(false);
  };
  useEffect(() => { if (icao) load(); }, [icao]);

  const vis     = metar?.visibility;
  const ceiling = metar?.clouds?.find(c=>c.cover==="BKN"||c.cover==="OVC")?.base;
  const cat     = flightCat(vis, ceiling);
  const wdir    = metar?.wdir;
  const wspd    = metar?.wspd;
  const wgst    = metar?.wgst;
  const temp    = metar?.temp;
  const dewp    = metar?.dewp;
  const altim   = metar?.altim;
  const rawText = metar?.rawOb || metar?.rawTaf;

  return (
    <div style={card}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", width:34, height:34,
            borderRadius:9, background:C.p2, border:`1px solid ${C.line}` }}>
            <Cloud size={16} color={C.cy}/>
          </div>
          <div>
            <div style={{ fontFamily:"Sora,sans-serif", fontWeight:700, fontSize:14 }}>{icao}</div>
            <div style={{ fontSize:10, color:C.dim }}>{label}</div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          {cat && <div style={{ borderRadius:99, padding:"2px 10px", fontSize:11, fontWeight:700,
            background:`${cat.color}20`, border:`1px solid ${cat.color}50`, color:cat.color }}>{cat.label}</div>}
          <button onClick={load} style={{ background:C.p2, border:`1px solid ${C.line}`, borderRadius:8,
            padding:5, color:C.dim, cursor:"pointer", display:"flex" }}>
            <RefreshCw size={13} style={{ animation:loading?"spin 1s linear infinite":undefined }}/>
          </button>
        </div>
      </div>

      {loading && <div style={{ color:C.dim, fontSize:12, textAlign:"center", padding:12 }}>Betöltés…</div>}
      {!loading && !metar && <div style={{ color:C.dim, fontSize:12 }}>Nincs METAR adat.</div>}

      {!loading && metar && (<>
        {/* Raw METAR */}
        <div style={{ background:C.p2, border:`1px solid ${C.line}`, borderRadius:9, padding:"8px 10px",
          fontFamily:"Azeret Mono,monospace", fontSize:11, color:C.tx, marginBottom:10,
          wordBreak:"break-all", lineHeight:1.5 }}>
          {metar.rawOb || "—"}
        </div>

        {/* Decoded grid */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
          {wdir != null && (
            <WeatherItem icon={<Wind size={13}/>} label="Szél"
              value={wdir===0?"VRB":`${String(wdir).padStart(3,"0")}°/${wspd}kt${wgst?` G${wgst}`:""}`}/>
          )}
          {vis != null && (
            <WeatherItem icon={<Eye size={13}/>} label="Látótáv"
              value={vis >= 9999 ? "10km+" : vis >= 1000 ? `${(vis/1000).toFixed(1)}km` : `${vis}m`}/>
          )}
          {temp != null && (
            <WeatherItem icon={<Thermometer size={13}/>} label="Hőmérséklet"
              value={`${temp}°C / ${dewp??"-"}°C`}/>
          )}
          {altim != null && (
            <WeatherItem icon={<Gauge size={13}/>} label="QNH"
              value={`${altim} hPa`}/>
          )}
          {ceiling != null && (
            <WeatherItem icon={<Cloud size={13}/>} label="Ceiling"
              value={`${ceiling} ft`}/>
          )}
          {metar.wxString && (
            <WeatherItem icon={<Droplets size={13}/>} label="Jelenség"
              value={metar.wxString}/>
          )}
        </div>

        {/* Clouds */}
        {metar.clouds?.length > 0 && (
          <div style={{ marginTop:8, display:"flex", gap:6, flexWrap:"wrap" }}>
            {metar.clouds.map((c,i) => (
              <div key={i} style={{ borderRadius:99, padding:"2px 8px", fontSize:10,
                background:"rgba(94,200,255,.08)", border:`1px solid rgba(94,200,255,.15)`, color:C.cy }}>
                {c.cover} {c.base!=null?`${c.base}ft`:""}
              </div>
            ))}
          </div>
        )}

        {/* TAF toggle */}
        {taf && (
          <div style={{ marginTop:10 }}>
            <button onClick={()=>setShowTaf(!showTaf)} style={{ display:"flex", alignItems:"center", gap:4,
              background:"transparent", border:"none", color:C.dim, fontSize:11, cursor:"pointer", padding:0 }}>
              {showTaf?<ChevronUp size={13}/>:<ChevronDown size={13}/>}
              TAF megjelenítése
            </button>
            {showTaf && (
              <div style={{ marginTop:6, background:C.p2, border:`1px solid ${C.line}`, borderRadius:9,
                padding:"8px 10px", fontFamily:"Azeret Mono,monospace", fontSize:11, color:C.dim,
                wordBreak:"break-all", lineHeight:1.6 }}>
                {taf.rawTaf || "—"}
              </div>
            )}
          </div>
        )}
      </>)}
    </div>
  );
}

function WeatherItem({ icon, label, value }) {
  return (
    <div style={{ background:C.p2, border:`1px solid ${C.line}`, borderRadius:9, padding:"7px 9px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:4, color:C.dim, fontSize:10, marginBottom:3 }}>
        {icon}{label}
      </div>
      <div style={{ fontFamily:"Azeret Mono,monospace", fontSize:12, color:C.tx }}>{value}</div>
    </div>
  );
}

/* ─────────────────────── OFP TAB ───────────────────────────────── */
export default function OFPTab({ sbUser, setSbUser, ofp, state, error, onLoad, ofpMode, setOfpMode }) {
  const [section, setSection] = useState("weights"); // weights|fuel|route|weather|navlog

  const SECTIONS = [
    { id:"weights", label:"Weights" },
    { id:"fuel",    label:"Fuel" },
    { id:"weather", label:"Weather" },
    { id:"route",   label:"Route" },
    { id:"navlog",  label:"Navlog" },
  ];

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>

      {/* Header + mode toggle */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ fontFamily:"Sora,sans-serif", fontSize:10.5, fontWeight:700,
          letterSpacing:1.6, textTransform:"uppercase", color:C.dim }}>SimBrief OFP</div>
        <div style={{ display:"flex", gap:5 }}>
          {[["simplified","Simplified"],["realistic","Realistic"]].map(([v,l])=>(
            <button key={v} onClick={()=>setOfpMode(v)}
              style={{ fontSize:11, fontWeight:600, borderRadius:99, padding:"4px 12px", cursor:"pointer",
                border:`1px solid ${C.line}`,
                background:ofpMode===v?C.cy:C.p2,
                color:ofpMode===v?"#070b12":C.dim,
                transition:"background .15s,color .15s" }}>{l}</button>
          ))}
        </div>
      </div>

      {/* Fetch bar */}
      <div style={card}>
        <div style={{ display:"flex", gap:10, alignItems:"flex-end" }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:9, color:C.dim, letterSpacing:1, marginBottom:5 }}>SIMBRIEF USERNÉV</div>
            <input value={sbUser} onChange={e=>setSbUser(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&onLoad(sbUser)}
              placeholder="pl. chris_vatsim" style={{ ...inp, width:"100%" }}/>
          </div>
          <button onClick={()=>onLoad(sbUser)}
            style={{ display:"flex", alignItems:"center", gap:6, background:C.cy, color:"#070b12",
              border:"none", borderRadius:10, padding:"9px 18px", fontSize:13, fontWeight:700,
              cursor:"pointer", flexShrink:0, transition:"transform .2s,box-shadow .2s" }}
            onMouseOver={e=>e.currentTarget.style.transform="translateY(-1px)"}
            onMouseOut={e=>e.currentTarget.style.transform="none"}>
            {state==="loading"
              ? <Loader2 size={14} style={{ animation:"spin 1s linear infinite" }}/>
              : <><FileText size={13}/>Betölt</>}
          </button>
        </div>
      </div>

      {state==="error" && (
        <div style={{ display:"flex", alignItems:"center", gap:8, borderRadius:12, padding:"8px 12px",
          background:"rgba(240,96,128,.08)", border:"1px solid rgba(240,96,128,.25)", color:C.rd, fontSize:13 }}>
          <AlertCircle size={14}/>{error}
        </div>
      )}

      {/* ── SIMPLIFIED MODE ── */}
      {ofp && ofpMode==="simplified" && (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          <div style={{ ...card }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
              <Navigation2 size={16} color={C.cy}/>
              <span style={{ fontFamily:"Sora,sans-serif", fontWeight:700, fontSize:16 }}>
                {ofp.dep||"?"} → {ofp.arr||"?"}
              </span>
              {ofp.altn && <span style={{ fontSize:12, color:C.dim }}>ALTN: {ofp.altn}</span>}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              <SimplRow icon={<Users size={13}/>}     label="Utasok"   value={ofp.pax??  "—"} />
              <SimplRow icon={<Weight size={13}/>}    label="Payload"  value={ofp.payload!=null?`${ofp.payload} ${ofp.units}`:"—"} />
              <SimplRow icon={<Weight size={13}/>}    label="ZFW"      value={ofp.zfw!=null?`${ofp.zfw} ${ofp.units}`:"—"} />
              <SimplRow icon={<Weight size={13}/>}    label="TOW"      value={ofp.tow!=null?`${ofp.tow} ${ofp.units}`:"—"} />
              <SimplRow icon={<Fuel size={13}/>}      label="Block"    value={ofp.blockFuel!=null?`${ofp.blockFuel} ${ofp.units}`:"—"} accent={C.am} />
              <SimplRow icon={<ArrowDownRight size={13}/>} label="CI"  value={ofp.costindex??  "—"} />
              <SimplRow icon={<Clock size={13}/>}     label="ETE"      value={ofp.ete||"—"} />
              <SimplRow icon={<MapPin size={13}/>}    label="Dist"     value={ofp.routeDistanceNm?`${ofp.routeDistanceNm} nm`:"—"} />
            </div>
          </div>
          {/* Weather quick view */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            {ofp.dep && <WeatherCard icao={ofp.dep} label="Departure"/>}
            {ofp.arr && <WeatherCard icao={ofp.arr} label="Destination"/>}
          </div>
        </div>
      )}

      {/* ── REALISTIC MODE ── */}
      {ofp && ofpMode==="realistic" && (<>
        {/* Section tabs */}
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {SECTIONS.map(s=>(
            <button key={s.id} onClick={()=>setSection(s.id)}
              style={{ fontSize:11, fontWeight:600, borderRadius:99, padding:"5px 14px", cursor:"pointer",
                border:`1px solid ${C.line}`,
                background:section===s.id?"var(--cy, #5ec8ff)":C.p2,
                color:section===s.id?"#070b12":C.dim,
                transition:"background .15s,color .15s" }}>{s.label}</button>
          ))}
        </div>

        {/* WEIGHTS */}
        {section==="weights" && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
            {[
              ["PAX",        ofp.pax,                                       <Users size={14}/>],
              ["Cargo",      ofp.cargo!=null?`${ofp.cargo} ${ofp.units}`:null, <Weight size={14}/>],
              ["Payload",    ofp.payload!=null?`${ofp.payload} ${ofp.units}`:null, <Weight size={14}/>],
              ["ZFW",        ofp.zfw!=null?`${ofp.zfw} ${ofp.units}`:null,  <Weight size={14}/>],
              ["TOW",        ofp.tow!=null?`${ofp.tow} ${ofp.units}`:null,  <Weight size={14}/>],
              ["Cost Index", ofp.costindex,                                 <ArrowDownRight size={14}/>],
            ].map(([l,v,icon])=>(
              <StatCard key={l} label={l} value={v??  "—"} icon={icon}/>
            ))}
          </div>
        )}

        {/* FUEL */}
        {section==="fuel" && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
            {[
              ["Block",       ofp.blockFuel,      C.am],
              ["Trip",        ofp.enrouteBurn,    null],
              ["Contingency", ofp.contFuel,       null],
              ["Alternate",   ofp.altFuel,        null],
              ["Reserve",     ofp.resFuel,        null],
              ["Extra",       ofp.extraFuel,      C.gn],
            ].map(([l,v,accent])=>(
              <StatCard key={l} label={l}
                value={v!=null?`${v} ${ofp.units}`:"—"}
                icon={<Fuel size={14}/>} accent={accent}/>
            ))}
          </div>
        )}

        {/* WEATHER */}
        {section==="weather" && (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              {ofp.dep && <WeatherCard icao={ofp.dep} label="Departure"/>}
              {ofp.arr && <WeatherCard icao={ofp.arr} label="Destination"/>}
            </div>
            {ofp.altn && (
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <WeatherCard icao={ofp.altn} label="Alternate"/>
              </div>
            )}
          </div>
        )}

        {/* ROUTE */}
        {section==="route" && (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            <div style={card}>
              <div style={{ fontSize:9, color:C.dim, marginBottom:6, letterSpacing:1 }}>ATC ROUTE</div>
              <div style={{ fontFamily:"Azeret Mono,monospace", fontSize:12.5,
                lineHeight:1.8, wordBreak:"break-all", color:C.tx }}>{ofp.route||"—"}</div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
              <StatCard label="Distance"  value={ofp.routeDistanceNm?`${ofp.routeDistanceNm} nm`:"—"} icon={<MapPin size={14}/>}/>
              <StatCard label="ETE"       value={ofp.ete||"—"}   icon={<Clock size={14}/>}/>
              <StatCard label="Alternate" value={ofp.altn||"—"}  icon={<Navigation2 size={14}/>}/>
            </div>
          </div>
        )}

        {/* NAVLOG */}
        {section==="navlog" && (
          <div style={{ ...card, padding:0, overflow:"hidden" }}>
            <table style={{ width:"100%", borderCollapse:"collapse",
              fontFamily:"Azeret Mono,monospace", fontSize:11 }}>
              <thead>
                <tr style={{ color:C.dim, textAlign:"left", background:C.p2, fontSize:10 }}>
                  {["FIX","STAGE","ALT ft","LAT","LON"].map(h=>(
                    <th key={h} style={{ padding:"8px 12px", letterSpacing:.5 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(ofp.fixes||[]).map((f,i)=>(
                  <tr key={f.ident+i} style={{ borderTop:`1px solid ${C.line}`,
                    background:i%2===0?"transparent":"rgba(17,28,43,.4)" }}>
                    <td style={{ padding:"6px 12px", color:C.cy, fontWeight:600 }}>{f.ident}</td>
                    <td style={{ padding:"6px 12px", color:C.dim }}>{f.stage||"—"}</td>
                    <td style={{ padding:"6px 12px" }}>{f.altitude??  "—"}</td>
                    <td style={{ padding:"6px 12px", color:C.dim }}>{f.lat?.toFixed(2)??  "—"}</td>
                    <td style={{ padding:"6px 12px", color:C.dim }}>{f.lon?.toFixed(2)??  "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </>)}
    </div>
  );
}

function SimplRow({ icon, label, value, accent }) {
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
      padding:"7px 10px", background:C.p2, borderRadius:9, border:`1px solid ${C.line}` }}>
      <span style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, color:C.dim }}>{icon}{label}</span>
      <span style={{ fontFamily:"Azeret Mono,monospace", fontSize:12.5, color:accent||C.tx }}>{value}</span>
    </div>
  );
}

function StatCard({ label, value, icon, accent }) {
  return (
    <div style={{ background:C.p2, border:`1px solid ${C.line}`, borderRadius:12, padding:12,
      boxShadow:`0 0 0 1px ${C.line}` }}>
      <div style={{ display:"flex", alignItems:"center", gap:5, color:C.dim, fontSize:10,
        marginBottom:6, letterSpacing:.5 }}>{icon}{label.toUpperCase()}</div>
      <div style={{ fontFamily:"Azeret Mono,monospace", fontSize:17,
        color:accent||C.tx }}>{value}</div>
    </div>
  );
}

export { WeatherCard };
