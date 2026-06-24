import "dotenv/config";
import { startSim } from "./sim.js";
import { startFsuipc } from "./fsuipc_sim.js";
import { startMock } from "./mock_sim.js";
import { createEngine } from "./triggers.js";
import { fetchOFP } from "../../shared/simbrief.js";
import { initFirebase, writeLive, writeLanding, watchTriggers, pushToDevices, clearLive } from "./firebase.js";
import { todDistanceNm } from "./geo.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SESSION  = process.env.SKYBOUND_SESSION;
const SB_USER  = process.env.SIMBRIEF_USERNAME;
const args     = process.argv.slice(2);
let SIM_MODE   = process.env.SIM_MODE || "auto";
if (args.includes("--fsuipc"))     SIM_MODE = "fsuipc7";
if (args.includes("--simconnect")) SIM_MODE = "simconnect";
if (args.includes("--mock"))       SIM_MODE = "mock";

if (!SESSION) {
  console.error("Hiányzik: SKYBOUND_SESSION a .env-ben");
  process.exit(1);
}

function findServiceAccount() {
  const candidates = [
    process.env.FIREBASE_SERVICE_ACCOUNT,
    process.execPath ? path.join(path.dirname(process.execPath), "serviceAccount.json") : null,
    path.join(path.dirname(fileURLToPath(import.meta.url)), "../../serviceAccount.json"),
    path.join(path.dirname(fileURLToPath(import.meta.url)), "../serviceAccount.json"),
    path.join(path.dirname(fileURLToPath(import.meta.url)), "serviceAccount.json"),
    path.join(process.cwd(), "serviceAccount.json"),
    "C:\\Program Files\\Xdeck EFB\\bridge\\serviceAccount.json",
  ].filter(Boolean);

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      console.log(`[fb] Service account: ${p}`);
      return p;
    }
  }
  return null;
}

const SVC = findServiceAccount();
const HAS_REFRESH = !!process.env.FIREBASE_REFRESH_TOKEN;
const OFFLINE = !SVC && !HAS_REFRESH;
if (OFFLINE) {
  console.warn("[bridge] OFFLINE — nincs service account és nincs FIREBASE_REFRESH_TOKEN a .env-ben");
} else if (!SVC && HAS_REFRESH) {
  console.log("[bridge] Firebase: REST API mód (refresh token)");
}

let ofp = null, triggers = [];
const engine = createEngine();

// Clear live data on exit
async function onExit() {
  console.log("[bridge] kilépés...");
  if (!OFFLINE) try { await clearLive(SESSION); } catch {}
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
let prevOnGround = null;
const DATA_TIMEOUT_MS = 15000;

function handleTelemetry(telemetry) {
  const now = Date.now();
  lastDataTs = now;

  // Touchdown detection: onGround false → true (skip first tick)
  if (prevOnGround === false && telemetry.onGround) {
    const landing = {
      fpm:          Math.round(telemetry.vsFpm),
      gs:           Math.round(telemetry.gsKt),
      ias:          Math.round(telemetry.iasKt || 0),
      headingDeg:   Math.round(telemetry.headingDeg || 0),
      lat:          telemetry.lat,
      lon:          telemetry.lon,
      aircraftTitle: telemetry.aircraftTitle,
      ts:           now,
    };
    if (!OFFLINE) writeLanding(SESSION, landing).catch(() => {});
    console.log(`[landing] Touchdown: ${landing.fpm} FPM @ ${landing.gs} kt GS, IAS ${landing.ias} kt`);
  }
  prevOnGround = telemetry.onGround ?? prevOnGround;

  if (now - lastWrite < 900) return;
  lastWrite = now;
  const derived = {
    todDistNm: todDistanceNm(telemetry.altFt, 0),
    ofp: ofp && { dep:ofp.dep, arr:ofp.arr, pax:ofp.pax, payload:ofp.payload, blockFuel:ofp.blockFuel, units:ofp.units, route:ofp.route },
  };
  if (!OFFLINE) {
    writeLive(SESSION, telemetry, derived).catch(e => console.error("[fb] writeLive hiba:", e.message));
    const events = engine.evaluate(telemetry, triggers, ofp);
    for (const ev of events)
      pushToDevices(SESSION, { title: ev.title, body: ev.body }).catch(e => console.warn("[fb] push hiba:", e.message));
  }
}

// Watchdog: clear live data if no telemetry for 15s
setInterval(async () => {
  if (lastDataTs > 0 && Date.now() - lastDataTs > DATA_TIMEOUT_MS) {
    console.warn("[bridge] Nincs adat 15s óta — live adatok törlése");
    lastDataTs = 0;
    if (!OFFLINE) try { await clearLive(SESSION); } catch(e) { console.error("[fb] clearLive hiba:", e.message); }
  }
}, 5000);

async function main() {
  if (!OFFLINE) {
    initFirebase(SVC || null);
    watchTriggers(SESSION, t => { triggers = t; });
  }
  await loadOFP();
  setInterval(loadOFP, 5 * 60 * 1000);

  if (SIM_MODE === "mock") {
    console.log("[bridge] Mode: MOCK (LHBP→LOWW, 2 perc)");
    startMock(handleTelemetry);
  } else if (SIM_MODE === "fsuipc7") {
    console.log("[bridge] Mode: FSUIPC7");
    await startFsuipc(handleTelemetry);
  } else if (SIM_MODE === "simconnect") {
    console.log("[bridge] Mode: SimConnect");
    await startSim(handleTelemetry);
  } else {
    console.log("[bridge] Mode: auto (SimConnect + opcionális FSUIPC7)");
    // SimConnect is built into MSFS 2020/2024 — always start it
    startSim(handleTelemetry);
    // Try FSUIPC7 in parallel if the package is available (higher accuracy)
    try { startFsuipc(handleTelemetry); } catch {}
  }
  console.log("[bridge] fut...");
}

main().catch(e => { console.error(e); process.exit(1); });
