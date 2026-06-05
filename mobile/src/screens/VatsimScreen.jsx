import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Card } from '../components/Card';
import { THEME } from '../theme';

const FAC = {0:'OBS',1:'FSS',2:'DEL',3:'GND',4:'TWR',5:'APP',6:'CTR'};
const FC = {DEL:'#a78bfa',GND:'#52e3b0',TWR:'#5ec8ff',APP:'#ffb454',CTR:'#f06080',FSS:'#94a3b8',OBS:'#4a6080'};

export default function VatsimScreen() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [openAtis, setOpenAtis] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch('https://data.vatsim.net/v3/vatsim-data.json');
      setData(await r.json());
    } catch {}
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const atisMap = {};
  (data?.atis || []).forEach(a => { atisMap[a.callsign] = a; });
  const controllers = (data?.controllers || []).filter(c => c.facility > 0).slice(0, 60);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>VATSIM ATC</Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={load}>
          {loading ? <ActivityIndicator color={THEME.cy} size="small" /> : <Text style={styles.refreshText}>↻ Frissít</Text>}
        </TouchableOpacity>
      </View>
      {!data && !loading && <Card><Text style={{ color: THEME.dim, fontSize: 12 }}>Töltés...</Text></Card>}
      {controllers.map((c, i) => {
        const fac = FAC[c.facility] || 'CTR';
        const fc = FC[fac] || THEME.dim;
        const at = atisMap[c.callsign];
        const isOpen = openAtis === c.callsign;
        return (
          <TouchableOpacity key={c.callsign} onPress={() => at && setOpenAtis(isOpen ? null : c.callsign)}>
            <Card style={styles.vitem}>
              <View style={styles.vrow}>
                <View style={[styles.badge, { backgroundColor: fc + '20', borderColor: fc + '44' }]}>
                  <Text style={[styles.badgeText, { color: fc }]}>{fac}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.callsign}>{c.callsign}</Text>
                    {at && <Text style={styles.atisCode}>ATIS {at.atis_code || ''}</Text>}
                  </View>
                  <Text style={styles.ctrlName}>{c.name}</Text>
                </View>
                <Text style={styles.freq}>{c.frequency}</Text>
              </View>
              {isOpen && at && (
                <View style={styles.atisBox}>
                  <Text style={styles.atisText}>{at.text_atis?.join(' ') || ''}</Text>
                </View>
              )}
            </Card>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: THEME.bg },
  content: { padding: 16, paddingBottom: 32 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '800', color: THEME.tx },
  refreshBtn: { backgroundColor: THEME.p2, borderWidth: 1, borderColor: THEME.line, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  refreshText: { color: THEME.dim, fontSize: 12, fontWeight: '600' },
  vitem: { marginBottom: 6 },
  vrow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  badge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  callsign: { fontSize: 13, fontWeight: '700', color: THEME.tx },
  atisCode: { fontSize: 10, color: THEME.cy },
  ctrlName: { fontSize: 10, color: THEME.dim, marginTop: 1 },
  freq: { fontSize: 13, color: THEME.am, fontVariant: ['tabular-nums'] },
  atisBox: { marginTop: 8, backgroundColor: THEME.bg, borderRadius: 7, padding: 8, borderWidth: 1, borderColor: THEME.line },
  atisText: { fontSize: 10, color: THEME.dim, lineHeight: 16, fontFamily: 'monospace' },
});
