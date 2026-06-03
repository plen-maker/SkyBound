import React, { useState, useEffect, useCallback } from "react";
import { Radio, RefreshCw, Mic, ChevronDown, ChevronUp, Wifi, AlertCircle } from "lucide-react";

const C = {
  bg:"#070b12", panel:"#0d1520", p2:"#111c2b", line:"#1a2a3d",
  cy:"#5ec8ff", am:"#ffb454", gn:"#52e3b0", rd:"#f06080", tx:"#cdd9ec", dim:"#5a7090",
};

const FACILITY = { 0:"OBS", 1:"FSS", 2:"DEL", 3:"GND", 4:"TWR", 5:"APP", 6:"CTR" };
const FAC_COLOR = {
  DEL:"#a78bfa", GND:"#52e3b0", TWR:"#5ec8ff", APP:"#ffb454", CTR:"#f06080", FSS:"#94a3b8", OBS:"#5a7090",
};

// Match a callsign prefix to an ICAO (e.g. LHBP_TWR -> LHBP, EGLL_APP -> EGLL)
function callsignToIcao(cs) { return cs.split("_")[0]; }

// Given route fixes + dep/arr, find which ICAOs are "relevant"
function relevantIcaos(ofp) {
  const icaos = new Set();
  if (ofp?.dep)  icaos.add(ofp.dep);
  if (ofp?.arr)  icaos.add(ofp.arr);
  if (ofp?.altn) icaos.add(ofp.altn);
  // add enroute FIR prefixes from fixes (first 2 chars as rough FIR match)
  (ofp?.fixes||[]).forEach(f => { if (f.ident?.length >= 4) icaos.add(f.ident.slice(0,2)); });
  return icaos;
}

async function fetchVatsim() {
  const r = await fetch("https://data.vatsim.net/v3/vatsim-data.json");
  if (!r.ok) throw new Error(`VATSIM HTTP ${r.status}`);
  return r.json();
}

function AtcBadge({ fac }) {
  const color = FAC_COLOR[fac] || C.dim;
  return (
    <span style={{ borderRadius:99, padding:"1px 7px", fontSize:10, fontWeight:700,
      background:`${color}18`, border:`1px solid ${color}40`, color, flexShrink:0 }}>{fac}</span>
  );
}

function AtcRow({ ctrl, atis }) {
  const [open, setOpen] = useState(false);
  const fac = FACILITY[ctrl.facility] || "CTR";
  const color = FAC_COLOR[fac] || C.dim;
  const hasAtis = atis?.text_atis?.length > 0;

  return (
    <div style={{ background:C.p2, border:`1px solid ${C.line}`, borderRadius:12,
      overflow:"hidden", transition:"border-color .15s" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px",
        cursor:hasAtis?"pointer":"default" }}
        onClick={()=>hasAtis&&setOpen(!open)}>
        <AtcBadge fac={fac}/>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontFamily:"Azeret Mono,monospace", fontWeight:600, fontSize:13, color:C.tx }}>
              {ctrl.callsign}
            </span>
            {atis && (
              <span style={{ borderRadius:99, padding:"1px 6px", fontSize:10,
                background:"rgba(94,200,255,.1)", border:"1px solid rgba(94,200,255,.2)", color:C.cy }}>
                ATIS {atis.atis_code}
              </span>
            )}
          </div>
          <div style={{ fontSize:11, color:C.dim, marginTop:1 }}>{ctrl.name}</div>
        </div>
        <div style={{ fontFamily:"Azeret Mono,monospace", fontSize:13, color:C.am, flexShrink:0 }}>
          {ctrl.frequency}
        </div>
        {hasAtis && (
          <div style={{ color:C.dim, flexShrink:0 }}>
            {open ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}
          </div>
        )}
      </div>

      {open && hasAtis && (
        <div style={{ padding:"0 12px 10px", borderTop:`1px solid ${C.line}` }}>
          <div style={{ marginTop:8, background:C.bg, border:`1px solid ${C.line}`, borderRadius:8,
            padding:"8px 10px", fontFamily:"Azeret Mono,monospace", fontSize:11,
            color:C.dim, lineHeight:1.6 }}>
            {atis.text_atis.join(" ")}
          </div>
        </div>
      )}
    </div>
  );
}

