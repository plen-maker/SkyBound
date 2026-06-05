import "dotenv/config";
import { startSim } from "./sim.js";
import { startFsuipc } from "./fsuipc_sim.js";
import { createEngine } from "./triggers.js";
import { fetchOFP } from "../../shared/simbrief.js";
import { initFirebase, writeLive, watchTriggers, pushToDevices } from "./firebase.js";
import { todDistanceNm } from "./geo.js";

const SESSION  = process.env.SKYBOUND_SESSION;
const SVC      = process.env.FIREBASE_SERVICE_ACCOUNT;
const SB_USER  = process.env.SIMBRIEF_USERNAME;
const SIM_MODE = (process.env.SIM_MODE || "auto").toLowerCase(); // "simconnect" | "fsuipc7" | "auto"

if (!SESSION || !SVC) {
  console.error("Hiányzik: SKYBOUND_SESSION és/vagy FIREBASE_SERVICE_ACCOUNT a .env-ben");
  process.exit(1);
}

let ofp = null, triggers = [];
const engine = createEngine();

async function loadOFP() {
  try {
    ofp = await fetchOFP({ username: SB_USER });
    console.log(`[ofp] ${ofp.dep}→${ofp.arr}  pax ${ofp.pax}  payload ${ofp.payload} ${ofp.units}`);
  } catch(e) { console.warn("[ofp] load failed:", e.message); }
}

async function handleTelemetry(telemetry) {
  const derived = {
    todDistNm: todDistanceNm(telemetry.altFt, 0),
    ofp: ofp && {
      dep:ofp.dep, arr:ofp.arr, pax:ofp.pax,
      payload:ofp.payload, blockFuel:ofp.blockFuel,
      units:ofp.units, route:ofp.route
    },
  };

  writeLive(SESSION, telemetry, derived).catch(() => {});

  const events = engine.evaluate(telemetry, triggers, ofp);
  for (const ev of events)
    pushToDevices(SESSION, { title: ev.title, body: ev.body }).catch(() => {});
}

async function main() {
  initFirebase(SVC);
  await loadOFP();
  setInterval(loadOFP, 5 * 60 * 1000);
  watchTriggers(SESSION, t => { triggers = t; });

  let lastWrite = 0;
  const throttled = (t) => {
    const now = Date.now();
    if (now - lastWrite > 900) { lastWrite = now; handleTelemetry(t); }
  };

  // ── Sim source selection ─────────────────────────────────────────
  if (SIM_MODE === "fsuipc7") {
    console.log("[bridge] Mode: FSUIPC7 (forced)");
    await startFsuipc(throttled);

  } else if (SIM_MODE === "simconnect") {
    console.log("[bridge] Mode: SimConnect (forced)");
    await startSim(throttled);

  } else {
    // Auto: try FSUIPC7 first, fall back to SimConnect
    console.log("[bridge] Mode: auto — trying FSUIPC7 first...");
    try {
      await startFsuipc(throttled);
      console.log("[bridge] Using FSUIPC7 ✓");
    } catch(e) {
      console.warn("[bridge] FSUIPC7 not available:", e.message);
      console.log("[bridge] Falling back to SimConnect...");
      await startSim(throttled);
    }
  }

  console.log("[bridge] fut. Várja az MSFS-t...");
}

main().catch(e => { console.error(e); process.exit(1); });
