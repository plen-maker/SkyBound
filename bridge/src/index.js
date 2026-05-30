import "dotenv/config";
import { startSim } from "./sim.js";
import { createEngine } from "./triggers.js";
import { fetchOFP } from "../../shared/simbrief.js";
import { initFirebase, writeLive, watchTriggers, pushToDevices } from "./firebase.js";
import { todDistanceNm } from "./geo.js";

const SESSION = process.env.SKYBOUND_SESSION;   // e.g. ddnemet-host
const SVC     = process.env.FIREBASE_SERVICE_ACCOUNT;
const SB_USER = process.env.SIMBRIEF_USERNAME;

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

async function main() {
  initFirebase(SVC);
  await loadOFP();
  setInterval(loadOFP, 5 * 60 * 1000);
  watchTriggers(SESSION, t => { triggers = t; });

  let lastWrite = 0;
  await startSim(async (telemetry) => {
    const derived = {
      todDistNm: todDistanceNm(telemetry.altFt, 0),
      ofp: ofp && { dep:ofp.dep, arr:ofp.arr, pax:ofp.pax, payload:ofp.payload, blockFuel:ofp.blockFuel, units:ofp.units, route:ofp.route },
    };
    const now = Date.now();
    if (now - lastWrite > 900) {
      lastWrite = now;
      writeLive(SESSION, telemetry, derived).catch(() => {});
    }
    const events = engine.evaluate(telemetry, triggers, ofp);
    for (const ev of events) pushToDevices(SESSION, { title: ev.title, body: ev.body }).catch(() => {});
  });
  console.log("[bridge] fut. Várja az MSFS-t és a telefont…");
}
main().catch(e => { console.error(e); process.exit(1); });
