import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { THEME as C } from '../theme';

const DEFAULT_PORT = '47821';

export default function ConnectScreen({ onConnected }) {
  const [ip, setIp] = useState('');
  const [testing, setTesting] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    AsyncStorage.getItem('desktopIp').then(v => { if (v) setIp(v); });
  }, []);

  async function connect() {
    const trimmed = ip.trim().replace(/^https?:\/\//, '').replace(/:\d+$/, '');
    if (!trimmed) { setErr('Add meg a desktop IP-jét!'); return; }
    const url = `http://${trimmed}:${DEFAULT_PORT}`;
    setTesting(true); setErr('');
    try {
      const res = await Promise.race([
        fetch(`${url}/api/version`, { method: 'GET' }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 6000)),
      ]);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      await AsyncStorage.setItem('desktopIp', trimmed);
      await AsyncStorage.setItem('desktopUrl', url);
      onConnected(url);
    } catch (e) {
      setErr(`Nem sikerült csatlakozni:\n${e.message}\n\nBizonyosodj meg, hogy a desktop app fut és ugyanazon a WiFi hálózaton vagy.`);
    }
    setTesting(false);
  }

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.inner}>
        <Text style={s.logo}>✈</Text>
        <Text style={s.title}>Xdeck EFB</Text>
        <Text style={s.sub}>Csatlakozás a desktop apphoz</Text>

        <View style={s.card}>
          <Text style={s.label}>Desktop IP-cím</Text>
          <Text style={s.hint}>Nyisd meg a CMD-t és írd be: <Text style={s.code}>ipconfig</Text>{'\n'}Az IPv4 Address értéket add meg itt.</Text>
          <View style={s.inputRow}>
            <TextInput
              style={s.input}
              value={ip}
              onChangeText={v => { setIp(v); setErr(''); }}
              placeholder="192.168.1.100"
              placeholderTextColor={C.dim}
              keyboardType="numeric"
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={connect}
            />
            <Text style={s.port}>:{DEFAULT_PORT}</Text>
          </View>

          {!!err && <Text style={s.err}>{err}</Text>}

          <TouchableOpacity style={s.btn} onPress={connect} disabled={testing}>
            {testing
              ? <ActivityIndicator color="#08090e" size="small" />
              : <Text style={s.btnTx}>Csatlakozás</Text>
            }
          </TouchableOpacity>
        </View>

        <View style={s.steps}>
          <Text style={s.stepsTitle}>Hogyan csatlakoztass?</Text>
          {[
            ['1', 'Indítsd el a desktop Xdeck EFB-t'],
            ['2', 'Csatlakoztasd a telefont ugyanahhoz a WiFi-hez'],
            ['3', 'CMD → ipconfig → IPv4 Address'],
            ['4', 'Írd be az IP-t és nyomj Csatlakozás-t'],
          ].map(([n, t]) => (
            <View key={n} style={s.step}>
              <View style={s.stepNum}><Text style={s.stepN}>{n}</Text></View>
              <Text style={s.stepTx}>{t}</Text>
            </View>
          ))}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#08090e' },
  inner: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center' },
  logo: { fontSize: 48, marginBottom: 8 },
  title: { fontSize: 24, fontWeight: '800', color: '#e8eeff', letterSpacing: 1 },
  sub: { fontSize: 13, color: '#4a5880', marginBottom: 28, marginTop: 4 },
  card: {
    width: '100%', backgroundColor: '#0a0c18',
    borderWidth: 1, borderColor: '#1a2040', borderRadius: 16,
    padding: 20, marginBottom: 24,
  },
  label: { fontSize: 13, fontWeight: '700', color: '#e8eeff', marginBottom: 6 },
  hint: { fontSize: 11, color: '#4a5880', lineHeight: 16, marginBottom: 14 },
  code: { color: '#4df0ff', fontFamily: 'monospace' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  input: {
    flex: 1, backgroundColor: '#0f1224', borderWidth: 1, borderColor: '#1a2040',
    borderRadius: 10, padding: 12, color: '#e8eeff', fontSize: 16,
    fontFamily: 'monospace', letterSpacing: 1,
  },
  port: { fontSize: 14, color: '#4a5880', fontFamily: 'monospace' },
  err: { fontSize: 12, color: '#ff4d6d', lineHeight: 18, marginBottom: 12 },
  btn: {
    backgroundColor: '#4df0ff', borderRadius: 10, padding: 14,
    alignItems: 'center',
  },
  btnTx: { color: '#08090e', fontWeight: '800', fontSize: 15 },
  steps: { width: '100%' },
  stepsTitle: { fontSize: 11, fontWeight: '700', color: '#4a5880', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  stepNum: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(77,240,255,0.1)', borderWidth: 1, borderColor: 'rgba(77,240,255,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  stepN: { fontSize: 11, fontWeight: '700', color: '#4df0ff' },
  stepTx: { fontSize: 13, color: '#4a5880', flex: 1 },
});
