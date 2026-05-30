import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { db, ref, set } from "./firebase";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPush(uid) {
  if (!Device.isDevice) return null;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (existing !== "granted") {
    const { status: newStatus } = await Notifications.requestPermissionsAsync();
    status = newStatus;
  }
  if (status !== "granted") return null;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("skybound", {
      name: "SkyBound EFB",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#5ec8ff",
    });
  }

  const token = (await Notifications.getDevicePushTokenAsync()).data;

  // Store token in Firebase under this user's session
  const tokenKey = token.slice(0, 24).replace(/[^a-zA-Z0-9]/g, "_");
  await set(ref(db, `sessions/ddnemet-host/devices/${tokenKey}`), {
    fcmToken: token,
    platform: Platform.OS,
    boundAt: Date.now(),
  });

  return token;
}
