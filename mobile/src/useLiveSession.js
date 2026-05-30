/* Subscribe to live telemetry written by the bridge + manage triggers. */
import { useEffect, useState, useCallback } from "react";
import {
  doc, onSnapshot, collection, addDoc, updateDoc, deleteDoc,
} from "firebase/firestore";
import { db } from "./firebase";

export function useLiveSession(uid) {
  const [live, setLive] = useState(null);
  const [triggers, setTriggers] = useState([]);

  useEffect(() => {
    if (!uid) return;
    const unsubLive = onSnapshot(doc(db, "sessions", uid), (s) => setLive(s.data()?.live ?? null));
    const unsubTr = onSnapshot(collection(db, "sessions", uid, "triggers"),
      (snap) => setTriggers(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return () => { unsubLive(); unsubTr(); };
  }, [uid]);

  const addTrigger = useCallback((t) =>
    addDoc(collection(db, "sessions", uid, "triggers"), { armed: true, ...t }), [uid]);
  const toggleTrigger = useCallback((id, armed) =>
    updateDoc(doc(db, "sessions", uid, "triggers", id), { armed }), [uid]);
  const removeTrigger = useCallback((id) =>
    deleteDoc(doc(db, "sessions", uid, "triggers", id)), [uid]);

  return { live, triggers, addTrigger, toggleTrigger, removeTrigger };
}
