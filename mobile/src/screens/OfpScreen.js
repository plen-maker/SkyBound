import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useLiveSession } from "../useLiveSession";
import { fetchOFP } from "../../../shared/simbrief";  // shared parser; or copy into src/
import { C } from "../theme";

const SIMBRIEF_USERNAME = "chris_vatsim";  // TODO: move to Settings / user profile

export default function OfpScreen({ uid }) {
  const { live } = useLiveSession(uid);
  const [ofp, setOfp] = useState(null);
  useEffect(() => { fetchOFP({ username: SIMBRIEF_USERNAME }).then(setOfp).catch(() => {}); }, []);
  const data = ofp || live?.ofp;
  if (!data) return <View style={st.center}><Text style={{ color: C.dim }}>OFP betöltése…</Text></View>;
  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 14, gap: 12 }}>
      <Text style={{ color: C.cy, fontSize: 18, fontWeight: "700" }}>{data.dep} → {data.arr}</Text>
      <View style={st.panel}><Text style={st.k}>Route</Text><Text style={st.route}>{data.route}</Text></View>
      {(data.fixes || []).map((f) => (
        <View key={f.ident} style={st.fixRow}>
          <Text style={{ color: C.cy, width: 70 }}>{f.ident}</Text>
          <Text style={{ color: C.dim, flex: 1 }}>{f.stage}</Text>
          <Text style={{ color: C.tx }}>{f.altitude ?? "—"} ft</Text>
        </View>
      ))}
    </ScrollView>
  );
}
const st = StyleSheet.create({
  center: { flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" },
  panel: { backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: 12, padding: 12 },
  k: { color: C.dim, fontSize: 10, letterSpacing: 1 },
  route: { color: C.tx, marginTop: 4, fontVariant: ["tabular-nums"] },
  fixRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomColor: C.line, borderBottomWidth: 1 },
});
