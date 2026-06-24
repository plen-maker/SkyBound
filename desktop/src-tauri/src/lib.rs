use tauri::{Manager, Emitter};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tokio::process::{Child, Command as TokioCommand};
use tokio::io::{AsyncBufReadExt, BufReader};
use axum::{Router, routing::get, response::{Html, IntoResponse}, http::StatusCode};

struct BridgeProc {
    bridge: Option<Child>,
}
impl BridgeProc {
    fn new() -> Self { Self { bridge: None } }
}

struct AppState {
    bridge: Mutex<BridgeProc>,
}

fn settings_path() -> PathBuf {
    dirs::home_dir().unwrap_or_default().join(".skybound.json")
}

fn version_path() -> PathBuf {
    // Check next to executable first, then cwd
    if let Ok(exe) = std::env::current_exe() {
        let p = exe.parent().unwrap_or(std::path::Path::new(".")).join("version.json");
        if p.exists() { return p; }
    }
    PathBuf::from("version.json")
}

#[derive(Serialize, Deserialize, Clone)]
struct Version {
    codename: String,
    version: String,
    channel: String,
}

// ── Commands ──────────────────────────────────────────────────────

#[tauri::command]
fn load_settings() -> serde_json::Value {
    fs::read_to_string(settings_path())
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or(serde_json::json!({}))
}

#[tauri::command]
fn save_settings(settings: serde_json::Value) -> bool {
    fs::write(settings_path(), serde_json::to_string_pretty(&settings).unwrap_or_default()).is_ok()
}

#[tauri::command]
fn get_version() -> serde_json::Value {
    fs::read_to_string(version_path())
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or(serde_json::json!({
            "codename": "Sequoia",
            "version": "0.3.0",
            "channel": "release"
        }))
}

#[tauri::command]
fn save_version_settings(codename: String, channel: String) -> bool {
    let mut v: serde_json::Value = fs::read_to_string(version_path())
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or(serde_json::json!({}));
    v["codename"] = serde_json::Value::String(codename);
    v["channel"]  = serde_json::Value::String(channel);
    fs::write(version_path(), serde_json::to_string_pretty(&v).unwrap_or_default()).is_ok()
}

