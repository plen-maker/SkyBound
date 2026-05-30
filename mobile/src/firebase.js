/* Firebase client init + Google sign-in (Expo). */
import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithCredential, onAuthStateChanged } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import Constants from "expo-constants";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";

WebBrowser.maybeCompleteAuthSession();

const cfg = Constants.expoConfig.extra.firebase;
const app = getApps().length ? getApps()[0] : initializeApp(cfg);
export const auth = getAuth(app);
export const db = getFirestore(app);

/** Hook: returns [request, promptAsync] for a Google sign-in button. */
export function useGoogleAuth() {
  const g = Constants.expoConfig.extra.googleAuth;
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    iosClientId: g.iosClientId,
    androidClientId: g.androidClientId,
    webClientId: g.webClientId,
  });
  return { request, response, promptAsync };
}

/** Exchange a Google id_token for a Firebase session. */
export async function signInWithGoogleIdToken(idToken) {
  const cred = GoogleAuthProvider.credential(idToken);
  return signInWithCredential(auth, cred);
}

export function watchAuth(cb) { return onAuthStateChanged(auth, cb); }
