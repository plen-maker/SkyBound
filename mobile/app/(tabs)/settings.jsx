import React, { useState, useEffect } from "react";
import { View, Text, TextInput, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { auth, signOut } from "../../src/firebase";
import { useLive, notifySession } from "../../src/useLive";
import { C } from "../../src/theme";

export default function SettingsScreen() {
  const user = auth.currentUser;
  const { sessionCode } = useLive();
  const [draft, setDraft] = useState(sessionCode);

  useEffect(() => { setDraft(sessionCode); }, [sessionCode]);

  const saveCode = () => {
    const v = draft.trim();
    AsyncStorage.setItem("sessionCode", v);
    notifySession(v);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} showsVerticalScrollIndicator={false}>

        <Text style={{ fontSize: 20, fontWeight: "700", color: C.tx, marginBottom: 4 }}>Settings</Text>

        {/* Account */}
        <View style={{ backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: 16, padding: 14 }}>
          <Text style={{ fontSize: 10, color: C.dim, letterSpacing: 1.2, fontWeight: "700", marginBottom: 6 }}>FIÓK</Text>
          <Text style={{ color: C.tx, fontSize: 14 }}>{user?.email || "—"}</Text>
        </View>

        {/* Session code */}
        <View style={{ backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 }}>
          <Text style={{ fontSize: 10, color: C.dim, letterSpacing: 1.2, fontWeight: "700" }}>SESSION KÓD</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={saveCode}
              placeholder="pl. kovacs-peter"
              placeholderTextColor={C.dim}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              style={{
                flex: 1, backgroundColor: C.p2, borderColor: C.line, borderWidth: 1,
                borderRadius: 10, color: C.cy, padding: 10,
                fontSize: 14, fontFamily: "Courier New",
              }}
            />
            <Pressable onPress={saveCode}
              style={{ backgroundColor: C.cy, borderRadius: 10, paddingHorizontal: 18, justifyContent: "center" }}>
              <Text style={{ color: "#070b12", fontWeight: "800", fontSize: 14 }}>OK</Text>
            </Pressable>
          </View>
          <Text style={{ color: C.dim, fontSize: 11, lineHeight: 15 }}>
            Ugyanez kell a bridge .env-be is: SKYBOUND_SESSION=...
          </Text>
        </View>

        {/* Version */}
        <View style={{ backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: 16, padding: 14 }}>
          <Text style={{ fontSize: 10, color: C.dim, letterSpacing: 1.2, fontWeight: "700", marginBottom: 6 }}>VERZIÓ</Text>
          <Text style={{ color: C.tx, fontSize: 14 }}>5.0.0 · SkyBound EFB</Text>
        </View>

        {/* Logout */}
        <Pressable onPress={() => signOut(auth)}
          style={({ pressed }) => ({
            backgroundColor: pressed ? "rgba(240,96,128,.1)" : C.panel,
            borderColor: "rgba(240,96,128,.3)", borderWidth: 1,
            borderRadius: 16, padding: 16, alignItems: "center", marginTop: 4,
          })}>
          <Text style={{ color: C.rd, fontWeight: "700", fontSize: 15 }}>Kijelentkezés</Text>
        </Pressable>

      </ScrollView>
    </SafeAreaView>
  );
}
