import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithCredential, signOut, onAuthStateChanged } from "firebase/auth";
import { getDatabase, ref, onValue, push, remove, update, set } from "firebase/database";
import Constants from "expo-constants";

const cfg = Constants.expoConfig.extra.firebase;
const app = getApps().length ? getApps()[0] : initializeApp(cfg);

export const auth = getAuth(app);
export const db   = getDatabase(app);
export const gprov = new GoogleAuthProvider();

export { onAuthStateChanged, signOut, signInWithCredential, GoogleAuthProvider };
export { ref, onValue, push, remove, update, set };
