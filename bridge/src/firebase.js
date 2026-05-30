/* Firebase Admin — RTDB (Realtime Database).
   Uses RTDB instead of Firestore: no per-write billing, ideal for 1Hz telemetry. */
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
  console.log("[fb] Firebase Admin initialised (RTDB)");
}

export function writeLive(sessionCode, telemetry, derived) {
  return db.ref(`sessions/${sessionCode}/live`).set({ ...telemetry, ...derived, ts: Date.now() });
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
  return v ? Object.values(v).map(d=>d.fcmToken).filter(Boolean) : [];
}

export async function pushToDevices(sessionCode, { title, body, data = {} }) {
  const tokens = await deviceTokens(sessionCode);
  if (!tokens.length) return { sent: 0 };
  const r = await messaging.sendEachForMulticast({
    tokens, notification: { title, body },
    data: Object.fromEntries(Object.entries(data).map(([k,v])=>[k,String(v)])),
    android: { priority: "high" },
    apns: { payload: { aps: { sound: "default" } } },
  });
  console.log(`[fb] push "${title}" → ${r.successCount}/${tokens.length}`);
  return { sent: r.successCount };
}
