import admin from "firebase-admin";
import fs from "node:fs";

const DB_URL  = "https://simapp-99f40-default-rtdb.europe-west1.firebasedatabase.app";
const API_KEY = "AIzaSyAxHmLWOIJl4xC44uHsRbxqzRhF4mA0kqE";

// ── Auth state ──────────────────────────────────────────────────────
let _idToken   = null;
let _tokenExp  = 0;
let _refresh   = process.env.FIREBASE_REFRESH_TOKEN || null;

async function renewToken() {
  if (!_refresh) return null;
  try {
    const r = await fetch(
      `https://securetoken.googleapis.com/v1/token?key=${API_KEY}`,
      { method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ grant_type:"refresh_token", refresh_token:_refresh }) }
    );
    const d = await r.json();
    if (d.error) { console.warn("[fb] token hiba:", d.error.message); return null; }
    _idToken  = d.id_token;
    _refresh  = d.refresh_token;
    _tokenExp = Date.now() + 55 * 60 * 1000;
    return _idToken;
  } catch(e) { console.warn("[fb] token refresh hiba:", e.message); return null; }
}

async function token() {
  if (_idToken && Date.now() < _tokenExp) return _idToken;
  return renewToken();
}

// ── Admin SDK (service account) ─────────────────────────────────────
let _db = null, _msg = null;

export function initFirebase(serviceAccountPath) {
  if (!serviceAccountPath) {
    if (_refresh) console.log("[fb] REST API mód (refresh token)");
    else          console.warn("[fb] OFFLINE — nincs service account és nincs refresh token");
    return;
  }
  try {
    const cred = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
    admin.initializeApp({
      credential:  admin.credential.cert(cred),
      databaseURL: DB_URL,
    });
    _db  = admin.database();
    _msg = admin.messaging();
    console.log("[fb] Firebase Admin SDK kész");
  } catch(e) {
    console.warn("[fb] Admin SDK init hiba:", e.message, "→ REST API módra váltás");
  }
}

// ── REST API helpers ─────────────────────────────────────────────────
async function rtdb(path, method, body) {
  const tok = await token();
  if (!tok) throw new Error("nincs Firebase auth token");
  const url = `${DB_URL}${path}?auth=${tok}`;
  const r = await fetch(url, {
    method,
    headers: { "Content-Type":"application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`RTDB ${method} ${path} → HTTP ${r.status}`);
  return r.json();
}

// ── Public API ───────────────────────────────────────────────────────
export function writeLive(sessionCode, telemetry, derived) {
  const data = { ...telemetry, ...derived, ts: Date.now() };
  if (_db) return _db.ref(`sessions/${sessionCode}/live`).set(data);
  return rtdb(`/sessions/${sessionCode}/live.json`, "PUT", data);
}

export function clearLive(sessionCode) {
  if (_db) return _db.ref(`sessions/${sessionCode}/live`).remove();
  return rtdb(`/sessions/${sessionCode}/live.json`, "DELETE");
}

export function writeLanding(sessionCode, data) {
  if (_db) return _db.ref(`sessions/${sessionCode}/lastLanding`).set(data);
  return rtdb(`/sessions/${sessionCode}/lastLanding.json`, "PUT", data);
}

let _pollTimer = null;
export function watchTriggers(sessionCode, cb) {
  if (_db) {
    _db.ref(`sessions/${sessionCode}/triggers`).on("value", s => {
      const v = s.val();
      cb(v ? Object.entries(v).map(([id,d])=>({id,...d})) : []);
    });
    return;
  }
  // REST polling every 5s
  const poll = async () => {
    try {
      const data = await rtdb(`/sessions/${sessionCode}/triggers.json`, "GET");
      cb(data ? Object.entries(data).map(([id,d])=>({id,...d})) : []);
    } catch {}
  };
  poll();
  _pollTimer = setInterval(poll, 5000);
}

export async function pushToDevices(sessionCode, { title, body, data = {} }) {
  if (!_msg) return { sent: 0 }; // push csak Admin SDK-val működik
  try {
    const snap = await _db.ref(`sessions/${sessionCode}/devices`).once("value");
    const v = snap.val();
    const tokens = v ? Object.values(v).map(d => d.fcmToken).filter(Boolean) : [];
    if (!tokens.length) return { sent: 0 };
    const r = await _msg.sendEachForMulticast({
      tokens,
      notification: { title, body },
      data: Object.fromEntries(Object.entries(data).map(([k,v])=>[k,String(v)])),
      android: { priority:"high", notification:{ channelId:"default", sound:"default" } },
    });
    return { sent: r.successCount };
  } catch(e) { console.warn("[fb] push hiba:", e.message); return { sent: 0 }; }
}
