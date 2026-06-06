import { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from './firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';

export function useLive() {
  const [live, setLive] = useState(null);
  const [rtdb, setRtdb] = useState(false);
  const [sessionCode, setSessionCode] = useState('');

  useEffect(() => {
    AsyncStorage.getItem('sessionCode').then(v => {
      if (v && v.trim()) setSessionCode(v.trim());
    });
  }, []);

  useEffect(() => {
    // Don't connect if no session code
    if (!sessionCode || !sessionCode.trim()) {
      setLive(null);
      setRtdb(false);
      return;
    }

    let lt;
    const r1 = ref(db, `sessions/${sessionCode}/live`);
    const u1 = onValue(r1, s => {
      clearTimeout(lt);
      const val = s.val();
      // If data is older than 30s, ignore it
      if (val && val.ts && Date.now() - val.ts > 30000) {
        setLive(null);
        return;
      }
      lt = setTimeout(() => setLive(val), 200);
    }, () => {});

    const r2 = ref(db, '.info/connected');
    const u2 = onValue(r2, s => setRtdb(s.val() === true), () => {});

    return () => { u1(); u2(); clearTimeout(lt); };
  }, [sessionCode]);

  return { live, rtdb, sessionCode, setSessionCode };
}
