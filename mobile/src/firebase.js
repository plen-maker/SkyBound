import { initializeApp, getApps } from "firebase/app";
import {
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, onAuthStateChanged,
} from "firebase/auth";
import { getDatabase, ref, onValue, push, remove, update, set } from "firebase/database";
import Constants from "expo-constants";

const cfg = Constants.expoConfig?.extra?.firebase;
export const app = cfg ? (getApps().length ? getApps()[0] : initializeApp(cfg)) : null;

export const auth = app ? getAuth(app) : null;
export const db   = app ? getDatabase(app) : null;

export {
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, onAuthStateChanged,
  ref, onValue, push, remove, update, set,
};