#[tauri::command]
async fn fetch_ofp(username: String) -> serde_json::Value {
    let url = format!(
        "https://www.simbrief.com/api/xml.fetcher.php?username={}&json=1",
        username
    );
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(12))
        .build()
        .unwrap();

    match client.get(&url).send().await {
        Err(e) => serde_json::json!({ "error": e.to_string() }),
        Ok(r) => match r.json::<serde_json::Value>().await {
            Err(e) => serde_json::json!({ "error": e.to_string() }),
            Ok(d) => {
                if d["fetch"]["status"] == "Error" {
                    return serde_json::json!({ "error": d["fetch"]["message"] });
                }
                let w = &d["weights"];
                let f = &d["fuel"];
                let g = &d["general"];
                let t = &d["times"];
                let units = w["units"].as_str().unwrap_or("kg").to_string();

                // Parse navlog fixes
                let fixes_raw = &d["navlog"]["fix"];
                let fixes: Vec<serde_json::Value> = match fixes_raw {
                    serde_json::Value::Array(arr) => arr.iter().filter_map(|x| {
                        let lat: f64 = x["pos_lat"].as_str()?.parse().ok()?;
                        let lon: f64 = x["pos_long"].as_str()?.parse().ok()?;
                        Some(serde_json::json!({
                            "ident": x["ident"],
                            "stage": x["stage"],
                            "lat": lat,
                            "lon": lon,
                            "altitude": x["altitude_feet"].as_str().and_then(|s| s.parse::<f64>().ok())
                        }))
                    }).collect(),
                    serde_json::Value::Object(_) => {
                        let x = fixes_raw;
                        if let (Some(lat), Some(lon)) = (
                            x["pos_lat"].as_str().and_then(|s| s.parse::<f64>().ok()),
                            x["pos_long"].as_str().and_then(|s| s.parse::<f64>().ok()),
                        ) {
                            vec![serde_json::json!({
                                "ident": x["ident"], "stage": x["stage"],
                                "lat": lat, "lon": lon,
                                "altitude": x["altitude_feet"].as_str().and_then(|s| s.parse::<f64>().ok())
                            })]
                        } else { vec![] }
                    },
                    _ => vec![],
                };

                // ETE
                let ete = t["est_time_enroute"].as_str()
                    .and_then(|s| s.parse::<f64>().ok())
                    .map(|s| format!("{}h{:02}m", (s/3600.0) as u64, ((s%3600.0)/60.0) as u64));

                serde_json::json!({ "ofp": {
                    "dep":  d["origin"]["icao_code"],
                    "arr":  d["destination"]["icao_code"],
                    "altn": d["alternate"]["icao_code"],
                    "aircraft": format!("{} {}",
                        d["aircraft"]["icaocode"].as_str().unwrap_or(""),
                        d["aircraft"]["name"].as_str().unwrap_or("")).trim().to_string(),
                    "units": units,
                    "pax":         w["pax_count"].as_str().and_then(|s| s.parse::<f64>().ok()),
                    "payload":     w["payload"].as_str().and_then(|s| s.parse::<f64>().ok()),
                    "zfw":         w["est_zfw"].as_str().and_then(|s| s.parse::<f64>().ok()),
                    "tow":         w["est_tow"].as_str().and_then(|s| s.parse::<f64>().ok()),
                    "blockFuel":   f["plan_ramp"].as_str().and_then(|s| s.parse::<f64>().ok()),
                    "enrouteBurn": f["enroute_burn"].as_str().and_then(|s| s.parse::<f64>().ok()),
                    "contFuel":    f["contingency"].as_str().and_then(|s| s.parse::<f64>().ok()),
                    "altFuel":     f["alternate_burn"].as_str().and_then(|s| s.parse::<f64>().ok()),
                    "resFuel":     f["reserve"].as_str().and_then(|s| s.parse::<f64>().ok()),
                    "extraFuel":   f["extra"].as_str().and_then(|s| s.parse::<f64>().ok()),
                    "costindex":   g["costindex"].as_str().and_then(|s| s.parse::<f64>().ok()),
                    "route":       g["route"],
                    "routeDistanceNm": g["route_distance"].as_str()
                        .and_then(|s| s.parse::<f64>().ok())
                        .or_else(|| g["air_distance"].as_str().and_then(|s| s.parse::<f64>().ok())),
                    "ete": ete,
                    "fixes": fixes,
                    "ofpText": d["text"]["plan_text"].as_str().unwrap_or("").to_string(),
                }})
            }
        }
    }
}

#[tauri::command]
async fn check_update() -> serde_json::Value {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(8))
        .user_agent("SkyBound/0.3.0")
        .build()
        .unwrap();
    match client.get("https://api.github.com/repos/plen-maker/SkyBound/releases/latest")
        .header("Accept", "application/vnd.github+json")
        .send().await {
        Err(e) => serde_json::json!({ "error": e.to_string() }),
        Ok(r) => match r.json::<serde_json::Value>().await {
            Err(e) => serde_json::json!({ "error": e.to_string() }),
            Ok(rel) => {
                let latest = rel["tag_name"].as_str().unwrap_or("").to_lowercase();
                let ver: serde_json::Value = fs::read_to_string(version_path())
                    .ok().and_then(|s| serde_json::from_str(&s).ok())
                    .unwrap_or(serde_json::json!({}));
                let current = ver["codename"].as_str().unwrap_or("sequoia").to_lowercase();
                if !latest.is_empty() && latest != current {
                    // Find the MSI asset download URL
                    let msi_url = rel["assets"]
                        .as_array()
                        .and_then(|arr| arr.iter().find(|a| {
                            a["name"].as_str().map(|n| n.ends_with(".msi")).unwrap_or(false)
                        }))
                        .and_then(|a| a["browser_download_url"].as_str())
                        .map(String::from);
                    serde_json::json!({
                        "update": true,
                        "codename": rel["tag_name"],
                        "url": rel["html_url"],
                        "downloadUrl": msi_url,
                    })
                } else {
                    serde_json::json!({ "update": false })
                }
            }
        }
    }
}

// ── Mod Manager commands ──────────────────────────────────────────

