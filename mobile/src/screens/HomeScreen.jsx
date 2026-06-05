import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLive } from '../useLive';
import { StatCard } from '../components/StatCard';
import { LivePill } from '../components/LivePill';
import { Card } from '../components/Card';
import { THEME } from '../theme';

const SHORTCUTS = [
  { name: 'Navigraph', color: '#a78bfa', icon: 'map', url: 'https://charts.navigraph.com' },
  { name: 'VATSIM',    color: '#52e3b0', icon: 'radio', url: 'https://radar.vatsim.net' },
  { name: 'SimBrief',  color: '#ffb454', icon: 'document-text', url: 'https://dispatch.simbrief.com' },
  { name: 'Spotify',   color: '#1db954', icon: 'musical-notes', url: 'https://open.spotify.com' },
  { name: 'YT Music',  color: '#ff6b6b', icon: 'play-circle', url: 'https://music.youtube.com' },
  { name: 'Discord',   color: '#7c8cff', icon: 'chatbubbles', url: 'https://discord.com/app' },
];

export default function HomeScreen() {
  const { live, rtdb } = useLive();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.appName}>XDECK <Text style={{ color: THEME.cy }}>EFB</Text></Text>
          <Text style={styles.appSub}>{live ? `${live.dep||'?'}→${live.arr||'?'}` : 'no OFP'}</Text>
        </View>
        <LivePill isLive={rtdb && live != null} />
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <StatCard label="ETE"  value={live?.destEteMin != null ? `${Math.floor(live.destEteMin/60)}:${String(Math.round(live.destEteMin)%60).padStart(2,'0')}` : null} unit="h:m" />
        <View style={{ width: 8 }} />
        <StatCard label="GS"   value={live?.gsKt != null ? Math.round(live.gsKt) : null} unit="kt" />
        <View style={{ width: 8 }} />
        <StatCard label="ALT"  value={live?.altFt != null ? Math.round(live.altFt/100)*100 : null} unit="ft" />
        <View style={{ width: 8 }} />
        <StatCard label="V/S"  value={live?.vsFpm != null ? Math.round(live.vsFpm) : null} unit="fpm" />
      </View>

      {!rtdb && (
        <Card style={styles.warnCard}>
          <Text style={styles.warnText}>⚠ Sim bridge nincs csatlakoztatva — az élő adatok akkor jelennek meg, ha fut a bridge a MSFS-es gépen.</Text>
        </Card>
      )}

      {/* Shortcuts */}
      <Text style={styles.sectionLabel}>SHORTCUTS</Text>
      <View style={styles.grid}>
        {SHORTCUTS.map(s => (
          <TouchableOpacity key={s.name} style={styles.tile} onPress={() => Linking.openURL(s.url)}>
            <View style={[styles.tileIcon, { backgroundColor: s.color + '22' }]}>
              <Ionicons name={s.icon} size={18} color={s.color} />
            </View>
            <Text style={styles.tileName}>{s.name}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: THEME.bg },
  content: { padding: 16, paddingBottom: 32 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  appName: { fontSize: 22, fontWeight: '900', color: THEME.tx, letterSpacing: 1 },
  appSub: { fontSize: 10, color: THEME.dim, marginTop: 2 },
  statsRow: { flexDirection: 'row', marginBottom: 12 },
  warnCard: { borderColor: 'rgba(255,180,84,0.2)', backgroundColor: 'rgba(255,180,84,0.05)', marginBottom: 12 },
  warnText: { fontSize: 12, color: THEME.am, lineHeight: 18 },
  sectionLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 2, color: THEME.dim, marginBottom: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { width: '30.5%', backgroundColor: THEME.panel, borderWidth: 1, borderColor: THEME.line, borderRadius: 12, padding: 12, alignItems: 'flex-start' },
  tileIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  tileName: { fontSize: 11, fontWeight: '600', color: THEME.tx },
});
