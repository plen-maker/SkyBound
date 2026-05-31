import React, { useState } from "react";
import { View, Text, Pressable, ActivityIndicator, StyleSheet, Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import { auth, signInWithCredential, GoogleAuthProvider } from "../firebase";
import Constants from "expo-constants";
import { C } from "../theme";

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState("");

  const g = Constants.expoConfig.extra.googleAuth || {};
  const [, response, promptAsync] = Google.useIdTokenAuthRequest({
    iosClientId:     g.iosClientId,
    androidClientId: g.androidClientId,
    webClientId:     g.webClientId,
  });

  React.useEffect(() => {
    if (response?.type === "success") {
      setLoading(true);
      const cred = GoogleAuthProvider.credential(response.params.id_token);
      signInWithCredential(auth, cred)
        .catch(e => { setErr(e.message); setLoading(false); });
    } else if (response?.type === "error") {
      setErr(response.error?.message || "Hiba");
      setLoading(false);
    }
  }, [response]);

  const onLogin = async () => {
    setLoading(true); setErr("");
    try { await promptAsync(); }
    catch(e) { setErr(e.message); setLoading(false); }
  };

  return (
    <View style={s.root}>
      <View style={s.icon}>
        <Text style={{ fontSize: 28 }}>✈</Text>
      </View>
      <Text style={s.title}>SKYBOUND <Text style={{ color: C.cy }}>EFB</Text></Text>
      <Text style={s.sub}>Electronic Flight Bag · MSFS</Text>

      <Pressable onPress={onLogin} disabled={loading} style={[s.btn, loading && { opacity: 0.7 }]}>
        {loading
          ? <ActivityIndicator color="#1a1a1a" size="small"/>
          : <Text style={s.btnTx}>Belépés Google-lel</Text>}
      </Pressable>

      {!!err && <Text style={s.err}>{err}</Text>}

      <Text style={s.note}>
        A Google-fiókod összeköti a desktopot, a telefont és a sim bridge-et.
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  root:  { flex:1, backgroundColor:C.bg, alignItems:"center", justifyContent:"center", padding:32, gap:12 },
  icon:  { width:72, height:72, borderRadius:20, backgroundColor:"#1a2a3d",
           alignItems:"center", justifyContent:"center", marginBottom:8 },
  title: { fontSize:26, fontWeight:"800", color:C.tx, letterSpacing:1 },
  sub:   { fontSize:13, color:C.dim, marginBottom:8 },
  btn:   { flexDirection:"row", alignItems:"center", gap:10, backgroundColor:"#fff",
           borderRadius:14, paddingHorizontal:24, paddingVertical:14,
           shadowColor:"#000", shadowOffset:{width:0,height:4}, shadowOpacity:.25, shadowRadius:8 },
  btnTx: { fontSize:15, fontWeight:"700", color:"#1a1a1a" },
  err:   { color:C.rd, fontSize:12, textAlign:"center", maxWidth:280 },
  note:  { fontSize:11, color:C.dim, textAlign:"center", maxWidth:260, lineHeight:16, marginTop:8 },
});
