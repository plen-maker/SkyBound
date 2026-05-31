import React, { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import {
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
} from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { C } from "../theme";

const auth = getAuth();

export default function LoginScreen() {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [mode,     setMode]     = useState("login");
  const [loading,  setLoading]  = useState(false);
  const [err,      setErr]      = useState("");

  // Pre-fill saved email
  React.useEffect(() => {
    AsyncStorage.getItem("sb_email").then(v => { if (v) setEmail(v); });
  }, []);

  const submit = async () => {
    if (!email || !password) { setErr("Töltsd ki mindkét mezőt."); return; }
    setLoading(true); setErr("");
    try {
      if (mode === "login") {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      await AsyncStorage.setItem("sb_email", email);
    } catch(e) {
      const msg = {
        "auth/invalid-email":        "Érvénytelen email.",
        "auth/user-not-found":       "Nincs ilyen fiók.",
        "auth/wrong-password":       "Hibás jelszó.",
        "auth/email-already-in-use": "Ez az email már használatban van.",
        "auth/weak-password":        "A jelszó túl gyenge (min. 6 karakter).",
        "auth/invalid-credential":   "Hibás email vagy jelszó.",
      }[e.code] || e.message;
      setErr(msg);
    }
    setLoading(false);
  };

  return (
    <View style={s.root}>
      {/* Logo */}
      <View style={s.logo}>
        <Text style={{ fontSize:28 }}>✈</Text>
      </View>
      <Text style={s.title}>SKYBOUND <Text style={{ color:C.cy }}>EFB</Text></Text>
      <Text style={s.sub}>Electronic Flight Bag · MSFS</Text>

      {/* Mode tabs */}
      <View style={{ flexDirection:"row", gap:8, marginBottom:4 }}>
        {[["login","Belépés"],["register","Regisztráció"]].map(([m,l])=>(
          <Pressable key={m} onPress={()=>{ setMode(m); setErr(""); }}
            style={[s.tab, mode===m && s.tabOn]}>
            <Text style={[s.tabTx, mode===m && s.tabTxOn]}>{l}</Text>
          </Pressable>
        ))}
      </View>

      {/* Inputs */}
      <View style={{ width:"100%", gap:10 }}>
        <TextInput
          value={email} onChangeText={setEmail}
          placeholder="Email" placeholderTextColor={C.dim}
          keyboardType="email-address" autoCapitalize="none"
          style={s.inp}/>
        <TextInput
          value={password} onChangeText={setPassword}
          placeholder="Jelszó" placeholderTextColor={C.dim}
          secureTextEntry onSubmitEditing={submit}
          style={s.inp}/>
      </View>

      {!!err && <Text style={s.err}>{err}</Text>}

      <Pressable onPress={submit} disabled={loading}
        style={[s.btn, loading && { opacity:.7 }]}>
        {loading
          ? <ActivityIndicator color="#070b12" size="small"/>
          : <Text style={s.btnTx}>{mode==="login"?"Belépés":"Fiók létrehozása"}</Text>}
      </Pressable>

      <Text style={s.note}>
        Ugyanaz a fiók köti össze a desktopot, a telefont és a sim bridge-et.
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  root:  { flex:1, backgroundColor:C.bg, alignItems:"center", justifyContent:"center",
           padding:32, gap:12 },
  logo:  { width:72, height:72, borderRadius:20, backgroundColor:C.p2,
           alignItems:"center", justifyContent:"center", marginBottom:4 },
  title: { fontSize:26, fontWeight:"800", color:C.tx, letterSpacing:.5 },
  sub:   { fontSize:13, color:C.dim, marginBottom:4 },
  tab:   { paddingHorizontal:16, paddingVertical:7, borderRadius:99,
           backgroundColor:C.p2, borderColor:C.line, borderWidth:1 },
  tabOn: { backgroundColor:C.cy },
  tabTx: { color:C.dim, fontWeight:"600", fontSize:13 },
  tabTxOn:{ color:"#070b12" },
  inp:   { width:"100%", backgroundColor:C.p2, borderColor:C.line, borderWidth:1,
           borderRadius:10, color:C.tx, padding:12, fontSize:14 },
  err:   { color:C.rd, fontSize:12, textAlign:"center" },
  btn:   { width:"100%", backgroundColor:C.cy, borderRadius:12,
           padding:14, alignItems:"center", marginTop:4 },
  btnTx: { color:"#070b12", fontWeight:"700", fontSize:15 },
  note:  { fontSize:11, color:C.dim, textAlign:"center", maxWidth:260,
           lineHeight:16, marginTop:4 },
});