fn parse_installed_packages_path(opt_path: &PathBuf) -> Option<PathBuf> {
    let content = fs::read_to_string(opt_path).ok()?;
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("InstalledPackagesPath") {
            // Format: InstalledPackagesPath "C:\path\to\packages"
            if let Some(start) = trimmed.find('"') {
                let rest = &trimmed[start+1..];
                if let Some(end) = rest.rfind('"') {
                    return Some(PathBuf::from(&rest[..end]));
                }
            }
        }
    }
    None
}

#[tauri::command]
fn mods_get_community_folder() -> serde_json::Value {
    let local  = dirs::data_local_dir().unwrap_or_default();
    let config = dirs::config_dir().unwrap_or_default();
    let home   = dirs::home_dir().unwrap_or_default();

    // All known UserCfg.opt locations (MS Store + Steam + 2024)
    let cfg_opts = [
        // MSFS 2020 MS Store
        local.join("Packages/Microsoft.FlightSimulator_8wekyb3d8bbwe/LocalCache/UserCfg.opt"),
        // MSFS 2020 Steam
        config.join("Microsoft Flight Simulator/UserCfg.opt"),
        // MSFS 2024 MS Store
        local.join("Packages/Microsoft.Limitless_8wekyb3d8bbwe/LocalCache/UserCfg.opt"),
        // MSFS 2024 Steam
        config.join("Microsoft Flight Simulator 2024/UserCfg.opt"),
    ];

    for opt in &cfg_opts {
        if opt.exists() {
            if let Some(packages) = parse_installed_packages_path(opt) {
                let community = packages.join("Community");
                if community.exists() {
                    return serde_json::json!({ "path": community.to_string_lossy() });
                }
                // Sometimes InstalledPackagesPath already points to Community
                if packages.ends_with("Community") && packages.exists() {
                    return serde_json::json!({ "path": packages.to_string_lossy() });
                }
            }
        }
    }

    // Fallback: common default install locations
    let defaults = [
        // MS Store defaults
        local.join("Packages/Microsoft.FlightSimulator_8wekyb3d8bbwe/LocalCache/Packages/Community"),
        // Steam defaults
        config.join("Microsoft Flight Simulator/Packages/Community"),
        // MSFS 2024 MS Store
        local.join("Packages/Microsoft.Limitless_8wekyb3d8bbwe/LocalCache/Packages/Community"),
        // MSFS 2024 Steam
        config.join("Microsoft Flight Simulator 2024/Packages/Community"),
        // OneStore / Xbox App path
        local.join("../LocalState/Packages/Microsoft.FlightSimulator_8wekyb3d8bbwe/Community"),
        // Common manual install on C drive
        PathBuf::from("C:/MSFS Community"),
        PathBuf::from("C:/MSFS2024 Community"),
        // OneDrive Documents path (common on new Windows installs)
        home.join("OneDrive/Documents/OneStore/Community"),
        home.join("OneDrive/Documents/Asobo Studio/Microsoft Flight Simulator/Community"),
    ];

    for p in &defaults {
        if p.exists() {
            return serde_json::json!({ "path": p.to_string_lossy() });
        }
    }

    serde_json::json!({ "path": null })
}

#[tauri::command]
fn mods_list(path: String) -> serde_json::Value {
    let dir = PathBuf::from(&path);
    let mut mods: Vec<serde_json::Value> = vec![];
    let entries = match fs::read_dir(&dir) {
        Ok(e) => e,
        Err(e) => return serde_json::json!({ "error": e.to_string() }),
    };
    for entry in entries.flatten() {
        let mod_dir = entry.path();
        if !mod_dir.is_dir() { continue; }
        let folder_name = mod_dir.file_name().unwrap_or_default().to_string_lossy().to_string();
        if folder_name.starts_with('.') { continue; }

        let manifest: serde_json::Value = fs::read_to_string(mod_dir.join("manifest.json"))
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or(serde_json::json!({}));

        let enabled = !folder_name.to_lowercase().starts_with("_disabled_");
        let display_title = manifest["title"].as_str()
            .filter(|s| !s.is_empty())
            .map(String::from)
            .unwrap_or_else(|| folder_name.clone());

        mods.push(serde_json::json!({
            "folder":      folder_name,
            "path":        mod_dir.to_string_lossy(),
            "title":       display_title,
            "creator":     manifest["creator"].as_str().unwrap_or(""),
            "version":     manifest["package_version"].as_str().unwrap_or(""),
            "contentType": manifest["content_type"].as_str().unwrap_or(""),
            "enabled":     enabled,
        }));
    }
    // Sort: enabled first, then by title
    mods.sort_by(|a, b| {
        let ae = a["enabled"].as_bool().unwrap_or(true);
        let be = b["enabled"].as_bool().unwrap_or(true);
        be.cmp(&ae).then_with(|| {
            a["title"].as_str().unwrap_or("").to_lowercase()
                .cmp(&b["title"].as_str().unwrap_or("").to_lowercase())
        })
    });
    serde_json::json!(mods)
}

