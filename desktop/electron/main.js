const { app, BrowserWindow, shell, ipcMain, protocol } = require("electron");
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
    win.loadFile(path.join(__dirname, "../dist/index.html"));
    win.webContents.openDevTools({ mode: "detach" }); // ideiglenesen debug miatt
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
  if (url.includes("accounts.google.com") || url.includes("firebaseapp.com/__/auth")) {
    return { action: "allow" };
  }
    shell.openExternal(url);
    return { action: "deny" };
  });
}

// SimBrief
const n = (v) => (v == null || v === "" ? null : Number(v));
const toA = (x) => (Array.isArray(x) ? x : x ? [x] : []);
function parseOFP(d) {
  const w=d.weights||{}, f=d.fuel||{}, g=d.general||{};
  return {
    dep: d?.origin?.icao_code||null, arr: d?.destination?.icao_code||null,
    aircraft: `${d?.aircraft?.icaocode||""} ${d?.aircraft?.name||""}`.trim()||null,
    units: w.units||"kg", pax: n(w.pax_count), payload: n(w.payload),
    zfw: n(w.est_zfw), tow: n(w.est_tow), costindex: n(g.costindex),
    blockFuel: n(f.plan_ramp), route: g.route||null,
    fixes: toA(d?.navlog?.fix).map(x=>({
      ident:x.ident, stage:x.stage,
      lat:n(x.pos_lat), lon:n(x.pos_long), altitude:n(x.altitude_feet),
    })).filter(x=>x.ident&&x.lat!=null),
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

ipcMain.handle("open:external", (_e, url) => shell.openExternal(url));
ipcMain.handle("open:inapp", (_e, url) => {
  const b = new BrowserWindow({ width:1280, height:820, backgroundColor:"#070b12", titleBarStyle:"hiddenInset" });
  b.loadURL(url);
});
ipcMain.handle("settings:save", (_e, s) => { fs.writeFileSync(SETTINGS, JSON.stringify(s,null,2)); return true; });
ipcMain.handle("settings:load", () => { try { return JSON.parse(fs.readFileSync(SETTINGS,"utf8")); } catch { return {}; } });

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length===0) createWindow(); });
});
app.on("window-all-closed", () => { if (process.platform!=="darwin") app.quit(); });
