import React, { useState } from "react";
import { Map as MapIcon, ExternalLink, Globe } from "lucide-react";

const C = {
  panel:"#0d1520", p2:"#111c2b", line:"#1a2a3d",
  cy:"#5ec8ff", am:"#ffb454", gn:"#52e3b0", tx:"#cdd9ec", dim:"#5a7090",
};

const PROVIDERS = [
  {
    id: "navigraph",
    name: "Navigraph Charts",
    desc: "Jeppesen-stílusú chartok — előfizetés szükséges",
    url: (icao) => `https://charts.navigraph.com/`,
    color: C.cy,
    badge: "Előfizetéses",
  },
  {
    id: "lido",
    name: "FltPlan / Lido (MSFS)",
    desc: "Microsoft Flight Simulator beépített Lido chartjai",
    url: (icao) => `https://planner.flightsimulator.com/`,
    color: "#7c8cff",
    badge: "MSFS",
  },
  {
    id: "avare",
    name: "SkyVector",
    desc: "Ingyenes IFR/VFR chartok",
    url: (icao) => icao ? `https://skyvector.com/airport/${icao}` : "https://skyvector.com",
    color: C.gn,
    badge: "Ingyenes",
  },
  {
    id: "eurocontrol",
    name: "AIP / eAIP",
    desc: "Európai hivatalos AIP chartok",
    url: (icao) => `https://www.eurocontrol.int/service/aeronautical-information-services`,
    color: C.am,
    badge: "Hivatal",
  },
];

const CHART_TYPES = ["SID","STAR","APP","AD","TAXI"];

export default function ChartsTab({ ofp }) {
  const [icao, setIcao] = useState(ofp?.arr || ofp?.dep || "");
  const [chartType, setChartType] = useState("APP");

  // Update icao when ofp changes
  React.useEffect(() => {
    if (ofp?.arr && !icao) setIcao(ofp.arr);
  }, [ofp]);

  const open = (url) => {
    if (window.sb?.openInApp) window.sb.openInApp(url);
    else if (window.skybound?.openInApp) window.skybound.openInApp(url);
    else window.open(url, "_blank");
  };

  const quickIcaos = [ofp?.dep, ofp?.arr, ofp?.altn].filter(Boolean);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      <div style={{ fontFamily:"Sora,sans-serif", fontSize:10.5, fontWeight:700,
        letterSpacing:1.6, textTransform:"uppercase", color:C.dim }}>Charts</div>

      {/* Airport selector */}
      <div style={{ background:C.panel, border:`1px solid ${C.line}`, borderRadius:16, padding:14,
        boxShadow:`0 0 0 1px ${C.line}` }}>
        <div style={{ display:"flex", gap:10, alignItems:"flex-end", marginBottom:quickIcaos.length?12:0 }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:9, color:C.dim, letterSpacing:1, marginBottom:5 }}>AIRPORT ICAO</div>
            <input value={icao} onChange={e=>setIcao(e.target.value.toUpperCase())}
              placeholder="pl. LHBP" maxLength={4}
              style={{ background:C.p2, border:`1px solid ${C.line}`, color:C.tx,
                fontSize:16, borderRadius:8, padding:"8px 12px", width:"100%",
                fontFamily:"Azeret Mono,monospace", outline:"none", letterSpacing:2 }}/>
          </div>
          <div>
            <div style={{ fontSize:9, color:C.dim, letterSpacing:1, marginBottom:5 }}>CHART TYPE</div>
            <div style={{ display:"flex", gap:5 }}>
              {CHART_TYPES.map(t=>(
                <button key={t} onClick={()=>setChartType(t)}
                  style={{ fontSize:11, fontWeight:600, borderRadius:8, padding:"8px 10px",
                    cursor:"pointer", border:`1px solid ${C.line}`,
                    background:chartType===t?C.cy:C.p2,
                    color:chartType===t?"#070b12":C.dim }}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Quick ICAO buttons from OFP */}
        {quickIcaos.length > 0 && (
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {quickIcaos.map((ic,i) => (
              <button key={ic} onClick={()=>setIcao(ic)}
                style={{ fontSize:11, fontWeight:600, borderRadius:99, padding:"4px 12px",
                  cursor:"pointer", border:`1px solid ${C.line}`,
                  background:icao===ic?C.cy:C.p2,
                  color:icao===ic?"#070b12":[C.gn,C.cy,C.am][i]||C.dim }}>
                {ic} {["DEP","ARR","ALTN"][i]}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Provider cards */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        {PROVIDERS.map(p => {
          const url = p.url(icao);
          return (
            <div key={p.id}
              style={{ background:C.panel, border:`1px solid ${C.line}`, borderRadius:16,
                padding:14, cursor:"pointer", transition:"border-color .15s,transform .3s cubic-bezier(.34,1.56,.64,1)",
                boxShadow:`0 0 0 1px ${C.line}` }}
              onClick={()=>open(url)}
              onMouseOver={e=>{ e.currentTarget.style.borderColor=p.color; e.currentTarget.style.transform="translateY(-2px)"; }}
              onMouseOut={e=>{ e.currentTarget.style.borderColor=C.line; e.currentTarget.style.transform="none"; }}>
              <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:8 }}>
                <div style={{ width:36, height:36, borderRadius:9, background:C.p2,
                  border:`1px solid ${C.line}`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <Globe size={16} color={p.color}/>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ borderRadius:99, padding:"2px 8px", fontSize:10, fontWeight:600,
                    background:`${p.color}18`, border:`1px solid ${p.color}40`, color:p.color }}>
                    {p.badge}
                  </span>
                  <ExternalLink size={12} color={C.dim}/>
                </div>
              </div>
              <div style={{ fontFamily:"Sora,sans-serif", fontWeight:700, fontSize:13, marginBottom:4 }}>{p.name}</div>
              <div style={{ fontSize:11, color:C.dim, lineHeight:1.5 }}>{p.desc}</div>
              {icao && (
                <div style={{ marginTop:8, fontFamily:"Azeret Mono,monospace", fontSize:11,
                  color:p.color, opacity:.7 }}>{icao} · {chartType}</div>
              )}
            </div>
          );
        })}
      </div>

      {/* In-app note */}
      <div style={{ fontSize:11, color:C.dim, lineHeight:1.6, padding:"8px 12px",
        background:C.p2, border:`1px solid ${C.line}`, borderRadius:10 }}>
        A chartok a Settings → Linkek beállítástól függően nyílnak meg az app-on belül vagy a böngészőben.
        A Navigraph és MSFS Lido bejelentkezést igényel.
      </div>
    </div>
  );
}
