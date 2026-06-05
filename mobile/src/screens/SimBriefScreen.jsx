import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Card } from '../components/Card';
import { THEME } from '../theme';

const API = 'https://www.simbrief.com/api/xml.fetcher.php';
const fmt = (v, u = '') => v == null ? '—' : `${Math.round(v).toLocaleString()} ${u}`.trim();

export default function SimBriefScreen() {
  const [username, setUsername] = useState('');
  const [ofp, setOfp] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    AsyncStorage.getItem('sbUser').then(v => { if (v) setUsername(v); });
  }, []);

  async function load() {
    const un = username.trim();
    if (!un) { setError('Adj meg SimBrief usernevet.'); return; }
    setLoading(true); setError('');
    try {
      const r = await fetch(`${API}?username=${un}&json=1`);
      const d = await r.json();
      if (d.fetch?.status === 'Error') { setError(d.fetch.message); setLoading(false); return; }
      const n = v => v == null || v === '' ? null : parseFloat(v);
      const w = d.weights || {}, f = d.fuel || {}, g = d.general || {}, t = d.times || {};
      const etes = n(t.est_time_enroute);
      setOfp({
        dep: d.origin?.icao_code, arr: d.destination?.icao_code, altn: d.alternate?.icao_code,
        aircraft: `${d.aircraft?.icaocode || ''} ${d.aircraft?.name || ''}`.trim(),
        units: w.units || 'kg',
        pax: n(w.pax_count), payload: n(w.payload), zfw: n(w.est_zfw), tow: n(w.est_tow),
        blockFuel: n(f.plan_ramp), enrouteBurn: n(f.enroute_burn),
        contFuel: n(f.contingency), altFuel: n(f.alternate_burn),
        resFuel: n(f.reserve), extraFuel: n(f.extra),
        costindex: n(g.costindex), route: g.route,
        routeDistNm: n(g.route_distance) || n(g.air_distance),
        ete: etes ? `${Math.floor(etes/3600)}h${String(Math.floor((etes%3600)/60)).padStart(2,'0')}m` : null,
      });
      await AsyncStorage.setItem('sbUser', un);
    } catch(e) { setError(e.message); }
    setLoading(false);
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>SimBrief OFP</Text>
      <Card>
        <Text style={styles.inputLabel}>SIMBRIEF USERNÉV</Text>
        <View style={styles.row}>
          <TextInput style={styles.input} value={username} onChangeText={setUsername}
            placeholder="pl. ddnemet" placeholderTextColor={THEME.dim}
            autoCapitalize="none" onSubmitEditing={load} />
          <TouchableOpacity style={styles.btn} onPress={load} disabled={loading}>
            {loading ? <ActivityIndicator color={THEME.bg} size="small" /> : <Text style={styles.btnText}>Betölt</Text>}
          </TouchableOpacity>
        </View>
      </Card>

      {!!error && <Card style={styles.errCard}><Text style={styles.errText}>⚠ {error}</Text></Card>}

      {ofp && (
        <Card>
          <Text style={styles.route}>{ofp.dep || '?'} → {ofp.arr || '?'}{ofp.altn ? ` / ${ofp.altn}` : ''}</Text>
          <Text style={styles.aircraft}>{ofp.aircraft}</Text>
          <View style={styles.grid}>
            {[['PAX', fmt(ofp.pax)], ['Payload', fmt(ofp.payload, ofp.units)],
              ['ZFW', fmt(ofp.zfw, ofp.units)], ['TOW', fmt(ofp.tow, ofp.units)],
              ['Block', fmt(ofp.blockFuel, ofp.units)], ['Trip burn', fmt(ofp.enrouteBurn, ofp.units)],
              ['CI', fmt(ofp.costindex)], ['ETE', ofp.ete || '—'],
              ['Dist', fmt(ofp.routeDistNm, 'nm')], ['Extra', fmt(ofp.extraFuel, ofp.units)]
            ].map(([l, v]) => (
              <View key={l} style={styles.cell}>
                <Text style={styles.cellLabel}>{l}</Text>
                <Text style={styles.cellValue}>{v}</Text>
              </View>
            ))}
          </View>
          {ofp.route && (
            <>
              <Text style={styles.sectionLabel}>ROUTE</Text>
              <Text style={styles.routeText}>{ofp.route}</Text>
            </>
          )}
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: THEME.bg },
  content: { padding: 16, paddingBottom: 32 },
  title: { fontSize: 18, fontWeight: '800', color: THEME.tx, marginBottom: 12 },
  inputLabel: { fontSize: 8, color: THEME.dim, letterSpacing: 1.5, marginBottom: 6 },
  row: { flexDirection: 'row', gap: 8 },
  input: { flex: 1, backgroundColor: THEME.p2, borderWidth: 1, borderColor: THEME.line, borderRadius: 8, padding: 10, color: THEME.tx, fontSize: 13 },
  btn: { backgroundColor: THEME.cy, borderRadius: 8, paddingHorizontal: 16, justifyContent: 'center' },
  btnText: { color: THEME.bg, fontWeight: '700', fontSize: 13 },
  errCard: { borderColor: 'rgba(240,96,128,0.2)', backgroundColor: 'rgba(240,96,128,0.05)' },
  errText: { color: THEME.rd, fontSize: 12 },
  route: { fontSize: 22, fontWeight: '800', color: THEME.tx, marginBottom: 4 },
  aircraft: { fontSize: 11, color: THEME.dim, marginBottom: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  cell: { width: '48%', backgroundColor: THEME.p2, borderRadius: 8, padding: 9, borderWidth: 1, borderColor: THEME.line },
  cellLabel: { fontSize: 9, color: THEME.dim, marginBottom: 2 },
  cellValue: { fontSize: 12, color: THEME.tx, fontVariant: ['tabular-nums'] },
  sectionLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1.5, color: THEME.dim, marginTop: 14, marginBottom: 6 },
  routeText: { fontSize: 11, color: THEME.tx, lineHeight: 18, fontFamily: 'monospace' },
});
