const { app, BrowserWindow, shell, ipcMain } = require("electron");
const { autoUpdater } = require("electron-updater");
const path  = require("node:path");
const fs    = require("node:fs");
const os    = require("node:os");

const isDev = !app.isPackaged;
const SETTINGS_PATH = path.join(os.homedir(), ".skybound-settings.json");

let mainWin, authWin, browserWin;

/* ── Auto-updater setup ───────────────────────────────────────────────────── */
function setupUpdater() {
  autoUpdater.autoDownload = false;          // user dönt, nem tölt le háttérben
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on("checking-for-update",   () => send("updater:checking"));
  autoUpdater.on("update-not-available",  () => send("updater:latest"));
  autoUpdater.on("update-available",      (info) => send("updater:available", info));
  autoUpdater.on("download-progress",     (p)    => send("updater:progress", p));
  autoUpdater.on("update-downloaded",     (info) => send("updater:ready",    info));
  autoUpdater.on("error", (err) => {
    // Mac-en aláíratlan appnál az updater hibát dob — GitHub API-val fallback
    checkGitHubRelease();
  });

  if (!isDev) autoUpdater.checkForUpdates();
  // Óránként újraellenőrzés
  setInterval(() => { if (!isDev) autoUpdater.checkForUpdates(); }, 60 * 60 * 1000);
}

// Fallback: GitHub API-val ellenőrzi a legújabb release-t (unsigned Mac-hez)
async function checkGitHubRelease() {
  try {
    const res = await fetch("https://api.github.com/repos/plen-maker/SkyBound/releases/latest",
      { headers: { Accept: "application/vnd.github+json" } });
    if (!res.ok) return;
    const rel = await res.json();
    const latest = rel.tag_name?.replace(/^v/, "");
    const current = app.getVersion();
    if (latest && latest !== current) {
      send("updater:available", { version: latest, releaseUrl: rel.html_url });
    } else {
      send("updater:latest");
    }
  } catch {}
}

/* ── Main window ─────────────────────────────────────────────────────────── */
function createMain() {
  mainWin = new BrowserWindow({
    width: 1380, height: 880, minWidth: 960, minHeight: 640,
    backgroundColor: "#070b12",
    titleBarStyle: "hiddenInset",
    vibrancy: "under-window",
    visualEffectState: "active",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  if (isDev) mainWin.loadURL("http://localhost:5173");
  else       mainWin.loadFile(path.join(__dirname, "../dist/index.html"));
  mainWin.once("ready-to-show", () => mainWin.show());
  mainWin.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action:"deny" }; });
}

/* ── Auth window ─────────────────────────────────────────────────────────── */
function openAuthWindow() {
  if (authWin && !authWin.isDestroyed()) { authWin.focus(); return; }
  authWin = new BrowserWindow({
    width: 440, height: 560,
    backgroundColor: "#070b12",
    titleBarStyle: "hiddenInset",
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, "auth-preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  authWin.loadFile(path.join(__dirname, "auth.html"));
  authWin.on("closed", () => { authWin = null; });
}

/* ── In-app browser window ───────────────────────────────────────────────── */
function openBrowserWindow(url) {
  if (browserWin && !browserWin.isDestroyed()) { browserWin.loadURL(url); browserWin.focus(); return; }
  browserWin = new BrowserWindow({
    width: 1280, height: 820,
    backgroundColor: "#070b12",
    titleBarStyle: "hiddenInset",
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  browserWin.loadURL(url);
  browserWin.on("closed", () => { browserWin = null; });
}

/* ── IPC ─────────────────────────────────────────────────────────────────── */
const send = (ch, data) => { if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send(ch, data); };

// Auth events from auth window
ipcMain.on("auth:user", (_e, user) => {
  send("auth:success", user);
  authWin?.close();
});
ipcMain.on("auth:error", (_e, msg) => send("auth:error", msg));

// Renderer requests
ipcMain.handle("auth:open",         () => openAuthWindow());
ipcMain.handle("auth:logout",       () => send("auth:logout"));
ipcMain.handle("open:external",     (_e, url) => shell.openExternal(url));
ipcMain.handle("open:inapp",        (_e, url) => openBrowserWindow(url));
ipcMain.handle("updater:download",  () => autoUpdater.downloadUpdate());
ipcMain.handle("updater:install",   () => { autoUpdater.quitAndInstall(false, true); });
ipcMain.handle("updater:openrel",   (_e, url) => shell.openExternal(url || "https://github.com/plen-maker/SkyBound/releases/latest"));
ipcMain.handle("updater:check",     () => { if (!isDev) autoUpdater.checkForUpdates(); else checkGitHubRelease(); });
ipcMain.handle("settings:save",     (_e, s) => { fs.writeFileSync(SETTINGS_PATH, JSON.stringify(s, null, 2)); return true; });
ipcMain.handle("settings:load",     () => { try { return JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf8")); } catch { return {}; } });

// SimBrief fetch (no CORS in Node)
const num = (v) => (v == null || v === "" ? null : Number(v));
const toArr = (x) => (Array.isArray(x) ? x : x ? [x] : []);
function parseOFP(d) {
  const w=d.weights||{},f=d.fuel||{},g=d.general||{};
  return {
    dep:d?.origin?.icao_code||null, arr:d?.destination?.icao_code||null,
    altn:d?.alternate?.icao_code||null,
    aircraft:`${d?.aircraft?.icaocode||""} ${d?.aircraft?.name||""}`.trim()||null,
    units:w.units||"kg", pax:num(w.pax_count), payload:num(w.payload),
    zfw:num(w.est_zfw), tow:num(w.est_tow), costindex:num(g.costindex),
    blockFuel:num(f.plan_ramp), route:g.route||null,
    routeDistanceNm:num(g.route_distance)??num(g.air_distance),
    fixes:toArr(d?.navlog?.fix).map(x=>({
      ident:x.ident,type:x.type,stage:x.stage,
      lat:num(x.pos_lat),lon:num(x.pos_long),altitude:num(x.altitude_feet),
    })).filter(x=>x.ident&&x.lat!=null),
  };
}
ipcMain.handle("simbrief:fetch", async (_e, username) => {
  if (!username) return { error:"Nincs SimBrief usernév" };
  try {
    const res = await fetch(`https://www.simbrief.com/api/xml.fetcher.php?username=${encodeURIComponent(username)}&json=1`);
    if (!res.ok) return { error:`HTTP ${res.status}` };
    const d = await res.json();
    if (d?.fetch?.status==="Error") return { error:d.fetch.message };
    return { ofp:parseOFP(d) };
  } catch(e) { return { error:String(e.message||e) }; }
});

/* ── App lifecycle ────────────────────────────────────────────────────────── */
app.whenReady().then(() => {
  createMain();
  setupUpdater();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length===0) createMain(); });
});
app.on("window-all-closed", () => { if (process.platform!=="darwin") app.quit(); });
