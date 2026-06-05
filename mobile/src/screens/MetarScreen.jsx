import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { Card } from '../components/Card';
import { THEME } from '../theme';

function parseMetar(raw) {
  if (!raw) return {};
  const wind = raw.match(/(\d{3}|VRB)(\d{2,3})(G(\d{2,3}))?KT/);
  const vis = raw.match(/\b(\d{4})\b/);
  const clouds = [];
  const cr = /(FEW|SCT|BKN|OVC)(\d{3})/g; let cm;
  while ((cm = cr.exec(raw)) !== null) clouds.push({ type: cm[1], ft: parseInt(cm[2]) * 100 });
  const td = raw.match(/(M?\d{2})\/(M?\d{2})/);
  const q = raw.match(/Q(\d{4})/);
  return {
    windDir: wind ? (wind[1] === 'VRB' ? 'VRB' : parseInt(wind[1])) : null,
    windSpd: wind ? parseInt(wind[2]) : null,
    windGust: wind?.[4] ? parseInt(wind[4]) : null,
    vis: vis ? parseInt(vis[1]) : null,
    clouds,
    temp: td ? parseInt(td[1].replace('M', '-')) : null,
    dew: td ? parseInt(td[2].replace('M', '-')) : null,
    qnh: q ? parseInt(q[1]) : null,
  };
}

const CAT_COLOR = { VFR: THEME.gn, MVFR: THEME.cy, IFR: THEME.am, LIFR: THEME.rd };
const CLOUD_COLOR = { FEW: THEME.gn, SCT: THEME.am, BKN: THEME.rd, OVC: THEME.rd };
const WIND_ARROWS = ['↓','↙','←','↖','↑','↗','→','↘'];
const windArrow = dir => dir === 'VRB' ? '↻' : WIND_ARROWS[Math.round(((dir+180)%360)/45)%8];