#[tauri::command]
fn mod_toggle(path: String, enabled: bool) -> Result<serde_json::Value, String> {
    let p = PathBuf::from(&path);
    let folder_name = p.file_name()
        .ok_or_else(|| "Érvénytelen elérési út".to_string())?
        .to_string_lossy()
        .to_string();
    let parent = p.parent().ok_or_else(|| "Nincs szülőmappa".to_string())?;

    let new_name = if enabled {
        // Enable: remove _DISABLED_ prefix
        let lower = folder_name.to_lowercase();
        if lower.starts_with("_disabled_") {
            folder_name[10..].to_string()
        } else {
            return Ok(serde_json::json!({ "ok": true }));
        }
    } else {
        // Disable: add prefix (only if not already disabled)
        let lower = folder_name.to_lowercase();
        if lower.starts_with("_disabled_") {
            return Ok(serde_json::json!({ "ok": true }));
        }
        format!("_DISABLED_{}", folder_name)
    };

    let new_path = parent.join(&new_name);
    fs::rename(&p, &new_path).map_err(|e| e.to_string())?;
    Ok(serde_json::json!({ "ok": true }))
}

#[tauri::command]
fn mod_delete(path: String) -> Result<serde_json::Value, String> {
    let p = PathBuf::from(&path);
    if !p.exists() { return Err("A mappa nem létezik".to_string()); }
    fs::remove_dir_all(&p).map_err(|e| e.to_string())?;
    Ok(serde_json::json!({ "ok": true }))
}

fn copy_dir_recursive(src: &PathBuf, dest: &PathBuf) -> Result<(), String> {
    fs::create_dir_all(dest).map_err(|e| e.to_string())?;
    for entry in fs::read_dir(src).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let sp = entry.path();
        let dp = dest.join(entry.file_name());
        if sp.is_dir() {
            copy_dir_recursive(&sp, &dp)?;
        } else {
            fs::copy(&sp, &dp).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
fn mod_add(src_path: String, community_path: String) -> Result<serde_json::Value, String> {
    let src = PathBuf::from(&src_path);
    if !src.exists() || !src.is_dir() {
        return Err("A forrás mappa nem létezik vagy érvénytelen.".to_string());
    }
    let folder_name = src.file_name()
        .ok_or("Érvénytelen elérési út")?
        .to_string_lossy()
        .to_string();
    let dest = PathBuf::from(&community_path).join(&folder_name);
    if dest.exists() {
        return Err(format!("Már létezik: {}", folder_name));
    }
    copy_dir_recursive(&src, &dest)?;
    Ok(serde_json::json!({ "ok": true, "folder": folder_name }))
}

#[tauri::command]
fn mod_merge(paths: Vec<String>, target_name: String, community_path: String) -> Result<serde_json::Value, String> {
    if paths.len() < 2 {
        return Err("Legalább 2 mod szükséges az összevonáshoz.".to_string());
    }
    if target_name.trim().is_empty() {
        return Err("Adj meg egy célmappa nevet.".to_string());
    }
    let dest = PathBuf::from(&community_path).join(target_name.trim());
    if dest.exists() {
        return Err(format!("Már létezik: {}", target_name.trim()));
    }
    fs::create_dir_all(&dest).map_err(|e| e.to_string())?;
    for src_path in &paths {
        let src = PathBuf::from(src_path);
        if !src.exists() { continue; }
        for entry in fs::read_dir(&src).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let sp = entry.path();
            let dp = dest.join(entry.file_name());
            if sp.is_dir() {
                copy_dir_recursive(&sp, &dp)?;
            } else {
                fs::copy(&sp, &dp).map_err(|e| e.to_string())?;
            }
        }
    }
    Ok(serde_json::json!({ "ok": true, "folder": target_name.trim() }))
}

// ── Bridge commands ───────────────────────────────────────────────

fn bridge_dir() -> PathBuf {
    dirs::home_dir().unwrap_or_default().join("skybound").join("bridge")
}

fn skybound_root() -> PathBuf {
    dirs::home_dir().unwrap_or_default().join("skybound")
}

async fn run_streamed(
    app: &tauri::AppHandle,
    program: &str,
    args: &[&str],
    cwd: &PathBuf,
) -> Result<(), String> {
    let mut child = TokioCommand::new(program)
        .args(args)
        .current_dir(cwd)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("{program}: {e}"))?;

    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();
    let app1 = app.clone();
    let app2 = app.clone();

    let h1 = tokio::spawn(async move {
        let mut lines = BufReader::new(stdout).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            app1.emit("bridge:log", line).ok();
        }
    });
    let h2 = tokio::spawn(async move {
        let mut lines = BufReader::new(stderr).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            app2.emit("bridge:log", line).ok();
        }
    });

    let status = child.wait().await.map_err(|e| e.to_string())?;
    let _ = tokio::join!(h1, h2);
    if status.success() { Ok(()) } else { Err(format!("{program} exit {}", status.code().unwrap_or(-1))) }
}

