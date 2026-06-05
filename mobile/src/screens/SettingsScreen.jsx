import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Switch, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { Card } from '../components/Card';
import { THEME } from '../theme';

export default function SettingsScreen() {
  const [session, setSession] = useState('ddnemet-host');
  const [sbUser, setSbUser] = useState('ddnemet');
  const [notifications, setNotifications] = useState(true);

  useEffect(() => {
    AsyncStorage.multiGet(['sessionCode', 'sbUser', 'notifications']).then(pairs => {
      const m = Object.fromEntries(pairs);
      if (m.sessionCode) setSession(m.sessionCode);
      if (m.sbUser) setSbUser(m.sbUser);
      if (m.notifications !== null) setNotifications(m.notifications !== 'false');
    });
  }, []);

  function save(key, value) {
    AsyncStorage.setItem(key, String(value));
  }

  function srow(label, desc, content) {
    return (
      <Card key={label} style={styles.srow}>
        <View style={styles.sleft}>
          <Text style={styles.slabel}>{label}</Text>
          {!!desc && <Text style={styles.sdesc}>{desc}</Text>}
        </View>
        {content}
      </Card>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Settings</Text>

      {srow('Session kód', 'Firebase sync azonosító',
        <TextInput style={styles.input} value={session} onChangeText={v => { setSession(v); save('sessionCode', v); }}
          placeholder="ddnemet-host" placeholderTextColor={THEME.dim} autoCapitalize="none" />
      )}

      {srow('SimBrief usernév', 'OFP betöltéshez',
        <TextInput style={styles.input} value={sbUser} onChangeText={v => { setSbUser(v); save('sbUser', v); }}
          placeholder="pl. ddnemet" placeholderTextColor={THEME.dim} autoCapitalize="none" />
      )}

      {srow('Push értesítések', 'Bridge trigger hangjelzés',
        <Switch value={notifications} onValueChange={v => { setNotifications(v); save('notifications', v); }}
          trackColor={{ false: THEME.line, true: THEME.cy }}
          thumbColor={notifications ? THEME.bg : THEME.dim} />
      )}

      <Card style={styles.versionCard}>
        <Text style={styles.versionText}>Xdeck EFB — Orion · v0.1.0</Text>
        <Text style={styles.versionSub}>Electronic Flight Bag for MSFS 2020/2024</Text>
      </Card>

      <TouchableOpacity style={styles.logoutBtn} onPress={() => signOut(auth)}>
        <Text style={styles.logoutText}>Kijelentkezés</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: THEME.bg },
  content: { padding: 16, paddingBottom: 32 },
  title: { fontSize: 18, fontWeight: '800', color: THEME.tx, marginBottom: 12 },
  srow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  sleft: { flex: 1 },
  slabel: { fontSize: 13, color: THEME.tx, fontWeight: '500' },
  sdesc: { fontSize: 10, color: THEME.dim, marginTop: 2 },
  input: { backgroundColor: THEME.p2, borderWidth: 1, borderColor: THEME.line, borderRadius: 8, padding: 8, color: THEME.tx, fontSize: 13, minWidth: 140 },
  versionCard: { alignItems: 'center', borderColor: 'rgba(94,200,255,0.15)' },
  versionText: { fontSize: 13, fontWeight: '700', color: THEME.cy },
  versionSub: { fontSize: 10, color: THEME.dim, marginTop: 4 },
  logoutBtn: { backgroundColor: 'rgba(240,96,128,0.1)', borderWidth: 1, borderColor: 'rgba(240,96,128,0.3)', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 8 },
  logoutText: { color: THEME.rd, fontWeight: '700', fontSize: 14 },
});
