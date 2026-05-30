const { app, BrowserWindow, shell, ipcMain } = require("electron");
const path  = require("node:path");
const fs    = require("node:fs");
const os    = require("node:os");

const isDev = !app.isPackaged;
const SETTINGS_PATH = path.join(os.homedir(), ".skybound-settings.json");

let mainWin, browserWin;

function createMain() {
  mainWin = new BrowserWindow({
    width: 1380, height: 880,
    minWidth: 960, minHeight: 640,
    backgroundColor: "#070b12",
    titleBarStyle: "hiddenInset",
    vibrancy: "under-window",           // frosted glass on mac
    visualEffectState: "active",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  if (isDev) mainWin.loadURL("http://localhost:5173");
  else       mainWin.loadFile(path.join(__dirname, "../dist/index.html"));
  mainWin.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: "deny" }; });
}

function openBrowserWindow(url) {
  if (browserWin && !browserWin.isDestroyed()) {
    browserWin.loadURL(url); browserWin.focus(); return;
  }
  browserWin = new BrowserWindow({
    width: 1280, height: 820,
    backgroundColor: "#070b12",
    titleBarStyle: "hiddenInset",
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  browserWin.loadURL(url);
  browserWin.on("closed", () => { browserWin = null; });
}

// SimBrief OFP fetch (no CORS in Node)
const num = (v) => (v == null || v === "" ? null : Number(v));
const toArr = (x) => (Array.isArray(x) ? x : x ? [x] : []);
function parseOFP(d) {
  const w = d.weights||{}, f = d.fuel||{}, g = d.general||{};
  return {
    dep: d?.origin?.icao_code||null, arr: d?.destination?.icao_code||null,
    altn: d?.alternate?.icao_code||null,
    aircraft: `${d?.aircraft?.icaocode||""} ${d?.aircraft?.name||""}`.trim()||null,
    units: w.units||"kg",
    pax: num(w.pax_count), payload: num(w.payload), cargo: num(w.cargo),
    zfw: num(w.est_zfw), tow: num(w.est_tow), costindex: num(g.costindex),
    blockFuel: num(f.plan_ramp), route: g.route||null,
    routeDistanceNm: num(g.route_distance)??num(g.air_distance),
    fixes: toArr(d?.navlog?.fix).map(x=>({
      ident:x.ident, type:x.type, stage:x.stage,
      lat:num(x.pos_lat), lon:num(x.pos_long), altitude:num(x.altitude_feet),
    })).filter(x=>x.ident&&x.lat!=null),
  };
}

ipcMain.handle("simbrief:fetch", async (_e, username) => {
  if (!username) return { error: "Nincs SimBrief usernév" };
  try {
    const res = await fetch(`https://www.simbrief.com/api/xml.fetcher.php?username=${encodeURIComponent(username)}&json=1`);
    if (!res.ok) return { error: `HTTP ${res.status}` };
    const d = await res.json();
    if (d?.fetch?.status === "Error") return { error: d.fetch.message };
    return { ofp: parseOFP(d) };
  } catch(e) { return { error: String(e.message||e) }; }
});

ipcMain.handle("open:external", (_e, url) => shell.openExternal(url));
ipcMain.handle("open:inapp",    (_e, url) => { openBrowserWindow(url); });

// gamepad list via HTML5 Gamepad API — read from renderer via IPC echo
ipcMain.handle("gamepad:list", () => []); // populated by renderer-side polling

ipcMain.handle("settings:save", (_e, s) => {
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(s, null, 2));
  return true;
});
ipcMain.handle("settings:load", () => {
  try { return JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf8")); }
  catch { return {}; }
});

app.whenReady().then(() => {
  createMain();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length===0) createMain(); });
});
app.on("window-all-closed", () => { if (process.platform!=="darwin") app.quit(); });
