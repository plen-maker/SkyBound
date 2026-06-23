import { useState, useEffect } from 'react';
import { ref, onValue, push, remove, update } from 'firebase/database';
import { db } from './firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Module-level session code event bus
const sessionListeners = new Set();
export function subscribeSession(fn) { sessionListeners.add(fn); return () => sessionListeners.delete(fn); }
export function notifySession(code) { sessionListeners.forEach(f => f(code)); }

export function useLive() {
  const [live,        setLive]        = useState(null);
  const [rtdb,        setRtdb]        = useState(false);
  const [sessionCode, setSessionCode] = useState('');

  useEffect(() => {
    AsyncStorage.getItem('sessionCode').then(v => {
      if (v && v.trim()) setSessionCode(v.trim());
    });
    return subscribeSession(code => setSessionCode(code));
  }, []);

  useEffect(() => {
    if (!sessionCode || !sessionCode.trim()) {
      setLive(null); setRtdb(false); return;
    }
    let lt;
    const u1 = onValue(ref(db, `sessions/${sessionCode}/live`), s => {
      clearTimeout(lt);
      const val = s.val();
      if (val && val.ts && Date.now() - val.ts > 30000) { setLive(null); return; }
      lt = setTimeout(() => setLive(val), 200);
    }, () => {});
    const u2 = onValue(ref(db, '.info/connected'), s => setRtdb(s.val() === true), () => {});
    return () => { u1(); u2(); clearTimeout(lt); };
  }, [sessionCode]);

  return { live, rtdb, sessionCode, setSessionCode };
}

export function useTriggers() {
  const { sessionCode } = useLive();
  const [triggers, setTriggers] = useState([]);

  useEffect(() => {
    if (!sessionCode) return;
    const u = onValue(ref(db, `sessions/${sessionCode}/triggers`), s => {
      const v = s.val();
      setTriggers(v ? Object.entries(v).map(([id, d]) => ({ id, ...d })) : []);
    }, () => {});
    return () => u();
  }, [sessionCode]);

  const add    = t   => push(ref(db, `sessions/${sessionCode}/triggers`), { armed: true, ...t });
  const del    = id  => remove(ref(db, `sessions/${sessionCode}/triggers/${id}`));
  const toggle = (id, armed) => update(ref(db, `sessions/${sessionCode}/triggers/${id}`), { armed });

  return { triggers, add, del, toggle };
}
