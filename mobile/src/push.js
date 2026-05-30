/* Register this device for FCM push and store the token under the user's session. */
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { doc, setDoc } from "firebase/firestore";
import { db } from "./firebase";

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false }),
});

export async function registerForPush(uid, deviceName = "phone") {
  if (!Device.isDevice) { console.warn("[push] needs a physical device"); return null; }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (existing !== "granted") status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== "granted") { console.warn("[push] permission denied"); return null; }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "SkyBound", importance: Notifications.AndroidImportance.HIGH,
    });
  }

  // native FCM/APNs device token (works with the firebase-admin sender in the bridge)
  const token = (await Notifications.getDevicePushTokenAsync()).data;

  await setDoc(doc(db, "sessions", uid, "devices", token.slice(0, 24)), {
    fcmToken: token, name: deviceName, platform: Platform.OS, boundAt: Date.now(),
  }, { merge: true });

  return token;
}
