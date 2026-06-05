import { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from './firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';

export function useLive() {
  const [live, setLive] = useState(null);
  const [rtdb, setRtdb] = useState(false);
  const [sessionCode, setSessionCode] = useState('ddnemet-host');

  useEffect(() => {
    AsyncStorage.getItem('sessionCode').then(v => { if (v) setSessionCode(v); });
  }, []);

  useEffect(() => {
    if (!sessionCode) return;
    let lt;
    const r1 = ref(db, `sessions/${sessionCode}/live`);
    const u1 = onValue(r1, s => {
      clearTimeout(lt);
      lt = setTimeout(() => setLive(s.val()), 200);
    }, () => {});
    const r2 = ref(db, '.info/connected');
    const u2 = onValue(r2, s => setRtdb(s.val() === true), () => {});
    return () => { u1(); u2(); clearTimeout(lt); };
  }, [sessionCode]);

  return { live, rtdb, sessionCode, setSessionCode };
}
