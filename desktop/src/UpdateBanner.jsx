import React, { useState, useEffect } from "react";

/* UpdateBanner — shows when a new codename release is available.
 * Listens for IPC events from the updater module.
 * Props: none — subscribes to window.skybound.onUpdater internally. */

const C = {
  am: "#ffb454", gn: "#52e3b0", line: "#1a2a3d", p2: "#111c2b", dim: "#5a7090",
};

export default function UpdateBanner() {
  const [state, setState]   = useState("idle");
  const [info,  setInfo]    = useState(null);

  useEffect(() => {
    window.skybound?.onUpdater?.((event, data) => {
      if (event === "checking")  setState("checking");
      if (event === "latest")  { setState("latest"); setTimeout(() => setState("idle"), 3000); }
      if (event === "available") { setState("available"); setInfo(data); }
      if (event === "error")     setState("idle");
    });
  }, []);

  if (state === "idle" || state === "checking") return null;

  if (state === "latest") return (
    <div style={banner("rgba(82,227,176,.06)", "rgba(82,227,176,.2)")}>
      <span style={{ color: C.gn, fontSize: 12.5 }}>✓ Naprakész — {info?.codename || ""}</span>
    </div>
  );

  if (state === "available") return (
    <div style={banner("rgba(255,180,84,.07)", "rgba(255,180,84,.22)")}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
        <span style={{ fontSize: 13, color: C.am }}>
          🆕 Új verzió: <strong>{info?.codename}</strong>
          {info?.current ? <span style={{ color: C.dim, fontSize: 11 }}> (jelenlegi: {info.current})</span> : null}
        </span>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {info?.downloadUrl && (
          <Btn
            label="Letöltés"
            accent={C.am}
            onClick={() => window.skybound?.openExternal(info.downloadUrl)}
          />
        )}
        <Btn
          label="Release notes"
          accent={C.dim}
          onClick={() => window.skybound?.openExternal(info.releaseUrl)}
        />
      </div>
    </div>
  );

  return null;
}

function Btn({ label, accent, onClick }) {
  return (
    <button onClick={onClick}
      style={{ fontSize: 11, fontWeight: 600, borderRadius: 99, padding: "4px 12px",
        cursor: "pointer", border: `1px solid ${accent}40`,
        background: `${accent}15`, color: accent,
        transition: "opacity .15s" }}
      onMouseOver={e => e.currentTarget.style.opacity = ".75"}
      onMouseOut={e  => e.currentTarget.style.opacity = "1"}>
      {label}
    </button>
  );
}

function banner(bg, border) {
  return {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "7px 20px", flexShrink: 0,
    background: bg, borderBottom: `1px solid ${border}`,
    animation: "slideDown .35s cubic-bezier(.34,1.2,.64,1)",
  };
}