#[tauri::command]
async fn bridge_install(app: tauri::AppHandle, session_code: String, refresh_token: Option<String>) -> Result<(), String> {
    if session_code.trim().is_empty() {
        return Err("Állítsd be a session kódot a Settings-ben, majd próbáld újra.".to_string());
    }
    let root = skybound_root();
    let bridge = bridge_dir();

    let emit = |msg: &str| { app.emit("bridge:log", msg.to_string()).ok(); };

    // Clone or update repo
    let git = find_git();
    if root.join(".git").exists() {
        emit("► git pull…");
        run_streamed(&app, &git, &["pull", "--ff-only"], &root).await
            .unwrap_or_else(|e| emit(&format!("git pull hiba: {e}")));
    } else {
        emit("► git clone…");
        let parent = root.parent().unwrap_or(std::path::Path::new("."));
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        run_streamed(&app, &git, &[
            "clone", "https://github.com/plen-maker/SkyBound.git", "skybound"
        ], &parent.to_path_buf()).await?;
    }

    // Write bridge source files directly (bypasses git — embedded at compile time)
    emit("► bridge forrás frissítése…");
    let src_dir = bridge.join("src");
    fs::create_dir_all(&src_dir).map_err(|e| e.to_string())?;
    fs::write(src_dir.join("firebase.js"), include_str!("../../../bridge/src/firebase.js"))
        .map_err(|e| format!("firebase.js írási hiba: {e}"))?;
    fs::write(src_dir.join("index.js"), include_str!("../../../bridge/src/index.js"))
        .map_err(|e| format!("index.js írási hiba: {e}"))?;

    // npm install
    emit("► npm install…");
    #[cfg(windows)]
    let npm = "npm.cmd";
    #[cfg(not(windows))]
    let npm = "npm";
    run_streamed(&app, npm, &["install", "--omit=dev"], &bridge).await?;

    // Write .env
    emit("► .env írása…");
    let env_example = bridge.join(".env.example");
    let env_path    = bridge.join(".env");
    let template = fs::read_to_string(&env_example)
        .unwrap_or_else(|_| "SKYBOUND_SESSION=\nSIMBRIEF_USERNAME=\n".to_string());
    let content = if !session_code.is_empty() {
        template.lines().map(|l| {
            if l.starts_with("SKYBOUND_SESSION=") {
                format!("SKYBOUND_SESSION={session_code}")
            } else { l.to_string() }
        }).collect::<Vec<_>>().join("\n") + "\n"
    } else { template };
    // Add Firebase refresh token if provided
    if let Some(rt) = refresh_token.filter(|s| !s.is_empty()) {
        let mut c = fs::read_to_string(&env_path).unwrap_or_default();
        if c.contains("FIREBASE_REFRESH_TOKEN=") {
            let updated: Vec<String> = c.lines().map(|l| {
                if l.starts_with("FIREBASE_REFRESH_TOKEN=") { format!("FIREBASE_REFRESH_TOKEN={rt}") }
                else { l.to_string() }
            }).collect();
            c = updated.join("\n") + "\n";
        } else {
            c = format!("{}FIREBASE_REFRESH_TOKEN={rt}\n", c.trim_end_matches('\n').to_string() + "\n");
        }
        fs::write(&env_path, c).map_err(|e| e.to_string())?;
    }

    emit("✓ Kész! Bridge telepítve.");
    Ok(())
}

