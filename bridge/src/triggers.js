/* Alert engine. Evaluates armed triggers against live telemetry + OFP fixes.
 * Trigger kinds:
 *   { kind: 'fix',  fix: 'VETIK', lead: 5 }   -> N min before a named/route fix
 *   { kind: 'tod',  lead: 3 }                 -> N min before Top of Descent
 *   { kind: 'dest', lead: 10 }                -> N min before destination */
import { distanceNm, eteMin, eteToTodMin } from "./geo.js";

export function createEngine() {
  const fired = new Set();                       // ids already pushed this flight

  function reset() { fired.clear(); }

  // returns array of { id, title, body } to push now
  function evaluate(telemetry, triggers, ofp) {
    const out = [];
    const pos = { lat: telemetry.lat, lon: telemetry.lon };
    const gs = telemetry.gsKt;
    const fieldElev = 0;                          // could read from OFP destination elevation

    for (const tr of triggers) {
      if (!tr.armed || fired.has(tr.id)) continue;
      let ete = Infinity, body = "";

      if (tr.kind === "tod") {
        const distDestNm = (telemetry.destEteMin || 0) * gs / 60;   // min * kt / 60 = nm
        ete = eteToTodMin(distDestNm, telemetry.altFt, gs, fieldElev);
        body = "Top of Descent közeleg — kezdj ereszkedni";
      } else if (tr.kind === "dest") {
        ete = telemetry.destEteMin || Infinity;
        body = `${Math.round((telemetry.destEteMin || 0))} perc a ${ofp?.arr || "célállomásig"}`;
      } else { // 'fix'
        const target = findFix(tr.fix, ofp);
        if (!target) continue;
        const d = distanceNm(pos, target);          // direct great-circle (good for a heads-up)
        ete = eteMin(d, gs);
        body = `${tr.fix} — ${Math.round(d)} nm hátra`;
      }

      if (ete <= tr.lead) {
        fired.add(tr.id);
        out.push({ id: tr.id, title: `${labelOf(tr)} − ${tr.lead} perc`, body });
      }
    }
    return out;
  }

  return { evaluate, reset };
}

function labelOf(tr) {
  if (tr.kind === "tod") return "T/D";
  if (tr.kind === "dest") return "Landing";
  return tr.fix;
}

function findFix(ident, ofp) {
  if (!ofp?.fixes) return null;
  const f = ofp.fixes.find((x) => x.ident?.toUpperCase() === String(ident).toUpperCase());
  return f && f.lat != null ? { lat: f.lat, lon: f.lon } : null;
}
