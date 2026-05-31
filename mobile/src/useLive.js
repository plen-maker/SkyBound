import { useEffect, useState, useCallback } from "react";
import { db, ref, onValue, push, remove, update } from "./firebase";

const SESSION = "ddnemet-host"; // TODO: make configurable from settings

export function useLive() {
  const [live, setLive]       = useState(null);
  const [connected, setConn]  = useState(false);

  useEffect(() => {
    const u1 = onValue(ref(db, `sessions/${SESSION}/live`), s => setLive(s.val()));
    const u2 = onValue(ref(db, ".info/connected"), s => setConn(s.val() === true));
    return () => { u1(); u2(); };
  }, []);

  return { live, connected };
}

export function useTriggers() {
  const [triggers, setTriggers] = useState([]);

  useEffect(() => {
    return onValue(ref(db, `sessions/${SESSION}/triggers`), s => {
      const v = s.val();
      setTriggers(v ? Object.entries(v).map(([id,d]) => ({id,...d})) : []);
    });
  }, []);

  const add    = useCallback(t => push(ref(db, `sessions/${SESSION}/triggers`), {armed:true,...t}), []);
  const del    = useCallback(id => remove(ref(db, `sessions/${SESSION}/triggers/${id}`)), []);
  const toggle = useCallback((id, armed) => update(ref(db, `sessions/${SESSION}/triggers/${id}`), {armed}), []);

  return { triggers, add, del, toggle };
}
