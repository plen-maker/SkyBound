const { app, BrowserWindow, shell, ipcMain } = require("electron");
const { setupUpdater } = require("./updater");
const { setupUpdater } = require("./updater");
const { setupUpdater } = require("./updater");
const path = require("node:path");
const fs   = require("node:fs");
const os   = require("node:os");

const isDev = process.env.NODE_ENV === "development";
const SETTINGS = path.join(os.homedir(), ".skybound.json");

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1380, height: 880,
    minWidth: 960, minHeight: 640,
    backgroundColor: "#070b12",
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    win.loadURL("http://localhost:5173");
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    const indexPath = path.join(app.getAppPath(), "dist", "index.html");
    win.loadFile(indexPath);
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.includes("accounts.google.com") || url.includes("firebaseapp.com/__/auth")) {
      return { action: "allow" };
    }
    shell.openExternal(url);
    return { action: "deny" };
  });
}

/* ── SimBrief fetch (no CORS in Node) ──────────────────────────────────── */
const n2 = (v) => (v == null || v === "" ? null : Number(v));
const toArr = (x) => (Array.isArray(x) ? x : x ? [x] : []);

function parseOFP(d) {
  const w=d.weights||{}, f=d.fuel||{}, g=d.general||{}, t=d.times||{};
  return {
    dep:  d?.origin?.icao_code||null,
    arr:  d?.destination?.icao_code||null,
    altn: d?.alternate?.icao_code||null,
    aircraft: `${d?.aircraft?.icaocode||""} ${d?.aircraft?.name||""}`.trim()||null,
    units: w.units||"kg",
    pax: n2(w.pax_count), cargo: n2(w.cargo), payload: n2(w.payload),
    zfw: n2(w.est_zfw), tow: n2(w.est_tow),
    costindex: n2(g.costindex),
    blockFuel:   n2(f.plan_ramp),
    enrouteBurn: n2(f.enroute_burn),
    contFuel:    n2(f.contingency),
    altFuel:     n2(f.alternate_burn),
    resFuel:     n2(f.reserve),
    extraFuel:   n2(f.extra),
    route: g.route||null,
    routeDistanceNm: n2(g.route_distance)||n2(g.air_distance),
    ete: t.est_time_enroute
      ? `${Math.floor(n2(t.est_time_enroute)/3600)}h${String(Math.floor((n2(t.est_time_enroute)%3600)/60)).padStart(2,"0")}m`
      : null,
    fixes: toArr(d?.navlog?.fix).map(x => ({
      ident: x.ident, stage: x.stage,
      lat: n2(x.pos_lat), lon: n2(x.pos_long), altitude: n2(x.altitude_feet),
    })).filter(x => x.ident && x.lat != null),
  };
}

ipcMain.handle("simbrief:fetch", async (_e, u) => {
  if (!u) return { error: "Nincs usernév" };
  try {
    const r = await fetch(`https://www.simbrief.com/api/xml.fetcher.php?username=${encodeURIComponent(u)}&json=1`);
    if (!r.ok) return { error: `HTTP ${r.status}` };
    const d = await r.json();
    if (d?.fetch?.status === "Error") return { error: d.fetch.message };
    return { ofp: parseOFP(d) };
  } catch(e) { return { error: String(e) }; }
});

/* ── Navigation / windows ───────────────────────────────────────────────── */
ipcMain.handle("open:external", (_e, url) => shell.openExternal(url));
ipcMain.handle("open:inapp", (_e, url) => {
  const b = new BrowserWindow({
    width: 1280, height: 820,
    backgroundColor: "#070b12",
    titleBarStyle: "hiddenInset",
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  b.loadURL(url);
});

/* ── Settings ───────────────────────────────────────────────────────────── */
ipcMain.handle("settings:save", (_e, s) => {
  fs.writeFileSync(SETTINGS, JSON.stringify(s, null, 2));
  return true;
});
ipcMain.handle("settings:load", () => {
  try { return JSON.parse(fs.readFileSync(SETTINGS, "utf8")); }
  catch { return {}; }
});

/* ── App lifecycle ──────────────────────────────────────────────────────── */
app.whenReady().then(() => {
  createWindow();
  setupUpdater(win);
  setupUpdater(win);
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  setupUpdater(win);
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
