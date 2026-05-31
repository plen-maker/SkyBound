import React from "react";
import { View, Text, ScrollView, Pressable, Linking, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLive } from "../../src/useLive";
import { C } from "../../src/theme";

const SC = [
  { label:"Navigraph", url:"https://charts.navigraph.com",  color:"#7c8cff" },
  { label:"VATSIM",    url:"https://radar.vatsim.net",      color:C.gn },
  { label:"SimBrief",  url:"https://dispatch.simbrief.com", color:C.am },
  { label:"Spotify",   url:"https://open.spotify.com",      color:"#1db954" },
  { label:"YT Music",  url:"https://music.youtube.com",     color:C.rd },
  { label:"Discord",   url:"https://discord.com/app",       color:"#7c8cff" },
  { label:"Skybound",  url:"https://skybound.cx",           color:C.cy },
];

export default function HomeScreen() {
  const { live, connected } = useLive();
  const stats = [
    ["ETE",  live ? `${Math.floor(live.destEteMin/60)}:${String(Math.round(live.destEteMin)%60).padStart(2,"0")}` : null, "", C.cy],
    ["GS",   live ? Math.round(live.gsKt)  : null, "kt",  null],
    ["ALT",  live ? Math.round(live.altFt)?.toLocaleString() : null, "ft", null],
    ["V/S",  live ? Math.round(live.vsFpm) : null, "fpm", live?.vsFpm < -200 ? C.am : null],
  ];
  return (
    <SafeAreaView style={{ flex:1, backgroundColor:C.bg }}>
      <ScrollView contentContainerStyle={{ padding:14, gap:12 }}>
        <View style={{ flexDirection:"row", alignItems:"center", justifyContent:"space-between" }}>
          <Text style={{ fontSize:17, fontWeight:"800", color:C.tx, letterSpacing:.5 }}>
            SKYBOUND <Text style={{ color:C.cy }}>EFB</Text>
          </Text>
          <View style={{ flexDirection:"row", alignItems:"center", gap:5,
            backgroundColor:connected&&live?"rgba(82,227,176,.1)":"rgba(90,112,144,.08)",
            borderRadius:99, paddingHorizontal:10, paddingVertical:4 }}>
            <View style={{ width:6, height:6, borderRadius:3,
              backgroundColor:connected&&live?C.gn:C.dim }}/>
            <Text style={{ fontSize:10, fontWeight:"600",
              color:connected&&live?C.gn:C.dim }}>
              {connected&&live?"SIM LIVE":"NO BRIDGE"}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection:"row", gap:8 }}>
          {stats.map(([l,v,u,a]) => (
            <View key={l} style={{ flex:1, backgroundColor:C.p2, borderColor:C.line,
              borderWidth:1, borderRadius:12, padding:10 }}>
              <Text style={{ fontSize:9, color:C.dim, letterSpacing:1 }}>{l}</Text>
              <Text style={{ fontSize:20, color:v==null?C.dim:(a||C.tx),
                fontFamily:"Courier New", marginTop:2, fontWeight:"600" }}>
                {v??"—"}{v!=null&&u?<Text style={{ fontSize:9, color:C.dim }}> {u}</Text>:null}
              </Text>
            </View>
          ))}
        </View>

        {!live && (
          <View style={{ backgroundColor:"rgba(255,180,84,.06)", borderColor:"rgba(255,180,84,.18)",
            borderWidth:1, borderRadius:12, padding:12 }}>
            <Text style={{ color:C.am, fontSize:12, lineHeight:18 }}>
              Sim bridge nincs csatlakoztatva — az élő adatok akkor jelennek meg, ha fut a bridge a MSFS-es gépen.
            </Text>
          </View>
        )}

        <Text style={{ fontSize:10, color:C.dim, letterSpacing:1.5, fontWeight:"700" }}>SHORTCUTS</Text>
        <View style={{ flexDirection:"row", flexWrap:"wrap", gap:8 }}>
          {SC.map(sc => (
            <Pressable key={sc.label} onPress={() => Linking.openURL(sc.url)}
              style={{ width:"23%", backgroundColor:C.panel, borderColor:C.line,
                borderWidth:1, borderRadius:12, padding:10 }}>
              <Text style={{ color:sc.color, fontSize:18, marginBottom:4 }}>●</Text>
              <Text style={{ color:C.tx, fontWeight:"600", fontSize:11 }}>{sc.label}</Text>
            </Pressable>
          ))}
        </View>

        {live?.ofp && (
          <>
            <Text style={{ fontSize:10, color:C.dim, letterSpacing:1.5, fontWeight:"700" }}>LOAD · SIMBRIEF</Text>
            <View style={{ backgroundColor:C.panel, borderColor:C.line, borderWidth:1, borderRadius:14, padding:12 }}>
              {[["PAX",live.ofp.pax],["Payload",live.ofp.payload!=null?`${live.ofp.payload} ${live.ofp.units}`:null],
                ["Block",live.ofp.blockFuel!=null?`${live.ofp.blockFuel} ${live.ofp.units}`:null],
                ["Route",live.ofp.dep?`${live.ofp.dep}→${live.ofp.arr}`:null]].map(([k,v])=>(
                <View key={k} style={{ flexDirection:"row", justifyContent:"space-between",
                  paddingVertical:8, borderBottomColor:C.line, borderBottomWidth:1 }}>
                  <Text style={{ color:C.dim, fontSize:13 }}>{k}</Text>
                  <Text style={{ color:C.tx, fontSize:13, fontFamily:"Courier New" }}>{v??"—"}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
