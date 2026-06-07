import React, { useRef, useState, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, ActivityIndicator, BackHandler } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { THEME as C } from '../theme';

export default function EFBScreen({ route }) {
  const { desktopUrl } = route.params || {};
  const webRef = useRef(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Android back button → WebView back
  useFocusEffect(useCallback(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack && webRef.current) { webRef.current.goBack(); return true; }
      return false;
    });
    return () => sub.remove();
  }, [canGoBack]));

  const url = desktopUrl || 'http://192.168.1.1:47821';

  return (
    <View style={s.container}>
      {/* Slim top bar */}
      <View style={s.bar}>
        <TouchableOpacity style={s.barBtn}
          onPress={() => canGoBack && webRef.current?.goBack()}
          disabled={!canGoBack}>
          <Ionicons name="chevron-back" size={18} color={canGoBack ? C.tx : C.dim} />
        </TouchableOpacity>
        <Text style={s.barUrl} numberOfLines={1}>{url}</Text>
        <TouchableOpacity style={s.barBtn} onPress={() => webRef.current?.reload()}>
          <Ionicons name="refresh" size={16} color={C.cy} />
        </TouchableOpacity>
      </View>

      {loading && !error && (
        <View style={s.loadOverlay}>
          <ActivityIndicator color={C.cy} size="large" />
          <Text style={s.loadTx}>Csatlakozás a desktophoz…</Text>
        </View>
      )}

      {error && (
        <View style={s.errBox}>
          <Text style={s.errIcon}>⚠</Text>
          <Text style={s.errTitle}>Nem sikerült csatlakozni</Text>
          <Text style={s.errSub}>Ellenőrizd hogy a desktop app fut és ugyanazon a WiFi-n vagy.</Text>
          <Text style={s.errUrl}>{url}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => { setError(false); setLoading(true); webRef.current?.reload(); }}>
            <Text style={s.retryTx}>Újrapróbál</Text>
          </TouchableOpacity>
        </View>
      )}

      <WebView
        ref={webRef}
        source={{ uri: url }}
        style={[s.web, error && { opacity: 0 }]}
        onNavigationStateChange={state => setCanGoBack(state.canGoBack)}
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
        userAgent="XdeckEFB-Mobile/4.0 Android"
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#08090e' },
  bar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#0a0c18', borderBottomWidth: 1, borderBottomColor: '#1a2040',
    paddingHorizontal: 4, height: 40,
  },
  barBtn: { padding: 8 },
  barUrl: { flex: 1, fontSize: 11, color: '#4a5880', fontFamily: 'monospace', textAlign: 'center' },
  web: { flex: 1 },
  loadOverlay: {
    ...StyleSheet.absoluteFillObject, zIndex: 10,
    backgroundColor: '#08090e', alignItems: 'center', justifyContent: 'center', gap: 14,
  },
  loadTx: { color: '#4a5880', fontSize: 13 },
  errBox: {
    ...StyleSheet.absoluteFillObject, zIndex: 10,
    backgroundColor: '#08090e', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32, gap: 10,
  },
  errIcon: { fontSize: 40, marginBottom: 4 },
  errTitle: { fontSize: 16, fontWeight: '700', color: '#e8eeff' },
  errSub: { fontSize: 13, color: '#4a5880', textAlign: 'center', lineHeight: 20 },
  errUrl: { fontSize: 11, color: '#4df0ff', fontFamily: 'monospace', marginTop: 4 },
  retryBtn: {
    marginTop: 12, paddingHorizontal: 28, paddingVertical: 12,
    backgroundColor: 'rgba(77,240,255,0.1)', borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(77,240,255,0.3)',
  },
  retryTx: { color: '#4df0ff', fontWeight: '700', fontSize: 14 },
});
