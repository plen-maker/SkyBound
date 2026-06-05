import React from 'react';
import { View, StyleSheet } from 'react-native';
import { THEME } from '../theme';

export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: THEME.panel,
    borderWidth: 1,
    borderColor: THEME.line,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
});
