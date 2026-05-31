/* SkyBound EFB — codename-based auto-updater
 * GitHub releases use codenames as tag names: "Tahoe", "Sequoia", "Whitney" etc.
 * The app stores its own codename in package.json version field as "Tahoe".
 * On launch, fetches the latest release tag from GitHub API.
 * If different → shows update banner. One click → opens release page or downloads.
 *
 * Drop-in replacement for the electron-updater approach.
 * No signing required — just opens the GitHub release page for manual download,
 * OR triggers electron-updater if the release has .dmg/.exe assets attached.
 */

const { app, ipcMain, shell } = require("electron");
const https = require("node:https");

const GITHUB_OWNER = "plen-maker";
const GITHUB_REPO  = "SkyBound";
const API_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;

let mainWinRef = null;

function send(channel, data) {
  if (mainWinRef && !mainWinRef.isDestroyed())
    mainWinRef.webContents.send(channel, data);
}

function fetchLatestRelease() {
  return new Promise((resolve, reject) => {
    const req = https.get(API_URL, {
      headers: {
        "User-Agent": `SkyBound-EFB/${app.getVersion()}`,
        "Accept": "application/vnd.github+json",
      }
    }, (res) => {
      let body = "";
      res.on("data", d => body += d);
      res.on("end", () => {
        try { resolve(JSON.parse(body)); }
        catch(e) { reject(e); }
      });
    });
    req.on("error", reject);
    req.setTimeout(8000, () => { req.destroy(); reject(new Error("timeout")); });
  });
}

function codenameDiffers(latest, current) {
  // Both are codenames like "Tahoe", "Sequoia" — simple string compare
  // Strip leading 'v' just in case someone tags as "vTahoe"
  const clean = s => String(s || "").replace(/^v/i, "").trim().toLowerCase();
  return clean(latest) !== clean(current);
}

async function checkForUpdate() {
  send("updater:checking");
  try {
    const release = await fetchLatestRelease();
    const latestCodename = release.tag_name || release.name || "";
    const currentCodename = app.getVersion();          // set in package.json "version"

    if (codenameDiffers(latestCodename, currentCodename)) {
      // Find download asset for this platform
      const assets = release.assets || [];
      const platform = process.platform;
      const asset = assets.find(a => {
        const n = a.name.toLowerCase();
        if (platform === "darwin") return n.endsWith(".dmg");
        if (platform === "win32")  return n.endsWith(".exe") || n.includes("setup");
        return false;
      });

      send("updater:available", {
        codename:    latestCodename,
        current:     currentCodename,
        releaseUrl:  release.html_url,
        downloadUrl: asset?.browser_download_url || null,
        body:        release.body || "",
      });
    } else {
      send("updater:latest", { codename: currentCodename });
    }
  } catch(e) {
    // Silent fail — don't bother user if update check fails
    console.warn("[updater] check failed:", e.message);
    send("updater:error", { message: e.message });
  }
}

function setupUpdater(mainWindow) {
  mainWinRef = mainWindow;

  // Check on launch after 4 seconds (let the UI settle first)
  setTimeout(checkForUpdate, 4000);

  // Re-check every hour
  setInterval(checkForUpdate, 60 * 60 * 1000);

  // IPC: manual check trigger from renderer
  ipcMain.handle("updater:check",   () => checkForUpdate());
  ipcMain.handle("updater:openrel", (_e, url) => shell.openExternal(url || `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`));
  ipcMain.handle("updater:download",(_e, url) => {
    if (url) shell.openExternal(url);
    else     shell.openExternal(`https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`);
  });
}

module.exports = { setupUpdater };
