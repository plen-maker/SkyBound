import React from "react";
import { View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, signOut } from "../../src/firebase";
import { C } from "../../src/theme";

export default function SettingsScreen() {
  const user = auth.currentUser;
  return (
    <SafeAreaView style={{flex:1,backgroundColor:C.bg}}>
      <View style={{flex:1,padding:16,gap:12}}>
        <Text style={{fontSize:20,fontWeight:"700",color:C.tx}}>Settings</Text>
        <View style={{backgroundColor:C.panel,borderColor:C.line,borderWidth:1,borderRadius:14,padding:14}}>
          <Text style={{fontSize:10,color:C.dim,letterSpacing:1}}>BEJELENTKEZETT</Text>
          <Text style={{color:C.tx,fontSize:14,marginTop:4}}>{user?.email||"—"}</Text>
        </View>
        <View style={{backgroundColor:C.panel,borderColor:C.line,borderWidth:1,borderRadius:14,padding:14}}>
          <Text style={{fontSize:10,color:C.dim,letterSpacing:1}}>SESSION KÓD</Text>
          <Text style={{color:C.cy,fontFamily:"Courier New",fontSize:14,marginTop:4}}>ddnemet-host</Text>
          <Text style={{color:C.dim,fontSize:11,marginTop:4,lineHeight:15}}>
            Ez köti össze a desktopot és a telefont. Ugyanez kell a bridge .env-be.
          </Text>
        </View>
        <View style={{backgroundColor:C.panel,borderColor:C.line,borderWidth:1,borderRadius:14,padding:14}}>
          <Text style={{fontSize:10,color:C.dim,letterSpacing:1}}>VERZIÓ</Text>
          <Text style={{color:C.tx,fontSize:14,marginTop:4}}>0.1.0 · preview APK</Text>
        </View>
        <Pressable onPress={()=>signOut(auth)}
          style={{backgroundColor:C.panel,borderColor:"rgba(240,96,128,.3)",borderWidth:1,
            borderRadius:14,padding:14,alignItems:"center",marginTop:8}}>
          <Text style={{color:C.rd,fontWeight:"600",fontSize:15}}>Kijelentkezés</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
