import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { C } from "../../src/theme";

const FAC = { 0:"OBS",1:"FSS",2:"DEL",3:"GND",4:"TWR",5:"APP",6:"CTR" };
const FAC_C = { DEL:"#a78bfa",GND:C.gn,TWR:C.cy,APP:C.am,CTR:C.rd,FSS:"#94a3b8",OBS:C.dim };

export default function VatsimScreen() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [icao,    setIcao]    = useState("");
  const [opened,  setOpened]  = useState({});

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch("https://data.vatsim.net/v3/vatsim-data.json");
      setData(await r.json());
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); const t=setInterval(load,60000); return()=>clearInterval(t); }, []);

  const atisMap = {};
  (data?.atis||[]).forEach(a => { atisMap[a.callsign] = a; });

  const ctrls = (data?.controllers||[])
    .filter(c => c.facility > 0 && (!icao || c.callsign.startsWith(icao.toUpperCase())))
    .slice(0, 50);

  return (
    <SafeAreaView style={{flex:1,backgroundColor:C.bg}}>
      <ScrollView contentContainerStyle={s.container}>
        <View style={s.header}>
          <Text style={s.title}>VATSIM ATC</Text>
          <Pressable onPress={load} style={s.refBtn}>
            <Text style={{color:C.cy,fontSize:12}}>↻ Frissít</Text>
          </Pressable>
        </View>

        <View style={s.searchRow}>
          <Text style={s.searchLabel}>ICAO szűrő:</Text>
          <View style={s.inp}>
            <Text style={{color:C.dim,fontSize:13}} onPress={()=>{}}
              suppressHighlighting>{icao||"pl. LHBP"}</Text>
          </View>
        </View>

        {loading && !data && <ActivityIndicator color={C.cy} style={{paddingTop:30}}/>}

        {ctrls.map(c => {
          const fac = FAC[c.facility]||"CTR";
          const fc  = FAC_C[fac]||C.dim;
          const atis = atisMap[c.callsign];
          const open = opened[c.callsign];
          return (
            <Pressable key={c.callsign}
              style={[s.row, open && {borderColor:fc+"60"}]}
              onPress={()=>atis&&setOpened(p=>({...p,[c.callsign]:!p[c.callsign]}))}>
              <View style={[s.badge,{backgroundColor:fc+"18",borderColor:fc+"40"}]}>
                <Text style={[s.badgeTx,{color:fc}]}>{fac}</Text>
              </View>
              <View style={{flex:1}}>
                <Text style={{color:C.tx,fontWeight:"600",fontFamily:"Courier New",fontSize:14}}>
                  {c.callsign}
                  {atis&&<Text style={{color:C.cy,fontSize:11}}> ATIS {atis.atis_code}</Text>}
                </Text>
                <Text style={{color:C.dim,fontSize:11,marginTop:1}}>{c.name}</Text>
                {open&&atis&&(
                  <Text style={{color:C.dim,fontSize:11,marginTop:6,fontFamily:"Courier New",lineHeight:16}}>
                    {atis.text_atis?.join(" ")}
                  </Text>
                )}
              </View>
              <Text style={[s.freq,{color:C.am}]}>{c.frequency}</Text>
            </Pressable>
          );
        })}

        {!loading && ctrls.length===0 && (
          <Text style={{color:C.dim,textAlign:"center",paddingTop:30}}>Nincs online ATC.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { padding:14,gap:8 },
  header:    { flexDirection:"row",alignItems:"center",justifyContent:"space-between" },
  title:     { fontSize:20,fontWeight:"700",color:C.tx },
  refBtn:    { padding:8,backgroundColor:C.p2,borderRadius:8,borderColor:C.line,borderWidth:1 },
  searchRow: { flexDirection:"row",alignItems:"center",gap:10 },
  searchLabel:{ color:C.dim,fontSize:12 },
  inp:       { flex:1,backgroundColor:C.p2,borderColor:C.line,borderWidth:1,borderRadius:8,padding:8 },
  row:       { flexDirection:"row",alignItems:"flex-start",gap:10,backgroundColor:C.panel,
               borderColor:C.line,borderWidth:1,borderRadius:14,padding:12 },
  badge:     { borderRadius:6,paddingHorizontal:7,paddingVertical:3,borderWidth:1,flexShrink:0,marginTop:1 },
  badgeTx:   { fontSize:10,fontWeight:"700" },
  freq:      { fontFamily:"Courier New",fontSize:13,flexShrink:0,marginTop:1 },
});
