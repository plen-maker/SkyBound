import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { THEME } from '../theme';

export function LivePill({ isLive }) {
  return (
    <View style={[styles.pill, isLive && styles.live]}>
      <View style={[styles.dot, isLive && styles.dotLive]} />
      <Text style={[styles.text, isLive && styles.textLive]}>{isLive ? 'LIVE' : 'NO BRIDGE'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99, backgroundColor: 'rgba(74,96,128,0.1)', borderWidth: 1, borderColor: 'rgba(74,96,128,0.2)' },
  live: { backgroundColor: 'rgba(82,227,176,0.08)', borderColor: 'rgba(82,227,176,0.25)' },
  dot: { width: 5, height: 5, borderRadius: 99, backgroundColor: THEME.dim },
  dotLive: { backgroundColor: THEME.gn },
  text: { fontSize: 10, fontWeight: '700', color: THEME.dim, letterSpacing: 0.5 },
  textLive: { color: THEME.gn },
});
