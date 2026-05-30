/* OPTIONAL Cloud Function path for push, as an alternative to the bridge sending
 * FCM directly. Fires when the bridge writes a `pushQueue` doc. Use this if you'd
 * rather keep FCM credentials server-side only. The bridge would then write to
 * sessions/{uid}/pushQueue instead of calling messaging() itself. */
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
admin.initializeApp();

exports.deliverPush = onDocumentCreated("sessions/{uid}/pushQueue/{id}", async (event) => {
  const { uid } = event.params;
  const ev = event.data.data();
  const devs = await admin.firestore().collection("sessions").doc(uid).collection("devices").get();
  const tokens = devs.docs.map((d) => d.data().fcmToken).filter(Boolean);
  if (!tokens.length) return;
  await admin.messaging().sendEachForMulticast({
    tokens,
    notification: { title: ev.title, body: ev.body },
    android: { priority: "high" },
    apns: { payload: { aps: { sound: "default" } } },
  });
  await event.data.ref.delete();
});