fn find_git() -> String {
    #[cfg(windows)]
    {
        let candidates = [
            "git.exe",
            r"C:\Program Files\Git\cmd\git.exe",
            r"C:\Program Files\Git\bin\git.exe",
            r"C:\Program Files (x86)\Git\cmd\git.exe",
            r"C:\Program Files (x86)\Git\bin\git.exe",
        ];
        for c in &candidates {
            if PathBuf::from(c).exists() { return c.to_string(); }
        }
        // Check LOCALAPPDATA\Programs\Git
        if let Ok(local) = std::env::var("LOCALAPPDATA") {
            let p = format!(r"{local}\Programs\Git\cmd\git.exe");
            if PathBuf::from(&p).exists() { return p; }
        }
    }
    "git".to_string()
}

fn find_node() -> String {
    // GUI apps on Windows don't inherit PATH — try common node locations
    #[cfg(windows)]
    {
        let candidates = [
            "node.exe",
            r"C:\Program Files\nodejs\node.exe",
            r"C:\Program Files (x86)\nodejs\node.exe",
        ];
        // Also check LOCALAPPDATA\Programs\nodejs
        if let Ok(local) = std::env::var("LOCALAPPDATA") {
            let p = format!(r"{local}\Programs\nodejs\node.exe");
            if PathBuf::from(&p).exists() { return p; }
        }
        for c in &candidates {
            if PathBuf::from(c).exists() { return c.to_string(); }
        }
        // Last resort: nvm active version
        if let Ok(appdata) = std::env::var("APPDATA") {
            let nvm_dir = PathBuf::from(&appdata).join("nvm");
            if let Ok(rd) = fs::read_dir(&nvm_dir) {
                if let Some(entry) = rd.flatten().filter(|e| e.path().is_dir()).next() {
                    let p = entry.path().join("node.exe");
                    if p.exists() { return p.to_string_lossy().to_string(); }
                }
            }
        }
    }
    "node".to_string()
}

fn no_window_cmd(program: &str) -> TokioCommand {
    let mut cmd = TokioCommand::new(program);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd
}

