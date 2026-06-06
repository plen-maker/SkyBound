import * as Notifications from 'expo-notifications';
import { ref, set } from 'firebase/database';
import { db, auth } from './firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Configure how notifications appear when app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotifications() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Xdeck EFB',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#5ec8ff',
      sound: 'default',
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    console.warn('[notif] Permission not granted');
    return null;
  }

  try {
    const token = (await Notifications.getExpoPushTokenAsync({
      projectId: '8e644485-35c0-47cc-a9c6-68e288e5626c',
    })).data;

    // Save FCM token to Firebase under user's session
    const sessionCode = await AsyncStorage.getItem('sessionCode');
    const user = auth.currentUser;
    if (sessionCode && user) {
      await set(ref(db, `sessions/${sessionCode}/devices/${user.uid}`), {
        fcmToken: token,
        platform: Platform.OS,
        updatedAt: Date.now(),
      });
    }
    console.log('[notif] Token registered:', token);
    return token;
  } catch(e) {
    console.warn('[notif] Token error:', e.message);
    return null;
  }
}
