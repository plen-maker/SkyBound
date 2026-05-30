import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, signOut } from "../../src/firebase";
import { useRouter } from "expo-router";
import { C } from "../../src/theme";

export default function SettingsScreen() {
  const user = auth.currentUser;

  return (
    <SafeAreaView style={{flex:1,backgroundColor:C.bg}}>
      <View style={s.root}>
        <Text style={s.title}>Settings</Text>

        <View style={s.card}>
          <Text style={s.label}>Bejelentkezett</Text>
          <Text style={{color:C.tx,fontSize:14,marginTop:4}}>{user?.email||"—"}</Text>
        </View>

        <View style={s.card}>
          <Text style={s.label}>Session kód</Text>
          <Text style={{color:C.cy,fontFamily:"Courier New",fontSize:14,marginTop:4}}>ddnemet-host</Text>
          <Text style={{color:C.dim,fontSize:11,marginTop:4,lineHeight:15}}>
            Ez köti össze a desktopot és a telefont. Ugyanez kell a bridge .env-be.
          </Text>
        </View>

        <View style={s.card}>
          <Text style={s.label}>App verzió</Text>
          <Text style={{color:C.tx,fontSize:14,marginTop:4}}>0.1.0 (preview APK)</Text>
        </View>

        <Pressable onPress={()=>signOut(auth)} style={s.logout}>
          <Text style={{color:C.rd,fontWeight:"600",fontSize:15}}>Kijelentkezés</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:   { flex:1,padding:16,gap:12 },
  title:  { fontSize:20,fontWeight:"700",color:C.tx },
  card:   { backgroundColor:C.panel,borderColor:C.line,borderWidth:1,borderRadius:14,padding:14 },
  label:  { fontSize:10,color:C.dim,letterSpacing:1,textTransform:"uppercase" },
  logout: { backgroundColor:C.panel,borderColor:"rgba(240,96,128,.3)",borderWidth:1,
            borderRadius:14,padding:14,alignItems:"center",marginTop:8 },
});