#[tauri::command]
async fn bridge_start(app: tauri::AppHandle, state: tauri::State<'_, AppState>, refresh_token: Option<String>) -> Result<serde_json::Value, String> {
    let old = { let mut bp = state.bridge.lock().unwrap(); bp.bridge.take() };
    if let Some(mut c) = old { let _ = c.kill().await; }

    let dir = bridge_dir();
    if !dir.exists() {
        return Err("nem található".to_string());
    }

    // Check .env has SKYBOUND_SESSION
    let env_path = dir.join(".env");
    if !env_path.exists() {
        return Err("Hiányzik a .env fájl — futtasd az auto-telepítést újra.".to_string());
    }
    let mut env_content = fs::read_to_string(&env_path).unwrap_or_default();
    let has_session = env_content.lines().any(|l| {
        let l = l.trim();
        l.starts_with("SKYBOUND_SESSION=") && l.len() > "SKYBOUND_SESSION=".len()
    });
    if !has_session {
        return Err("SKYBOUND_SESSION nincs beállítva a .env-ben.\nÁllítsd be a Settings > Session kód mezőben, majd indítsd újra a telepítést.".to_string());
    }

    // Write Firebase refresh token to .env so bridge can auth without service account
    if let Some(rt) = refresh_token.filter(|s| !s.is_empty()) {
        if env_content.contains("FIREBASE_REFRESH_TOKEN=") {
            let updated: Vec<String> = env_content.lines().map(|l| {
                if l.starts_with("FIREBASE_REFRESH_TOKEN=") {
                    format!("FIREBASE_REFRESH_TOKEN={rt}")
                } else { l.to_string() }
            }).collect();
            env_content = updated.join("\n") + "\n";
        } else {
            env_content = format!("{}FIREBASE_REFRESH_TOKEN={rt}\n", env_content.trim_end_matches('\n').to_string() + "\n");
        }
        let _ = fs::write(&env_path, &env_content);
    }

    let node = find_node();

    // Log to file so we can show errors
    let log_path = dir.join("bridge.log");
    let log_out = fs::OpenOptions::new().create(true).write(true).truncate(true)
        .open(&log_path).map_err(|e| e.to_string())?;
    let log_err = log_out.try_clone().map_err(|e| e.to_string())?;

    let child = no_window_cmd(&node)
        .arg("src/index.js")
        .current_dir(&dir)
        .stdout(log_out)
        .stderr(log_err)
        .spawn()
        .map_err(|e| format!("node nem indítható ({node}): {e}\nTelepítve van a Node.js és a PATH-ban van?"))?;

    let pid = child.id();
    { state.bridge.lock().unwrap().bridge = Some(child); }

    // After 2.5s check if it already exited → emit crash event with log tail
    let app2 = app.clone();
    tokio::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(2500)).await;
        let exited = {
            let st = app2.state::<AppState>();
            let mut bp = st.bridge.lock().unwrap();
            bp.bridge.as_mut().and_then(|c| c.try_wait().ok()).flatten().is_some()
        };
        if exited {
            let log = fs::read_to_string(&log_path).unwrap_or_default();
            let tail = log.lines().rev().take(8).collect::<Vec<_>>().into_iter().rev().collect::<Vec<_>>().join("\n");
            app2.emit("bridge:crashed", tail).ok();
        }
    });

    Ok(serde_json::json!({ "ok": true, "pid": pid }))
}

#[tauri::command]
async fn bridge_read_log() -> String {
    let log = bridge_dir().join("bridge.log");
    fs::read_to_string(&log).unwrap_or_default()
        .lines().rev().take(50).collect::<Vec<_>>()
        .into_iter().rev().collect::<Vec<_>>().join("\n")
}

#[tauri::command]
async fn bridge_stop(state: tauri::State<'_, AppState>) -> Result<serde_json::Value, String> {
    let old = { let mut bp = state.bridge.lock().unwrap(); bp.bridge.take() };
    if let Some(mut c) = old { let _ = c.kill().await; }
    Ok(serde_json::json!({ "ok": true }))
}

#[tauri::command]
fn bridge_status(state: tauri::State<'_, AppState>) -> serde_json::Value {
    let mut bp = state.bridge.lock().unwrap();
    let running = bp.bridge.as_mut()
        .map(|c| c.try_wait().ok().flatten().is_none())
        .unwrap_or(false);
    if !running { bp.bridge = None; }
    serde_json::json!({ "running": running })
}

// ── Local HTTP server (port 47821) for mobile WebView ────────────

const EFB_HTML: &str = include_str!("efb_mobile.html");

async fn http_version() -> impl IntoResponse {
    (StatusCode::OK, axum::Json(serde_json::json!({ "ok": true, "app": "SkyBound EFB" })))
}

async fn http_efb() -> Html<&'static str> {
    Html(EFB_HTML)
}

fn start_http_server() {
    tokio::spawn(async {
        let router = Router::new()
            .route("/api/version", get(http_version))
            .route("/", get(http_efb))
            .route("/*_", get(http_efb));
        match tokio::net::TcpListener::bind("0.0.0.0:47821").await {
            Ok(listener) => {
                let _ = axum::serve(listener, router).await;
            }
            Err(e) => eprintln!("[http] port 47821 foglalt: {e}"),
        }
    });
}

// ── App setup ─────────────────────────────────────────────────────

pub fn run() {
    start_http_server();
    tauri::Builder::default()
        .manage(AppState { bridge: Mutex::new(BridgeProc::new()) })
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![
            load_settings,
            save_settings,
            get_version,
            save_version_settings,
            fetch_ofp,
            check_update,
            bridge_install,
            bridge_start,
            bridge_stop,
            bridge_status,
            bridge_read_log,
            mods_get_community_folder,
            mods_list,
            mod_toggle,
            mod_delete,
            mod_add,
            mod_merge,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
