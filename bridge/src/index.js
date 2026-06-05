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

// Mode from command line args or env
const args = process.argv.slice(2);
let SIM_MODE = process.env.SIM_MODE || "auto";
if (args.includes("--fsuipc")) SIM_MODE = "fsuipc7";
if (args.includes("--simconnect")) SIM_MODE = "simconnect";

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

let lastWrite = 0;
function handleTelemetry(telemetry) {
  const now = Date.now();
  if (now - lastWrite < 900) return;
  lastWrite = now;
  const derived = {
    todDistNm: todDistanceNm(telemetry.altFt, 0),
    ofp: ofp && { dep:ofp.dep, arr:ofp.arr, pax:ofp.pax, payload:ofp.payload, blockFuel:ofp.blockFuel, units:ofp.units, route:ofp.route },
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

  if (SIM_MODE === "fsuipc7") {
    console.log("[bridge] Mode: FSUIPC7");
    await startFsuipc(handleTelemetry);
  } else if (SIM_MODE === "simconnect") {
    console.log("[bridge] Mode: SimConnect");
    await startSim(handleTelemetry);
  } else {
    console.log("[bridge] Mode: auto — trying FSUIPC7 first...");
    try {
      await startFsuipc(handleTelemetry);
      console.log("[bridge] Using FSUIPC7 ✓");
    } catch(e) {
      console.warn("[bridge] FSUIPC7 not available:", e.message);
      console.log("[bridge] Falling back to SimConnect...");
      await startSim(handleTelemetry);
    }
  }

  console.log("[bridge] fut. Várja az MSFS-t...");
}

main().catch(e => { console.error(e); process.exit(1); });
