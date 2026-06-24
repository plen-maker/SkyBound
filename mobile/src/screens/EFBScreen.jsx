import React, { useRef, useState, useCallback } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, BackHandler } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { THEME as C } from '../theme';
import { useDesktopUrl, notifyDesktop } from '../useLive';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PORT = '47821';

function NoUrlScreen() {
  const [ip, setIp]       = useState('');
  const [testing, setTesting] = useState(false);
  const [err, setErr]     = useState('');

  async function connect() {
    const trimmed = ip.trim().replace(/^https?:\/\//, '').replace(/:\d+$/, '');
    if (!trimmed) { setErr('Add meg a desktop IP-jét!'); return; }
    const url = `http://${trimmed}:${PORT}`;
    setTesting(true); setErr('');
    try {
      await Promise.race([
        fetch(`${url}/api/version`),
        new Promise((_, r) => setTimeout(() => r(new Error('Timeout')), 6000)),
      ]);
      await AsyncStorage.setItem('desktopUrl', url);
      notifyDesktop(url);
    } catch(e) {
      setErr(`Nem sikerült csatlakozni:\n${e.message}`);
    }
    setTesting(false);
  }

  return (
    <View style={s.center}>
      <Text style={s.icon}>🖥</Text>
      <Text style={s.title}>Desktop csatlakozás</Text>
      <Text style={s.sub}>Add meg a gép IP-jét (CMD → ipconfig → IPv4)</Text>
      <View style={s.row}>
        <TextInput
          style={s.input}
          value={ip}
          onChangeText={v => { setIp(v); setErr(''); }}
          placeholder="192.168.1.100"
          placeholderTextColor={C.dim}
          keyboardType="numeric"
          autoCapitalize="none"
          autoCorrect={false}
          onSubmitEditing={connect}
        />
        <Text style={s.port}>:{PORT}</Text>
      </View>
      {!!err && <Text style={s.err}>{err}</Text>}
      <Pressable style={s.btn} onPress={connect} disabled={testing}>
        {testing
          ? <ActivityIndicator color="#08090e" size="small"/>
          : <Text style={s.btnTx}>Csatlakozás</Text>
        }
      </Pressable>
      <Text style={s.hint}>
        Az EFB többi funkciója (Home, OFP, VATSIM) internet kapcsolattal PC nélkül is működik.
      </Text>
    </View>
  );
}

export default function EFBScreen() {
  const [desktopUrl] = useDesktopUrl();
  const webRef   = useRef(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(false);

  useFocusEffect(useCallback(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack && webRef.current) { webRef.current.goBack(); return true; }
      return false;
    });
    return () => sub.remove();
  }, [canGoBack]));

  if (!desktopUrl) return <NoUrlScreen/>;

  return (
    <View style={s.container}>
      <View style={s.bar}>
        <Pressable style={s.barBtn} onPress={() => canGoBack && webRef.current?.goBack()} disabled={!canGoBack}>
          <Ionicons name="chevron-back" size={18} color={canGoBack ? C.tx : C.dim}/>
        </Pressable>
        <Text style={s.barUrl} numberOfLines={1}>{desktopUrl}</Text>
        <Pressable style={s.barBtn} onPress={() => webRef.current?.reload()}>
          <Ionicons name="refresh" size={16} color={C.cy}/>
        </Pressable>
      </View>

      {loading && !error && (
        <View style={s.overlay}>
          <ActivityIndicator color={C.cy} size="large"/>
          <Text style={s.loadTx}>Csatlakozás…</Text>
        </View>
      )}

      {error && (
        <View style={s.overlay}>
          <Text style={s.errIcon}>⚠</Text>
          <Text style={s.errTitle}>Nem sikerült csatlakozni</Text>
          <Text style={s.errSub}>Ellenőrizd hogy a desktop app fut és ugyanazon a WiFi-n vagy.</Text>
          <Text style={s.errUrl}>{desktopUrl}</Text>
          <Pressable style={s.retryBtn}
            onPress={() => { setError(false); setLoading(true); webRef.current?.reload(); }}>
            <Text style={s.retryTx}>Újrapróbál</Text>
          </Pressable>
          <Pressable style={[s.retryBtn, { marginTop: 8, borderColor: 'rgba(90,112,144,.3)' }]}
            onPress={() => { AsyncStorage.removeItem('desktopUrl'); notifyDesktop(null); }}>
            <Text style={[s.retryTx, { color: C.dim }]}>IP módosítása</Text>
          </Pressable>
        </View>
      )}

      <WebView
        ref={webRef}
        source={{ uri: desktopUrl }}
        style={[s.web, error && { opacity: 0 }]}
        onNavigationStateChange={st => setCanGoBack(st.canGoBack)}
        onLoadStart={() => { setLoading(true); setError(false); }}
        onLoadEnd={() => setLoading(false)}
        onError={() => { setLoading(false); setError(true); }}
        onHttpError={e => { if (e.nativeEvent.statusCode >= 500) { setLoading(false); setError(true); } }}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        mixedContentMode="always"
        cacheEnabled={false}
        userAgent="XdeckEFB-Mobile/5.0 Android"
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  center: {
    flex: 1, backgroundColor: C.bg,
    alignItems: 'center', justifyContent: 'center', padding: 28,
  },
  icon:  { fontSize: 48, marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '800', color: C.tx, marginBottom: 6 },
  sub:   { fontSize: 13, color: C.dim, textAlign: 'center', lineHeight: 18, marginBottom: 20 },
  row:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10, width: '100%' },
  input: {
    flex: 1, backgroundColor: C.p2, borderWidth: 1, borderColor: C.line,
    borderRadius: 10, padding: 12, color: C.tx, fontSize: 16,
    fontFamily: 'monospace', letterSpacing: 1,
  },
  port:  { fontSize: 14, color: C.dim, fontFamily: 'monospace' },
  err:   { fontSize: 12, color: C.rd, lineHeight: 17, marginBottom: 10, textAlign: 'center' },
  btn:   { backgroundColor: C.cy, borderRadius: 10, paddingHorizontal: 32, paddingVertical: 13, marginBottom: 16 },
  btnTx: { color: '#08090e', fontWeight: '800', fontSize: 15 },
  hint:  { fontSize: 11, color: C.dim, textAlign: 'center', lineHeight: 16, maxWidth: 280 },
  bar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.panel, borderBottomWidth: 1, borderBottomColor: C.line,
    paddingHorizontal: 4, height: 40,
  },
  barBtn: { padding: 8 },
  barUrl: { flex: 1, fontSize: 11, color: C.dim, fontFamily: 'monospace', textAlign: 'center' },
  web: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject, zIndex: 10,
    backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', gap: 12,
  },
  loadTx:   { color: C.dim, fontSize: 13 },
  errIcon:  { fontSize: 40 },
  errTitle: { fontSize: 16, fontWeight: '700', color: C.tx },
  errSub:   { fontSize: 13, color: C.dim, textAlign: 'center', lineHeight: 20, maxWidth: 280 },
  errUrl:   { fontSize: 11, color: C.cy, fontFamily: 'monospace' },
  retryBtn: {
    paddingHorizontal: 28, paddingVertical: 12,
    backgroundColor: 'rgba(77,240,255,0.1)', borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(77,240,255,0.3)',
  },
  retryTx: { color: C.cy, fontWeight: '700', fontSize: 14 },
});
