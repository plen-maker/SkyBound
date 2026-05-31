import React, { useState, useEffect } from "react";
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import { auth, signInWithCredential, GoogleAuthProvider } from "../firebase";
import Constants from "expo-constants";
import { C } from "../theme";

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const [err,     setErr]     = useState("");

  const g = Constants.expoConfig?.extra?.googleAuth || {};
  const [, response, promptAsync] = Google.useIdTokenAuthRequest({
    androidClientId: g.androidClientId,
    webClientId:     g.webClientId,
  });

  useEffect(() => {
    if (response?.type === "success") {
      setLoading(true);
      signInWithCredential(auth, GoogleAuthProvider.credential(response.params.id_token))
        .catch(e => { setErr(e.message); setLoading(false); });
    } else if (response?.type === "error") {
      setErr(response.error?.message || "Hiba");
      setLoading(false);
    }
  }, [response]);

  return (
    <View style={s.root}>
      <View style={s.icon}><Text style={{ fontSize:28 }}>✈</Text></View>
      <Text style={s.title}>SKYBOUND <Text style={{ color:C.cy }}>EFB</Text></Text>
      <Text style={s.sub}>Electronic Flight Bag · MSFS</Text>
      <Pressable onPress={() => { setLoading(true); setErr(""); promptAsync(); }}
        disabled={loading} style={[s.btn, loading && { opacity:.7 }]}>
        {loading
          ? <ActivityIndicator color="#1a1a1a" size="small"/>
          : <Text style={s.btnTx}>Belépés Google-lel</Text>}
      </Pressable>
      {!!err && <Text style={s.err}>{err}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  root:  { flex:1, backgroundColor:C.bg, alignItems:"center", justifyContent:"center", padding:32, gap:14 },
  icon:  { width:72, height:72, borderRadius:20, backgroundColor:C.p2, alignItems:"center", justifyContent:"center" },
  title: { fontSize:26, fontWeight:"800", color:C.tx, letterSpacing:1 },
  sub:   { fontSize:13, color:C.dim },
  btn:   { backgroundColor:"#fff", borderRadius:14, paddingHorizontal:28, paddingVertical:14, marginTop:8 },
  btnTx: { fontSize:15, fontWeight:"700", color:"#1a1a1a" },
  err:   { color:C.rd, fontSize:12, textAlign:"center", maxWidth:280 },
});
