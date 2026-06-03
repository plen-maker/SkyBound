use tauri::Manager;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

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
                    serde_json::json!({
                        "update": true,
                        "codename": rel["tag_name"],
                        "url": rel["html_url"],
                    })
                } else {
                    serde_json::json!({ "update": false })
                }
            }
        }
    }
}

// ── App setup ─────────────────────────────────────────────────────

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![
            load_settings,
            save_settings,
            get_version,
            save_version_settings,
            fetch_ofp,
            check_update,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
