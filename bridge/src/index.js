import "dotenv/config";
import { startSim } from "./sim.js";
import { startFsuipc } from "./fsuipc_sim.js";
import { createEngine } from "./triggers.js";
import { fetchOFP } from "../../shared/simbrief.js";
import { initFirebase, writeLive, watchTriggers, pushToDevices, clearLive } from "./firebase.js";
import { todDistanceNm } from "./geo.js";

const SESSION  = process.env.SKYBOUND_SESSION;
const SVC      = process.env.FIREBASE_SERVICE_ACCOUNT;
const SB_USER  = process.env.SIMBRIEF_USERNAME;
const args     = process.argv.slice(2);
let SIM_MODE   = process.env.SIM_MODE || "auto";
if (args.includes("--fsuipc"))     SIM_MODE = "fsuipc7";
if (args.includes("--simconnect")) SIM_MODE = "simconnect";

if (!SESSION || !SVC) {
  console.error("Hiányzik: SKYBOUND_SESSION és/vagy FIREBASE_SERVICE_ACCOUNT a .env-ben");
  process.exit(1);
}

let ofp = null, triggers = [];
const engine = createEngine();

// Clear live data on exit
async function onExit() {
  console.log("[bridge] kilépés — live adatok törlése...");
  try { await clearLive(SESSION); } catch {}
  process.exit(0);
}
process.on("SIGINT",  onExit);
process.on("SIGTERM", onExit);
process.on("SIGHUP",  onExit);

async function loadOFP() {
  try {
    ofp = await fetchOFP({ username: SB_USER });
    console.log(`[ofp] ${ofp.dep}→${ofp.arr}`);
  } catch(e) { console.warn("[ofp] load failed:", e.message); }
}

let lastWrite = 0;
let lastDataTs = 0;
const DATA_TIMEOUT_MS = 15000; // 15s no data → clear live

function handleTelemetry(telemetry) {
  const now = Date.now();
  lastDataTs = now;
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

// Watchdog: clear live data if no telemetry for 15s
setInterval(async () => {
  if (lastDataTs > 0 && Date.now() - lastDataTs > DATA_TIMEOUT_MS) {
    console.warn("[bridge] Nincs adat 15s óta — live adatok törlése");
    lastDataTs = 0;
    try { await clearLive(SESSION); } catch {}
  }
}, 5000);

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
    console.log("[bridge] Mode: auto");
    try {
      await startFsuipc(handleTelemetry);
    } catch(e) {
      console.warn("[bridge] FSUIPC7 nem elérhető, SimConnect...");
      await startSim(handleTelemetry);
    }
  }
  console.log("[bridge] fut...");
}

main().catch(e => { console.error(e); process.exit(1); });
