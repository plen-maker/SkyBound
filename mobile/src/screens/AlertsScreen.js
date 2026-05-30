import React, { useState } from "react";
import { View, Text, TextInput, Pressable, FlatList, StyleSheet } from "react-native";
import { useLiveSession } from "../useLiveSession";
import { C } from "../theme";

const KINDS = [["fix", "Fix"], ["tod", "T/D"], ["dest", "Landing"]];

export default function AlertsScreen({ uid }) {
  const { triggers, addTrigger, toggleTrigger, removeTrigger } = useLiveSession(uid);
  const [kind, setKind] = useState("fix");
  const [fix, setFix] = useState("VETIK");
  const [lead, setLead] = useState("5");

  const add = () => addTrigger({ kind, lead: Number(lead) || 5, ...(kind === "fix" ? { fix: fix.toUpperCase() } : {}) });

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, padding: 14 }}>
      <View style={st.card}>
        <View style={{ flexDirection: "row", gap: 6, marginBottom: 10 }}>
          {KINDS.map(([k, lbl]) => (
            <Pressable key={k} onPress={() => setKind(k)} style={[st.chip, kind === k && st.chipOn]}>
              <Text style={{ color: kind === k ? "#070b12" : C.dim, fontWeight: "600" }}>{lbl}</Text>
            </Pressable>
          ))}
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {kind === "fix" && (
            <TextInput value={fix} onChangeText={setFix} placeholder="FIX" placeholderTextColor={C.dim}
              autoCapitalize="characters" style={[st.input, { flex: 1 }]} />
          )}
          <TextInput value={lead} onChangeText={setLead} keyboardType="number-pad"
            placeholder="min" placeholderTextColor={C.dim} style={[st.input, { width: 70 }]} />
          <Pressable onPress={add} style={st.arm}><Text style={{ color: "#070b12", fontWeight: "700" }}>Arm</Text></Pressable>
        </View>
      </View>

      <FlatList
        data={triggers}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ gap: 8, paddingTop: 12 }}
        renderItem={({ item }) => (
          <View style={[st.trigger, item.fired && { borderColor: C.gn }]}>
            <Pressable onPress={() => toggleTrigger(item.id, !item.armed)} style={[st.dot, { backgroundColor: item.armed ? C.cy : C.panel2 }]} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.tx, fontWeight: "600" }}>
                {item.kind === "fix" ? item.fix : item.kind.toUpperCase()} <Text style={{ color: C.dim }}>− {item.lead} min</Text>
              </Text>
              <Text style={{ color: C.dim, fontSize: 11 }}>{item.armed ? (item.fired ? "fired" : "armed") : "off"}</Text>
            </View>
            <Pressable onPress={() => removeTrigger(item.id)}><Text style={{ color: C.rd }}>Delete</Text></Pressable>
          </View>
        )}
        ListEmptyComponent={<Text style={{ color: C.dim, textAlign: "center", marginTop: 30 }}>Nincs aktív trigger</Text>}
      />
    </View>
  );
}
const st = StyleSheet.create({
  card: { backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: 12, padding: 12 },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, backgroundColor: C.panel2, borderColor: C.line, borderWidth: 1 },
  chipOn: { backgroundColor: C.cy },
  input: { backgroundColor: C.panel2, borderColor: C.line, borderWidth: 1, borderRadius: 8, color: C.tx, paddingHorizontal: 10, paddingVertical: 8 },
  arm: { backgroundColor: C.cy, borderRadius: 8, paddingHorizontal: 16, justifyContent: "center" },
  trigger: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: 12, padding: 12 },
  dot: { width: 22, height: 22, borderRadius: 6, borderColor: C.line, borderWidth: 1 },
});
