import React from "react";
import { View, Text, ScrollView, Pressable, Linking, StyleSheet, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLive } from "../../src/useLive";
import { C } from "../../src/theme";

const SHORTCUTS = [
  { label:"Fenix EFB",  url:"http://192.168.1.x:8080",       color:C.cy },
  { label:"Navigraph",  url:"https://charts.navigraph.com",  color:"#7c8cff" },
  { label:"VATSIM",     url:"https://radar.vatsim.net",      color:C.gn },
  { label:"SimBrief",   url:"https://dispatch.simbrief.com", color:C.am },
  { label:"Spotify",    url:"https://open.spotify.com",      color:"#1db954" },
  { label:"YT Music",   url:"https://music.youtube.com",     color:C.rd },
  { label:"Discord",    url:"https://discord.com/app",       color:"#7c8cff" },
  { label:"Skybound",   url:"https://skybound.cx",           color:C.cy },
];

function StatCard({ label, value, unit, accent }) {
  return (
    <View style={s.stat}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={[s.statVal, accent && { color: accent }]}>
        {value ?? "—"}{value != null && unit ? <Text style={s.unit}> {unit}</Text> : null}
      </Text>
    </View>
  );
}

export default function HomeScreen() {
  const { live, connected } = useLive();
  const [refreshing, setRefreshing] = React.useState(false);

  return (
    <SafeAreaView style={{ flex:1, backgroundColor:C.bg }}>
      <ScrollView contentContainerStyle={s.container}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={C.cy}/>}>

        {/* Status bar */}
        <View style={s.statusBar}>
          <Text style={s.appTitle}>SKYBOUND <Text style={{ color:C.cy }}>EFB</Text></Text>
          <View style={[s.pill, { backgroundColor:connected&&live?"rgba(82,227,176,.12)":"rgba(90,112,144,.08)" }]}>
            <View style={[s.dot, { backgroundColor:connected&&live?C.gn:C.dim }]}/>
            <Text style={[s.pillTx, { color:connected&&live?C.gn:C.dim }]}>
              {connected && live ? "SIM LIVE" : "NO BRIDGE"}
            </Text>
          </View>
        </View>

        {/* Live stats */}
        <View style={s.grid4}>
          <StatCard label="ETE"  value={live ? `${Math.floor(live.destEteMin/60)}:${String(Math.round(live.destEteMin)%60).padStart(2,"0")}` : null} unit="" accent={C.cy}/>
          <StatCard label="GS"   value={live ? Math.round(live.gsKt)  : null} unit="kt"/>
          <StatCard label="ALT"  value={live ? Math.round(live.altFt).toLocaleString() : null} unit="ft"/>
          <StatCard label="V/S"  value={live ? Math.round(live.vsFpm) : null} unit="fpm" accent={live?.vsFpm < -200 ? C.am : null}/>
        </View>

        {!live && (
          <View style={s.infoBox}>
            <Text style={{ color:C.am, fontSize:13 }}>
              Sim bridge nincs csatlakoztatva — az élő adatok (sebesség, magasság, térkép) akkor jelennek meg, ha fut a bridge a MSFS-es gépen.
            </Text>
          </View>
        )}

        {/* Shortcuts */}
        <Text style={s.sectionLabel}>SHORTCUTS</Text>
        <View style={s.grid2}>
          {SHORTCUTS.map(sc => (
            <Pressable key={sc.label} style={s.tile} onPress={() => Linking.openURL(sc.url)}>
              <View style={[s.tileIcon, { borderColor:sc.color+"40" }]}>
                <Text style={{ color:sc.color, fontSize:16 }}>✈</Text>
              </View>
              <Text style={s.tileLabel}>{sc.label}</Text>
              <Text style={s.tileSub} numberOfLines={1}>{sc.url.replace(/^https?:\/\//,"")}</Text>
            </Pressable>
          ))}
        </View>

        {/* OFP quick view if live */}
        {live?.ofp && (
          <>
            <Text style={s.sectionLabel}>LOAD · SIMBRIEF</Text>
            <View style={s.panel}>
              {[
                ["PAX",     live.ofp.pax],
                ["Payload", live.ofp.payload != null ? `${live.ofp.payload} ${live.ofp.units}` : null],
                ["Block",   live.ofp.blockFuel != null ? `${live.ofp.blockFuel} ${live.ofp.units}` : null],
                ["Route",   live.ofp.dep && `${live.ofp.dep}→${live.ofp.arr}`],
              ].map(([k,v]) => (
                <View key={k} style={s.loadRow}>
                  <Text style={{ color:C.dim, fontSize:13 }}>{k}</Text>
                  <Text style={{ color:C.tx, fontSize:13, fontFamily:"Courier New" }}>{v ?? "—"}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:    { padding:16, gap:14 },
  statusBar:    { flexDirection:"row", alignItems:"center", justifyContent:"space-between" },
  appTitle:     { fontSize:17, fontWeight:"800", color:C.tx, letterSpacing:.5 },
  pill:         { flexDirection:"row", alignItems:"center", gap:5, borderRadius:99, paddingHorizontal:10, paddingVertical:4 },
  dot:          { width:6, height:6, borderRadius:3 },
  pillTx:       { fontSize:10, fontWeight:"600", letterSpacing:.5 },
  grid4:        { flexDirection:"row", gap:8 },
  stat:         { flex:1, backgroundColor:C.p2, borderColor:C.line, borderWidth:1, borderRadius:12, padding:10 },
  statLabel:    { fontSize:9, color:C.dim, letterSpacing:1, textTransform:"uppercase" },
  statVal:      { fontSize:18, color:C.tx, fontFamily:"Courier New", marginTop:2, fontWeight:"600" },
  unit:         { fontSize:10, color:C.dim },
  infoBox:      { backgroundColor:"rgba(255,180,84,.06)", borderColor:"rgba(255,180,84,.18)", borderWidth:1, borderRadius:12, padding:12 },
  sectionLabel: { fontSize:10, color:C.dim, letterSpacing:1.5, fontWeight:"700" },
  grid2:        { flexDirection:"row", flexWrap:"wrap", gap:8 },
  tile:         { width:"23%", backgroundColor:C.panel, borderColor:C.line, borderWidth:1, borderRadius:14, padding:10 },
  tileIcon:     { width:32, height:32, borderRadius:8, borderWidth:1, alignItems:"center", justifyContent:"center", marginBottom:6 },
  tileLabel:    { color:C.tx, fontWeight:"600", fontSize:11 },
  tileSub:      { color:C.dim, fontSize:8, marginTop:2 },
  panel:        { backgroundColor:C.panel, borderColor:C.line, borderWidth:1, borderRadius:14, padding:12 },
  loadRow:      { flexDirection:"row", justifyContent:"space-between", paddingVertical:8, borderBottomColor:C.line, borderBottomWidth:1 },
});
