use tauri::Manager;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tokio::process::{Child, Command as TokioCommand};

struct BridgeProc {
    bridge: Option<Child>,
    proxy:  Option<Child>,
}
impl BridgeProc {
    fn new() -> Self { Self { bridge: None, proxy: None } }
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

fn dir_size_bytes(path: &PathBuf) -> u64 {
    let mut total = 0u64;
    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_dir() {
                total += dir_size_bytes(&p);
            } else if let Ok(meta) = entry.metadata() {
                total += meta.len();
            }
        }
    }
    total
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
        // Skip hidden/system dirs
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

        let size = dir_size_bytes(&mod_dir);

        mods.push(serde_json::json!({
            "folder":      folder_name,
            "path":        mod_dir.to_string_lossy(),
            "title":       display_title,
            "creator":     manifest["creator"].as_str().unwrap_or(""),
            "version":     manifest["package_version"].as_str().unwrap_or(""),
            "contentType": manifest["content_type"].as_str().unwrap_or(""),
            "enabled":     enabled,
            "size":        size,
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

// ── Bridge commands ───────────────────────────────────────────────

fn bridge_dir() -> PathBuf {
    dirs::home_dir().unwrap_or_default().join("skybound").join("bridge")
}

#[tauri::command]
async fn bridge_start(state: tauri::State<'_, AppState>) -> Result<serde_json::Value, String> {
    // release lock before any .await
    let (old_bridge, old_proxy) = {
        let mut bp = state.bridge.lock().unwrap();
        (bp.bridge.take(), bp.proxy.take())
    };
    if let Some(mut c) = old_bridge { let _ = c.kill().await; }
    if let Some(mut c) = old_proxy  { let _ = c.kill().await; }

    let dir = bridge_dir();
    if !dir.exists() {
        return Err(format!(
            "Bridge mappa nem található: {}\nClónozd a SkyBound repo bridge mappáját ide.",
            dir.display()
        ));
    }

    let bridge = TokioCommand::new("node")
        .arg("src/index.js")
        .current_dir(&dir)
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn()
        .map_err(|e| e.to_string())?;

    let proxy = TokioCommand::new("node")
        .arg("proxy.js")
        .current_dir(&dir)
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn()
        .map_err(|e| e.to_string())?;

    let mut bp = state.bridge.lock().unwrap();
    bp.bridge = Some(bridge);
    bp.proxy  = Some(proxy);

    Ok(serde_json::json!({ "ok": true }))
}

#[tauri::command]
async fn bridge_stop(state: tauri::State<'_, AppState>) -> Result<serde_json::Value, String> {
    let (old_bridge, old_proxy) = {
        let mut bp = state.bridge.lock().unwrap();
        (bp.bridge.take(), bp.proxy.take())
    };
    if let Some(mut c) = old_bridge { let _ = c.kill().await; }
    if let Some(mut c) = old_proxy  { let _ = c.kill().await; }
    Ok(serde_json::json!({ "ok": true }))
}

#[tauri::command]
fn bridge_status(state: tauri::State<'_, AppState>) -> serde_json::Value {
    let bp = state.bridge.lock().unwrap();
    serde_json::json!({ "running": bp.bridge.is_some() })
}

// ── App setup ─────────────────────────────────────────────────────

pub fn run() {
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
            bridge_start,
            bridge_stop,
            bridge_status,
            mods_get_community_folder,
            mods_list,
            mod_toggle,
            mod_delete,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