export default function MetarScreen() {
  const [icao, setIcao] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function load(ic) {
    const id = (ic || icao).trim().toUpperCase();
    if (!id) return;
    setLoading(true); setError(''); setData(null);
    try {
      const r = await fetch(`https://aviationweather.gov/api/data/metar?ids=${id}&format=json&hours=2`);
      const d = await r.json();
      if (!d?.length) { setError(`Nem található METAR: ${id}`); }
      else setData(d);
    } catch(e) { setError(e.message); }
    setLoading(false);
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>METAR / TAF</Text>
      <Card>
        <View style={styles.row}>
          <TextInput style={styles.icaoInput} value={icao} onChangeText={t => setIcao(t.toUpperCase())}
            placeholder="LHBP" placeholderTextColor={THEME.dim} maxLength={4}
            autoCapitalize="characters" onSubmitEditing={() => load(icao)} />
          <TouchableOpacity style={styles.btn} onPress={() => load(icao)}>
            {loading ? <ActivityIndicator color={THEME.bg} size="small" /> : <Text style={styles.btnText}>🌤 Betölt</Text>}
          </TouchableOpacity>
        </View>
      </Card>

      {!!error && <Card style={styles.errCard}><Text style={styles.errText}>⚠ {error}</Text></Card>}

      {(data || []).map((item, i) => {
        const raw = item.rawOb || item.raw_text || '';
        const p = parseMetar(raw);
        const cat = item.flightCategory || item.flight_category || '';
        const catCol = CAT_COLOR[cat] || THEME.dim;
        return (
          <Card key={i}>
            <View style={styles.stationRow}>
              <View>
                <Text style={styles.stationId}>{item.stationId || item.station_id || icao}</Text>
                <Text style={styles.obsTime}>{item.observationTime || item.observation_time || ''}</Text>
              </View>
              {!!cat && <View style={[styles.catBadge, { backgroundColor: catCol + '22', borderColor: catCol + '55' }]}>
                <Text style={[styles.catText, { color: catCol }]}>{cat}</Text>
              </View>}
            </View>
            {p.windDir != null && (
              <View style={styles.windRow}>
                <Text style={styles.windArrow}>{windArrow(p.windDir)}</Text>
                <View>
                  <Text style={styles.windMain}>
                    {p.windDir === 'VRB' ? 'VRB' : `${p.windDir}°`} {p.windSpd}{p.windGust ? `G${p.windGust}` : ''} kt
                  </Text>
                  <Text style={styles.windSub}>Wind</Text>
                </View>
              </View>
            )}
            <View style={styles.statsGrid}>
              {p.vis != null && <View style={styles.statCell}><Text style={styles.statLabel}>Látás</Text><Text style={styles.statValue}>{p.vis >= 9999 ? '10+ km' : `${p.vis}m`}</Text></View>}
              {p.qnh != null && <View style={styles.statCell}><Text style={styles.statLabel}>QNH</Text><Text style={[styles.statValue, { color: THEME.cy }]}>{p.qnh} hPa</Text></View>}
              {p.temp != null && <View style={styles.statCell}><Text style={styles.statLabel}>Hőm.</Text><Text style={[styles.statValue, { color: p.temp < 0 ? THEME.cy : THEME.am }]}>{p.temp}°C</Text></View>}
              {p.dew != null && <View style={styles.statCell}><Text style={styles.statLabel}>DP</Text><Text style={styles.statValue}>{p.dew}°C</Text></View>}
            </View>
            {p.clouds.length > 0 && (
              <View style={styles.cloudsRow}>
                {p.clouds.map((cl, ci) => (
                  <View key={ci} style={[styles.cloudBadge, { backgroundColor: CLOUD_COLOR[cl.type] + '18', borderColor: CLOUD_COLOR[cl.type] + '44' }]}>
                    <Text style={[styles.cloudText, { color: CLOUD_COLOR[cl.type] }]}>{cl.type} {cl.ft.toLocaleString()}ft</Text>
                  </View>
                ))}
              </View>
            )}
            <Text style={styles.rawMetar}>{raw}</Text>
          </Card>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: THEME.bg },
  content: { padding: 16, paddingBottom: 32 },
  title: { fontSize: 18, fontWeight: '800', color: THEME.tx, marginBottom: 12 },
  row: { flexDirection: 'row', gap: 8 },
  icaoInput: { flex: 1, backgroundColor: THEME.p2, borderWidth: 1, borderColor: THEME.line, borderRadius: 8, padding: 10, color: THEME.tx, fontSize: 22, letterSpacing: 4 },
  btn: { backgroundColor: THEME.cy, borderRadius: 8, paddingHorizontal: 14, justifyContent: 'center' },
  btnText: { color: THEME.bg, fontWeight: '700', fontSize: 13 },
  errCard: { borderColor: 'rgba(240,96,128,0.2)', backgroundColor: 'rgba(240,96,128,0.05)' },
  errText: { color: THEME.rd, fontSize: 12 },
  stationRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  stationId: { fontSize: 20, fontWeight: '800', color: THEME.tx },
  obsTime: { fontSize: 10, color: THEME.dim, marginTop: 2 },
  catBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  catText: { fontSize: 12, fontWeight: '800' },
  windRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  windArrow: { fontSize: 32, color: THEME.cy },
  windMain: { fontSize: 18, fontWeight: '700', color: THEME.tx },
  windSub: { fontSize: 9, color: THEME.dim },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  statCell: { backgroundColor: THEME.p2, borderRadius: 8, padding: 8, borderWidth: 1, borderColor: THEME.line, minWidth: '22%' },
  statLabel: { fontSize: 9, color: THEME.dim, marginBottom: 2 },
  statValue: { fontSize: 13, color: THEME.tx, fontWeight: '600' },
  cloudsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  cloudBadge: { borderRadius: 7, paddingHorizontal: 9, paddingVertical: 4, borderWidth: 1 },
  cloudText: { fontSize: 11, fontWeight: '700' },
  rawMetar: { fontSize: 10, color: THEME.dim, fontFamily: 'monospace', lineHeight: 16, backgroundColor: THEME.bg, padding: 8, borderRadius: 7 },
});
