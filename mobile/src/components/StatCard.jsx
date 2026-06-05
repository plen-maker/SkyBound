import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { THEME } from '../theme';

export function StatCard({ label, value, unit }) {
  const hasVal = value != null;
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, hasVal && styles.live]}>
        {hasVal ? String(value) : '—'}
        {hasVal && unit ? <Text style={styles.unit}> {unit}</Text> : null}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: THEME.p2, borderWidth: 1, borderColor: THEME.line, borderRadius: 10, padding: 10, flex: 1 },
  label: { fontSize: 9, color: THEME.dim, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 },
  value: { fontSize: 20, fontWeight: '700', color: THEME.dim, fontVariant: ['tabular-nums'] },
  live: { color: THEME.tx },
  unit: { fontSize: 9, color: THEME.dim },
});
