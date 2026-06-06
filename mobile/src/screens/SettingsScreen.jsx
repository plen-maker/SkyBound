import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Switch, StyleSheet, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { signOut, getIdTokenResult } from 'firebase/auth';
import { ref, push } from 'firebase/database';
import { auth, db } from '../firebase';
import { Card } from '../components/Card';
import { THEME as C } from '../theme';

export default function SettingsScreen() {
  const [session, setSession] = useState('');
  const [sbUser, setSbUser] = useState('');
  const [notifications, setNotifications] = useState(true);
  const [speedUnit, setSpeedUnit] = useState('kt');
  const [altUnit, setAltUnit] = useState('ft');
  const [qnhUnit, setQnhUnit] = useState('hPa');
  const [isDev, setIsDev] = useState(false);
  const [pushTesting, setPushTesting] = useState(false);

  useEffect(() => {
    AsyncStorage.multiGet(['sessionCode','sbUser','notifications','speedUnit','altUnit','qnhUnit'])
      .then(pairs => {
        const m = Object.fromEntries(pairs);
        if (m.sessionCode) setSession(m.sessionCode);
        if (m.sbUser) setSbUser(m.sbUser);
        if (m.notifications !== null) setNotifications(m.notifications !== 'false');
        if (m.speedUnit) setSpeedUnit(m.speedUnit);
        if (m.altUnit) setAltUnit(m.altUnit);
        if (m.qnhUnit) setQnhUnit(m.qnhUnit);
      });

    // Check developer role from Firebase custom claims
    const user = auth.currentUser;
    if (user) {
      getIdTokenResult(user, true).then(result => {
        setIsDev(result.claims.role === 'developer');
      }).catch(() => {});
    }
  }, []);

  function save(key, value) { AsyncStorage.setItem(key, String(value)); }

  async function testPush() {
    if (!session) { Alert.alert('Hiba', 'Adj meg session kódot!'); return; }
    setPushTesting(true);
    try {
      await push(ref(db, `sessions/${session}/pushTest`), {
        title: 'Xdeck EFB Test',
        body: 'Push notification működik! 🎉',
        ts: Date.now(),
      });
      Alert.alert('✅ Teszt elküldve', 'A push értesítés el lett küldve.');
    } catch(e) {
      Alert.alert('Hiba', e.message);
    }
    setPushTesting(false);
  }

  function srow(label, desc, content) {
    return (
      <Card key={label} style={s.srow}>
        <View style={s.sleft}>
          <Text style={s.slabel}>{label}</Text>
          {!!desc && <Text style={s.sdesc}>{desc}</Text>}
        </View>
        {content}
      </Card>
    );
  }

  function pillRow(options, current, onSelect) {
    return (
      <View style={{ flexDirection:'row', gap:6 }}>
        {options.map(([v,l]) => (
          <TouchableOpacity key={v}
            style={[s.pill, current===v && s.pillOn]}
            onPress={() => onSelect(v)}>
            <Text style={[s.pillTx, current===v && s.pillTxOn]}>{l}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <Text style={s.title}>Settings</Text>

      {/* Session */}
      {srow('Session kód', 'Firebase sync — egyedi azonosítód',
        <TextInput style={s.input} value={session}
          onChangeText={v => { setSession(v); save('sessionCode', v); }}
          placeholder="pl. johndoe-host" placeholderTextColor={C.dim}
          autoCapitalize="none" />
      )}

      {/* SimBrief */}
      {srow('SimBrief usernév', 'OFP betöltéshez',
        <TextInput style={s.input} value={sbUser}
          onChangeText={v => { setSbUser(v); save('sbUser', v); }}
          placeholder="pl. ddnemet" placeholderTextColor={C.dim}
          autoCapitalize="none" />
      )}

      {/* Speed unit */}
      {srow('Sebesség egység', '',
        pillRow([['kt','kt'],['kmh','km/h']], speedUnit, v => { setSpeedUnit(v); save('speedUnit', v); })
      )}

      {/* Alt unit */}
      {srow('Magasság egység', '',
        pillRow([['ft','ft'],['m','m']], altUnit, v => { setAltUnit(v); save('altUnit', v); })
      )}

      {/* QNH unit */}
      {srow('QNH egység', '',
        pillRow([['hPa','hPa'],['inHg','inHg']], qnhUnit, v => { setQnhUnit(v); save('qnhUnit', v); })
      )}

      {/* Notifications */}
      {srow('Push értesítések', 'Bridge trigger hangjelzés',
        <Switch value={notifications}
          onValueChange={v => { setNotifications(v); save('notifications', v); }}
          trackColor={{ false: C.line, true: C.cy }}
          thumbColor={notifications ? C.bg : C.dim} />
      )}

      {/* Push test */}
      <TouchableOpacity style={s.testBtn} onPress={testPush} disabled={pushTesting}>
        <Text style={s.testBtnTx}>{pushTesting ? '⏳ Küldés...' : '🔔 Push teszt'}</Text>
      </TouchableOpacity>

      {/* Version */}
      <Card style={s.versionCard}>
        <Text style={s.versionText}>Xdeck EFB — Orion · v0.1.0</Text>
        <Text style={s.versionSub}>Electronic Flight Bag for MSFS 2020/2024</Text>
        {isDev && <Text style={[s.versionSub, { color: C.am, marginTop: 4 }]}>⚙ Developer</Text>}
      </Card>

      {/* Developer options — only for developers */}
      {isDev && (
        <Card style={[s.devCard]}>
          <Text style={s.devTitle}>⚙ Developer Options</Text>
          <Text style={s.devNote}>Csak fejlesztői fiókok látják ezt.</Text>
        </Card>
      )}

      <TouchableOpacity style={s.logoutBtn} onPress={() => signOut(auth)}>
        <Text style={s.logoutTx}>Kijelentkezés</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex:1, backgroundColor:C.bg },
  content: { padding:16, paddingBottom:32 },
  title: { fontSize:18, fontWeight:'800', color:C.tx, marginBottom:12 },
  srow: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', gap:12 },
  sleft: { flex:1 },
  slabel: { fontSize:13, color:C.tx, fontWeight:'500' },
  sdesc: { fontSize:10, color:C.dim, marginTop:2 },
  input: { backgroundColor:C.p2, borderWidth:1, borderColor:C.line, borderRadius:8,
    padding:8, color:C.tx, fontSize:13, minWidth:140 },
  pill: { paddingHorizontal:12, paddingVertical:5, borderRadius:99,
    borderWidth:1, borderColor:C.line, backgroundColor:C.p2 },
  pillOn: { backgroundColor:C.cy, borderColor:C.cy },
  pillTx: { fontSize:11, fontWeight:'600', color:C.dim },
  pillTxOn: { color:C.bg },
  testBtn: { backgroundColor:'rgba(94,200,255,0.1)', borderWidth:1,
    borderColor:'rgba(94,200,255,0.3)', borderRadius:12, padding:14,
    alignItems:'center', marginBottom:10 },
  testBtnTx: { color:C.cy, fontWeight:'700', fontSize:14 },
  versionCard: { alignItems:'center', borderColor:'rgba(94,200,255,0.15)' },
  versionText: { fontSize:13, fontWeight:'700', color:C.cy },
  versionSub: { fontSize:10, color:C.dim, marginTop:4 },
  devCard: { borderColor:'rgba(255,180,84,0.2)', backgroundColor:'rgba(255,180,84,0.03)' },
  devTitle: { fontSize:13, fontWeight:'700', color:C.am, marginBottom:6 },
  devNote: { fontSize:11, color:C.dim },
  logoutBtn: { backgroundColor:'rgba(240,96,128,0.1)', borderWidth:1,
    borderColor:'rgba(240,96,128,0.3)', borderRadius:12, padding:14,
    alignItems:'center', marginTop:8 },
  logoutTx: { color:C.rd, fontWeight:'700', fontSize:14 },
});