export default function VatsimTab({ ofp }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [lastUpd, setLastUpd] = useState(null);
  const [filter,  setFilter]  = useState("route"); // route | all

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const d = await fetchVatsim();
      setData(d);
      setLastUpd(new Date());
    } catch(e) { setError(e.message); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, []);

  // Build lookup: callsign -> atis
  const atisMap = {};
  (data?.atis||[]).forEach(a => { atisMap[a.callsign] = a; });

  // Filter controllers
  const relevantPfx = relevantIcaos(ofp);
  const controllers = (data?.controllers||[]).filter(c => {
    if (filter === "all") return c.facility > 0;
    const icao = callsignToIcao(c.callsign);
    // match dep/arr/altn exactly, or enroute CTR by prefix
    if (ofp?.dep && icao === ofp.dep) return true;
    if (ofp?.arr && icao === ofp.arr) return true;
    if (ofp?.altn && icao === ofp.altn) return true;
    if (c.facility === 6) { // CTR — check if any route fix starts with this prefix
      return (ofp?.fixes||[]).some(f => f.ident?.startsWith(icao.slice(0,2)));
    }
    return false;
  }).sort((a,b) => {
    // Sort: dep first, then enroute, then arr
    const ia = callsignToIcao(a.callsign), ib = callsignToIcao(b.callsign);
    const order = x => x===ofp?.dep?0:x===ofp?.arr?2:1;
    return order(ia) - order(ib);
  });

  // Group by airport
  const grouped = {};
  controllers.forEach(c => {
    const icao = callsignToIcao(c.callsign);
    if (!grouped[icao]) grouped[icao] = [];
    grouped[icao].push(c);
  });

  const totalOnline = data?.controllers?.filter(c=>c.facility>0).length || 0;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ fontFamily:"Sora,sans-serif", fontSize:10.5, fontWeight:700,
          letterSpacing:1.6, textTransform:"uppercase", color:C.dim }}>
          VATSIM ATC
          {data && <span style={{ fontWeight:400, color:C.dim, marginLeft:8, fontSize:10 }}>
            {totalOnline} online · frissítve {lastUpd?.toLocaleTimeString("hu",{hour:"2-digit",minute:"2-digit"})}
          </span>}
        </div>
        <div style={{ display:"flex", gap:6 }}>
          {[["route","Route only"],["all","All ATC"]].map(([v,l])=>(
            <button key={v} onClick={()=>setFilter(v)}
              style={{ fontSize:11, fontWeight:600, borderRadius:99, padding:"4px 12px", cursor:"pointer",
                border:`1px solid ${C.line}`, background:filter===v?C.cy:C.p2,
                color:filter===v?"#070b12":C.dim }}>
              {l}
            </button>
          ))}
          <button onClick={load} style={{ background:C.p2, border:`1px solid ${C.line}`,
            borderRadius:8, padding:"5px 8px", color:C.dim, cursor:"pointer", display:"flex" }}>
            <RefreshCw size={13} style={{ animation:loading?"spin 1s linear infinite":undefined }}/>
          </button>
        </div>
      </div>

      {error && (
        <div style={{ display:"flex", alignItems:"center", gap:8, borderRadius:12, padding:"8px 12px",
          background:"rgba(240,96,128,.08)", border:"1px solid rgba(240,96,128,.25)", color:C.rd, fontSize:13 }}>
          <AlertCircle size={14}/>{error}
        </div>
      )}

      {!ofp && filter==="route" && (
        <div style={{ background:C.p2, border:`1px solid ${C.line}`, borderRadius:12,
          padding:14, fontSize:12, color:C.dim, textAlign:"center" }}>
          Tölts be egy SimBrief OFP-t a route-alapú ATC szűrőhöz.
        </div>
      )}

      {loading && !data && (
        <div style={{ color:C.dim, fontSize:12, textAlign:"center", padding:20 }}>VATSIM betöltése…</div>
      )}

      {/* Controllers grouped by airport */}
      {Object.entries(grouped).map(([icao, ctrls]) => (
        <div key={icao}>
          <div style={{ fontSize:10, color:C.dim, letterSpacing:1.5, marginBottom:6,
            display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontFamily:"Azeret Mono,monospace", fontWeight:700, color:
              icao===ofp?.dep?C.gn:icao===ofp?.arr?C.cy:icao===ofp?.altn?C.am:C.dim }}>
              {icao}
            </span>
            {icao===ofp?.dep && <span style={{ color:C.gn }}>DEP</span>}
            {icao===ofp?.arr && <span style={{ color:C.cy }}>ARR</span>}
            {icao===ofp?.altn && <span style={{ color:C.am }}>ALTN</span>}
            <div style={{ flex:1, height:1, background:C.line }}/>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {ctrls.map(c => (
              <AtcRow key={c.callsign} ctrl={c} atis={atisMap[c.callsign.replace("_","_ATIS")] || null}/>
            ))}
          </div>
        </div>
      ))}

      {data && controllers.length === 0 && (
        <div style={{ background:C.p2, border:`1px solid ${C.line}`, borderRadius:12,
          padding:16, fontSize:12, color:C.dim, textAlign:"center" }}>
          {filter==="route"
            ? "Nincs aktív ATC a route mentén. Próbáld az \"All ATC\" szűrőt."
            : "Nincs online ATC."}
        </div>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
