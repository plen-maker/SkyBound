import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { ref, push, remove, update } from 'firebase/database';
import { db } from '../firebase';
import { useLive } from '../useLive';
import { Card } from '../components/Card';
import { THEME } from '../theme';

export default function AlertsScreen() {
  const { sessionCode, live } = useLive();
  const [kind, setKind] = useState('fix');
  const [fix, setFix] = useState('');
  const [lead, setLead] = useState('5');
  // triggers come from useLive via Firebase
  const [triggers, setTriggers] = useState([]);

  React.useEffect(() => {
    if (!sessionCode) return;
    const { onValue, ref: dbRef } = require('firebase/database');
    const r = dbRef(db, `sessions/${sessionCode}/triggers`);
    const unsub = onValue(r, s => {
      const v = s.val();
      setTriggers(v ? Object.entries(v).map(([id, d]) => ({ id, ...d })) : []);
    });
    return unsub;
  }, [sessionCode]);

  function addTrigger() {
    const t = { armed: true, kind, lead: Number(lead) || 5 };
    if (kind === 'fix') { t.fix = fix.toUpperCase().trim(); if (!t.fix) return; }
    push(ref(db, `sessions/${sessionCode}/triggers`), t);
    setFix('');
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Push Triggers</Text>
      <Card>
        <View style={styles.kindRow}>
          {['fix', 'tod', 'dest'].map(k => (
            <TouchableOpacity key={k} style={[styles.pill, kind === k && styles.pillOn]} onPress={() => setKind(k)}>
              <Text style={[styles.pillText, kind === k && styles.pillTextOn]}>{k === 'fix' ? 'Fix' : k === 'tod' ? 'T/D' : 'Landing'}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.addRow}>
          {kind === 'fix' && (
            <TextInput style={styles.input} value={fix} onChangeText={t => setFix(t.toUpperCase())}
              placeholder="pl. VETIK" placeholderTextColor={THEME.dim} autoCapitalize="characters" />
          )}
          <TextInput style={[styles.input, { width: 70 }]} value={lead} onChangeText={setLead}
            placeholder="min" placeholderTextColor={THEME.dim} keyboardType="numeric" />
          <TouchableOpacity style={styles.addBtn} onPress={addTrigger}>
            <Text style={styles.addBtnText}>＋ Arm</Text>
          </TouchableOpacity>
        </View>
      </Card>
      {triggers.length === 0 && <Text style={styles.empty}>Nincs aktív trigger.</Text>}
      {triggers.map(t => (
        <Card key={t.id} style={styles.trigCard}>
          <View style={styles.trigRow}>
            <TouchableOpacity onPress={() => update(ref(db, `sessions/${sessionCode}/triggers/${t.id}`), { armed: !t.armed })}>
              <Text style={{ fontSize: 20 }}>🔔</Text>
            </TouchableOpacity>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.trigName}>{t.kind === 'fix' ? t.fix : t.kind.toUpperCase()} <Text style={{ color: THEME.dim, fontWeight: '400' }}>− {t.lead} min</Text></Text>
              <Text style={[styles.trigStatus, { color: t.armed ? (t.fired ? THEME.gn : THEME.cy) : THEME.dim }]}>{t.armed ? (t.fired ? '✓ fired' : 'armed') : 'off'}</Text>
            </View>
            <TouchableOpacity onPress={() => remove(ref(db, `sessions/${sessionCode}/triggers/${t.id}`))}>
              <Text style={{ color: THEME.rd, fontSize: 18 }}>✕</Text>
            </TouchableOpacity>
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: THEME.bg },
  content: { padding: 16, paddingBottom: 32 },
  title: { fontSize: 18, fontWeight: '800', color: THEME.tx, marginBottom: 12 },
  kindRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  pill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 99, borderWidth: 1, borderColor: THEME.line, backgroundColor: THEME.p2 },
  pillOn: { backgroundColor: THEME.cy, borderColor: THEME.cy },
  pillText: { fontSize: 12, fontWeight: '600', color: THEME.dim },
  pillTextOn: { color: THEME.bg },
  addRow: { flexDirection: 'row', gap: 8 },
  input: { flex: 1, backgroundColor: THEME.p2, borderWidth: 1, borderColor: THEME.line, borderRadius: 8, padding: 9, color: THEME.tx, fontSize: 13 },
  addBtn: { backgroundColor: THEME.cy, borderRadius: 8, paddingHorizontal: 14, justifyContent: 'center' },
  addBtnText: { color: THEME.bg, fontWeight: '700', fontSize: 13 },
  empty: { textAlign: 'center', color: THEME.dim, fontSize: 12, padding: 24 },
  trigCard: { marginBottom: 6 },
  trigRow: { flexDirection: 'row', alignItems: 'center' },
  trigName: { fontSize: 13, fontWeight: '700', color: THEME.tx },
  trigStatus: { fontSize: 10, marginTop: 2 },
});
