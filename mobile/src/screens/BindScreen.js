import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { auth } from "../firebase";
import { C } from "../theme";

export default function BindScreen({ uid }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, padding: 16, gap: 14 }}>
      <View style={st.card}>
        <Text style={{ color: C.tx, fontWeight: "700", fontSize: 16 }}>Párosítva ✓</Text>
        <Text style={{ color: C.dim, marginTop: 6 }}>
          A párosítás a Google-fiókon keresztül történik. A PC bridge ugyanezzel a UID-del ír a sessionbe,
          a telefon pedig feliratkozik rá és kapja a push értesítéseket.
        </Text>
        <Text style={{ color: C.cy, marginTop: 10, fontVariant: ["tabular-nums"] }}>UID: {uid}</Text>
        <Text style={{ color: C.dim, fontSize: 11, marginTop: 4 }}>Ezt írd a bridge .env SKYBOUND_UID mezőjébe.</Text>
      </View>
      <Pressable onPress={() => auth.signOut()} style={st.out}><Text style={{ color: C.rd }}>Kijelentkezés</Text></Pressable>
    </View>
  );
}
const st = StyleSheet.create({
  card: { backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: 12, padding: 16 },
  out: { borderColor: C.line, borderWidth: 1, borderRadius: 10, padding: 12, alignItems: "center" },
});
