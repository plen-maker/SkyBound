import React from "react";
import { View, Text, ScrollView, Pressable, Linking, StyleSheet } from "react-native";
import { useLiveSession } from "../useLiveSession";
import { C } from "../theme";

const SHORTCUTS = [
  ["Fenix EFB", "http://192.168.1.42:8080"],
  ["Navigraph", "https://charts.navigraph.com"],
  ["VATSIM",    "https://radar.vatsim.net"],
  ["SimBrief",  "https://dispatch.simbrief.com"],
  ["Spotify",   "https://open.spotify.com"],
  ["YT Music",  "https://music.youtube.com"],
  ["Discord",   "https://discord.com/app"],
  ["Skybound",  "https://skybound.cx"],
];

export default function HomeScreen({ uid }) {
  const { live } = useLiveSession(uid);
  const ofp = live?.ofp;
  const stat = (label, val, unit) => (
    <View style={st.stat}><Text style={st.statLabel}>{label}</Text>
      <Text style={st.statVal}>{val ?? "—"}<Text style={st.unit}> {unit}</Text></Text></View>
  );
  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 14, gap: 14 }}>
      <View style={st.row}>
        {stat("GS", live ? Math.round(live.gsKt) : null, "kt")}
        {stat("ALT", live ? Math.round(live.altFt).toLocaleString() : null, "ft")}
        {stat("Dest ETE", live ? Math.round(live.destEteMin) : null, "min")}
        {stat("To T/D", live ? Math.max(0, Math.round(live.destEteMin - (live.todDistNm / Math.max(live.gsKt,1) * 60))) : null, "min")}
      </View>

      <Text style={st.section}>SHORTCUTS</Text>
      <View style={st.grid}>
        {SHORTCUTS.map(([label, url]) => (
          <Pressable key={label} style={st.tile} onPress={() => Linking.openURL(url)}>
            <Text style={st.tileLabel}>{label}</Text>
            <Text style={st.tileSub} numberOfLines={1}>{url.replace(/^https?:\/\//, "")}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={st.section}>LOAD · SIMBRIEF</Text>
      <View style={st.panel}>
        {[["PAX", ofp?.pax], ["Payload", ofp?.payload && `${ofp.payload} ${ofp.units}`],
          ["Block fuel", ofp?.blockFuel && `${ofp.blockFuel} ${ofp.units}`], ["Route", ofp?.dep && `${ofp.dep} → ${ofp.arr}`]]
          .map(([k, v]) => (
            <View key={k} style={st.loadRow}><Text style={{ color: C.tx }}>{k}</Text>
              <Text style={{ color: C.tx, fontVariant: ["tabular-nums"] }}>{v ?? "—"}</Text></View>
          ))}
      </View>
      {!live && <Text style={{ color: C.dim, textAlign: "center" }}>Várakozás a sim bridge adataira…</Text>}
    </ScrollView>
  );
}
const st = StyleSheet.create({
  row: { flexDirection: "row", gap: 8 },
  stat: { flex: 1, backgroundColor: C.panel2, borderColor: C.line, borderWidth: 1, borderRadius: 10, padding: 10 },
  statLabel: { color: C.dim, fontSize: 10, letterSpacing: 1 },
  statVal: { color: C.cy, fontSize: 18, fontVariant: ["tabular-nums"], marginTop: 2 },
  unit: { color: C.dim, fontSize: 10 },
  section: { color: C.dim, fontSize: 11, letterSpacing: 1.5, fontWeight: "600" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tile: { width: "23%", backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: 12, padding: 10 },
  tileLabel: { color: C.tx, fontWeight: "600", fontSize: 12 },
  tileSub: { color: C.dim, fontSize: 9, marginTop: 2 },
  panel: { backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: 12, padding: 12 },
  loadRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 7, borderBottomColor: C.line, borderBottomWidth: 1 },
});
