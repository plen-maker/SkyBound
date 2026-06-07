import admin from "firebase-admin";
import fs from "node:fs";

let db, messaging;

export function initFirebase(serviceAccountPath) {
  const cred = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
  admin.initializeApp({
    credential: admin.credential.cert(cred),
    databaseURL: "https://simapp-99f40-default-rtdb.europe-west1.firebasedatabase.app",
  });
  db = admin.database();
  messaging = admin.messaging();
  console.log("[fb] Firebase Admin initialised");
}

export function writeLive(sessionCode, telemetry, derived) {
  return db.ref(`sessions/${sessionCode}/live`).set({ ...telemetry, ...derived, ts: Date.now() });
}

export function clearLive(sessionCode) {
  return db.ref(`sessions/${sessionCode}/live`).remove();
}

export function writeLanding(sessionCode, data) {
  return db.ref(`sessions/${sessionCode}/lastLanding`).set(data);
}

export function watchTriggers(sessionCode, cb) {
  db.ref(`sessions/${sessionCode}/triggers`).on("value", snap => {
    const v = snap.val();
    cb(v ? Object.entries(v).map(([id,d])=>({id,...d})) : []);
  });
}

export async function deviceTokens(sessionCode) {
  const snap = await db.ref(`sessions/${sessionCode}/devices`).once("value");
  const v = snap.val();
  if (!v) return [];
  return Object.values(v).map(d => d.fcmToken).filter(Boolean);
}

export async function pushToDevices(sessionCode, { title, body, data = {} }) {
  const tokens = await deviceTokens(sessionCode);
  if (!tokens.length) {
    console.log(`[fb] push "${title}" — nincs eszköz`);
    return { sent: 0 };
  }

  // Send via FCM
  const r = await messaging.sendEachForMulticast({
    tokens,
    notification: { title, body },
    data: Object.fromEntries(Object.entries(data).map(([k,v])=>[k,String(v)])),
    android: {
      priority: "high",
      notification: {
        channelId: "default",
        sound: "default",
        priority: "max",
        vibrateTimingsMillis: [0, 250, 250, 250],
      },
    },
    apns: {
      payload: { aps: { sound: "default", badge: 1 } },
      headers: { "apns-priority": "10" },
    },
  });
  console.log(`[fb] push "${title}" → ${r.successCount}/${tokens.length}`);
  return { sent: r.successCount };
}
