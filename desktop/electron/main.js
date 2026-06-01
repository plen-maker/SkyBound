const { app, BrowserWindow, shell, ipcMain, protocol } = require("electron");
const path = require("node:path");
const fs   = require("node:fs");
const os   = require("node:os");

const SETTINGS = path.join(os.homedir(), ".skybound.json");

// Must be called before app is ready
protocol.registerSchemesAsPrivileged([{
  scheme: "app",
  privileges: { secure: true, standard: true, supportFetchAPI: true, corsEnabled: true },
}]);

let win;

app.whenReady().then(() => {
  // Serve dist/ via app:// protocol (packaged build)
  protocol.handle("app", (request) => {
    const url  = new URL(request.url);
    let   rel  = url.pathname === "/" ? "/index.html" : url.pathname;
    const file = path.join(process.resourcesPath, "dist", rel);
    return new Response(fs.readFileSync(file), {
      headers: { "Content-Type": mime(rel) },
    });
  });

  win = new BrowserWindow({
    width: 1360, height: 860,
    minWidth: 900, minHeight: 600,
    backgroundColor: "#070b12",
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (!app.isPackaged) {
    win.loadURL("http://localhost:5173");
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadURL("app://./index.html");
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.includes("accounts.google.com") || url.includes("firebaseapp.com/__/auth"))
      return { action: "allow" };
    shell.openExternal(url);
    return { action: "deny" };
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) app.emit("ready");
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

function mime(file) {
  if (file.endsWith(".html")) return "text/html";
  if (file.endsWith(".js"))   return "application/javascript";
  if (file.endsWith(".css"))  return "text/css";
  if (file.endsWith(".png"))  return "image/png";
  if (file.endsWith(".svg"))  return "image/svg+xml";
  return "application/octet-stream";
}

/* ── IPC ── */
ipcMain.handle("open:external", (_e, url) => shell.openExternal(url));

let browserWin = null;
ipcMain.handle("open:inapp", (_e, url) => {
  if (browserWin && !browserWin.isDestroyed()) {
    browserWin.loadURL(url); browserWin.focus(); return;
  }
  browserWin = new BrowserWindow({
    width: 1280, height: 840, backgroundColor: "#070b12",
    titleBarStyle: "hidden",
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  browserWin.loadURL(url);
  browserWin.on("closed", () => { browserWin = null; });
  const injectNav = () => {
    browserWin.webContents.executeJavaScript(`
      if (!document.getElementById('sb-nav')) {
        const bar = document.createElement("div");
        bar.id = "sb-nav";
        bar.style.cssText = "position:fixed;top:0;left:0;right:0;height:40px;background:#0d1520;display:flex;align-items:center;gap:6px;padding:0 14px;z-index:2147483647;border-bottom:1px solid #1a2a3d;-webkit-app-region:drag;font-family:system-ui;box-shadow:0 2px 12px rgba(0,0,0,.5);";
        const mk = (label, fn) => {
          const b = document.createElement("button");
          b.textContent = label;
          b.style.cssText = "background:#111c2b;color:#cdd9ec;border:1px solid #1a2a3d;border-radius:7px;padding:3px 10px;font-size:12px;cursor:pointer;-webkit-app-region:no-drag;transition:background .15s;flex-shrink:0;";
          b.onmouseenter = () => b.style.background="#1a2a3d";
          b.onmouseleave = () => b.style.background="#111c2b";
          b.onclick = fn; return b;
        };
        bar.appendChild(mk("←", () => history.back()));
        bar.appendChild(mk("→", () => history.forward()));
        bar.appendChild(mk("↺", () => location.reload()));
        const u = document.createElement("div");
        u.style.cssText = "flex:1;color:#5a7090;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;-webkit-app-region:drag;margin:0 8px;";
        u.textContent = location.hostname;
        bar.appendChild(u);
        bar.appendChild(mk("✕ Bezár", () => window.close()));
        document.documentElement.style.paddingTop = "40px";
        document.body.prepend(bar);
      }
    `).catch(()=>{});
  };
  browserWin.webContents.on("did-finish-load", injectNav);
  browserWin.webContents.on("did-navigate-in-page", injectNav);
});

ipcMain.handle("settings:save", (_e, s) => { fs.writeFileSync(SETTINGS, JSON.stringify(s,null,2)); return true; });
ipcMain.handle("settings:load", () => { try { return JSON.parse(fs.readFileSync(SETTINGS,"utf8")); } catch { return {}; } });

/* ── SimBrief ── */
const n   = v => v==null||v===""?null:Number(v);
const toA = x => Array.isArray(x)?x:x?[x]:[];
ipcMain.handle("simbrief:fetch", async (_e, username) => {
  if (!username) return { error: "Nincs usernév" };
  try {
    const r = await fetch(`https://www.simbrief.com/api/xml.fetcher.php?username=${encodeURIComponent(username)}&json=1`);
    if (!r.ok) return { error: `HTTP ${r.status}` };
    const d = await r.json();
    if (d?.fetch?.status==="Error") return { error: d.fetch.message };
    const w=d.weights||{},f=d.fuel||{},g=d.general||{},t=d.times||{};
    return { ofp: {
      dep:d?.origin?.icao_code, arr:d?.destination?.icao_code, altn:d?.alternate?.icao_code,
      aircraft:`${d?.aircraft?.icaocode||""} ${d?.aircraft?.name||""}`.trim(),
      units:w.units||"kg", pax:n(w.pax_count), payload:n(w.payload),
      zfw:n(w.est_zfw), tow:n(w.est_tow), blockFuel:n(f.plan_ramp),
      enrouteBurn:n(f.enroute_burn), contFuel:n(f.contingency),
      altFuel:n(f.alternate_burn), resFuel:n(f.reserve), extraFuel:n(f.extra),
      costindex:n(g.costindex), route:g.route,
      routeDistanceNm:n(g.route_distance)||n(g.air_distance),
      ete:t.est_time_enroute?`${Math.floor(n(t.est_time_enroute)/3600)}h${String(Math.floor((n(t.est_time_enroute)%3600)/60)).padStart(2,"0")}m`:null,
      fixes:toA(d?.navlog?.fix).map(x=>({ident:x.ident,stage:x.stage,lat:n(x.pos_lat),lon:n(x.pos_long),altitude:n(x.altitude_feet)})).filter(x=>x.ident&&x.lat!=null),
    }};
  } catch(e) { return { error: String(e) }; }
});

/* ── Updater ── */
ipcMain.handle("updater:check", async () => {
  try {
    const r = await fetch("https://api.github.com/repos/plen-maker/SkyBound/releases/latest",
      { headers: { "User-Agent":`SkyBound/${app.getVersion()}`, "Accept":"application/vnd.github+json" } });
    if (!r.ok) return { error:`HTTP ${r.status}` };
    const rel = await r.json();
    const latest  = (rel.tag_name||rel.name||"").replace(/^v/i,"").trim().toLowerCase();
    const current = app.getVersion().toLowerCase();
    if (latest && latest !== current) {
      const asset = (rel.assets||[]).find(a => {
        const nm = a.name.toLowerCase();
        return process.platform==="darwin"?nm.endsWith(".dmg"):process.platform==="win32"?nm.includes("setup")||nm.endsWith(".exe"):false;
      });
      return { update:true, codename:rel.tag_name||rel.name, url:rel.html_url, downloadUrl:asset?.browser_download_url||null };
    }
    return { update: false };
  } catch(e) { return { error: String(e) }; }
});
ipcMain.handle("updater:open", (_e, url) => shell.openExternal(url||"https://github.com/plen-maker/SkyBound/releases/latest"));
