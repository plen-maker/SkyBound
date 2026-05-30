import React, { useState } from "react";
import { View, Text, Pressable, FlatList, TextInput, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTriggers } from "../../src/useLive";
import { C } from "../../src/theme";

const KINDS = [["fix","Fix"],["tod","T/D"],["dest","Landing"]];

export default function AlertsScreen() {
  const { triggers, add, del, toggle } = useTriggers();
  const [kind, setKind]   = useState("fix");
  const [fix,  setFix]    = useState("VETIK");
  const [lead, setLead]   = useState("5");

  const doAdd = () => {
    if (kind === "fix" && !fix.trim()) return;
    add({ kind, lead: Number(lead)||5, ...(kind==="fix" ? {fix:fix.toUpperCase()} : {}) });
  };

  return (
    <SafeAreaView style={{ flex:1, backgroundColor:C.bg }}>
      <View style={s.root}>
        <Text style={s.title}>Push Triggers</Text>

        {/* Kind selector */}
        <View style={s.row}>
          {KINDS.map(([k,l]) => (
            <Pressable key={k} onPress={()=>setKind(k)}
              style={[s.chip, kind===k && s.chipOn]}>
              <Text style={[s.chipTx, kind===k && s.chipTxOn]}>{l}</Text>
            </Pressable>
          ))}
        </View>

        {/* Input row */}
        <View style={s.row}>
          {kind==="fix" && (
            <TextInput value={fix} onChangeText={setFix} placeholder="Fix pl. VETIK"
              placeholderTextColor={C.dim} autoCapitalize="characters"
              style={[s.inp, {flex:1}]}/>
          )}
          <TextInput value={lead} onChangeText={setLead} placeholder="min"
            placeholderTextColor={C.dim} keyboardType="number-pad"
            style={[s.inp, {width:70}]}/>
          <Pressable onPress={doAdd} style={s.armBtn}>
            <Text style={s.armTx}>Arm</Text>
          </Pressable>
        </View>

        {/* List */}
        <FlatList
          data={triggers}
          keyExtractor={t=>t.id}
          contentContainerStyle={{ gap:8, paddingTop:8 }}
          ListEmptyComponent={<Text style={{ color:C.dim, textAlign:"center", paddingTop:24 }}>Nincs trigger.</Text>}
          renderItem={({item:t}) => (
            <View style={[s.trigger, t.fired && {borderColor:C.gn}]}>
              <Pressable onPress={()=>toggle(t.id, !t.armed)}
                style={[s.dot2, {backgroundColor:t.armed?C.cy:C.p2}]}/>
              <View style={{flex:1}}>
                <Text style={{color:C.tx,fontWeight:"600",fontFamily:"Courier New",fontSize:14}}>
                  {t.kind==="fix"?t.fix:t.kind.toUpperCase()}
                  <Text style={{color:C.dim}}> − {t.lead} min</Text>
                </Text>
                <Text style={{color:t.armed?(t.fired?C.gn:C.cy):C.dim,fontSize:11,marginTop:2}}>
                  {t.armed ? (t.fired ? "✓ fired" : "armed") : "off"}
                </Text>
              </View>
              <Pressable onPress={()=>del(t.id)} style={s.delBtn}>
                <Text style={{color:C.rd,fontSize:13,fontWeight:"600"}}>Del</Text>
              </Pressable>
            </View>
          )}
        />
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:    { flex:1, padding:16, gap:12 },
  title:   { fontSize:20, fontWeight:"700", color:C.tx },
  row:     { flexDirection:"row", gap:8, alignItems:"flex-end" },
  chip:    { paddingHorizontal:14, paddingVertical:7, borderRadius:99, backgroundColor:C.p2, borderColor:C.line, borderWidth:1 },
  chipOn:  { backgroundColor:C.cy },
  chipTx:  { color:C.dim, fontWeight:"600", fontSize:13 },
  chipTxOn:{ color:"#070b12" },
  inp:     { backgroundColor:C.p2, borderColor:C.line, borderWidth:1, borderRadius:10,
             color:C.tx, padding:10, fontSize:14, fontFamily:"Courier New" },
  armBtn:  { backgroundColor:C.cy, borderRadius:10, paddingHorizontal:16, paddingVertical:10 },
  armTx:   { color:"#070b12", fontWeight:"700", fontSize:14 },
  trigger: { flexDirection:"row", alignItems:"center", gap:12, backgroundColor:C.panel,
             borderColor:C.line, borderWidth:1, borderRadius:14, padding:12 },
  dot2:    { width:24, height:24, borderRadius:6, borderColor:C.line, borderWidth:1 },
  delBtn:  { paddingHorizontal:10, paddingVertical:6, borderRadius:8, backgroundColor:C.p2, borderColor:C.line, borderWidth:1 },
});
