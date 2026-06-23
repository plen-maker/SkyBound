import React from "react";
import { View, Text, ScrollView, Pressable, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLive } from "../../src/useLive";
import { C } from "../../src/theme";

const SHORTCUTS = [
  { label:"Navigraph", icon:"map",           url:"https://charts.navigraph.com",  color:"#7c8cff" },
  { label:"VATSIM",    icon:"radio",          url:"https://radar.vatsim.net",      color: C.gn    },
  { label:"SimBrief",  icon:"document-text",  url:"https://dispatch.simbrief.com", color: C.am    },
  { label:"Spotify",   icon:"musical-notes",  url:"https://open.spotify.com",      color:"#1db954"},
  { label:"YT Music",  icon:"logo-youtube",   url:"https://music.youtube.com",     color: C.rd    },
  { label:"Discord",   icon:"logo-discord",   url:"https://discord.com/app",       color:"#7289da"},
];

function StatCard({ label, value, unit, color }) {
  const active = value != null;
  return (
    <View style={{
      flex: 1, backgroundColor: C.p2, borderRadius: 14, padding: 12,
      borderWidth: 1, borderColor: active ? `${color || C.cy}28` : C.line,
      alignItems: "center", minWidth: 0,
    }}>
      <Text style={{ fontSize: 9, color: C.dim, letterSpacing: 1.2, fontWeight: "700", marginBottom: 4 }}>
        {label}
      </Text>
      <Text style={{
        fontSize: 20, fontWeight: "800",
        color: active ? (color || C.cy) : C.dim,
        fontVariant: ["tabular-nums"],
      }}>
        {value ?? "—"}
      </Text>
      {unit && active && (
        <Text style={{ fontSize: 9, color: C.dim, marginTop: 2 }}>{unit}</Text>
      )}
    </View>
  );
}

export default function HomeScreen() {
  const { live, rtdb } = useLive();
  const isLive = rtdb && live != null;

  const ete = live?.destEteMin != null
    ? `${Math.floor(live.destEteMin / 60)}:${String(Math.round(live.destEteMin) % 60).padStart(2, "0")}`
    : null;

  const dep = live?.ofp?.dep || null;
  const arr = live?.ofp?.arr || null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 14 }}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Header ── */}
        <View style={{ flexDirection:"row", alignItems:"center", justifyContent:"space-between" }}>
          <Text style={{ fontSize: 18, fontWeight: "800", color: C.tx, letterSpacing: 0.4 }}>
            SKYBOUND <Text style={{ color: C.cy }}>EFB</Text>
          </Text>
          <View style={{
            flexDirection: "row", alignItems: "center", gap: 5,
            backgroundColor: isLive ? "rgba(82,227,176,.1)" : "rgba(90,112,144,.08)",
            borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5,
          }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: isLive ? C.gn : C.dim }} />
            <Text style={{ fontSize: 10, fontWeight: "700", color: isLive ? C.gn : C.dim }}>
              {isLive ? "SIM LIVE" : "NO BRIDGE"}
            </Text>
          </View>
        </View>

        {/* ── Flight card (auto-hide when not live) ── */}
        {isLive && (
          <View style={{
            backgroundColor: C.panel, borderRadius: 20, padding: 16, gap: 12,
            borderWidth: 1, borderColor: `${C.cy}22`,
          }}>
            {/* Route + status */}
            <View style={{ flexDirection:"row", alignItems:"center", justifyContent:"space-between" }}>
              <Text style={{ fontSize: 22, fontWeight: "800", color: C.tx, fontFamily:"Courier New", letterSpacing: 1 }}>
                {dep ?? "???"}<Text style={{ color: C.dim }}> → </Text>{arr ?? "???"}
              </Text>
              <View style={{
                backgroundColor: live?.onGround ? "rgba(255,180,84,.15)" : "rgba(82,227,176,.12)",
                borderRadius: 99, paddingHorizontal: 8, paddingVertical: 4,
                borderWidth: 1,
                borderColor: live?.onGround ? "rgba(255,180,84,.3)" : "rgba(82,227,176,.25)",
              }}>
                <Text style={{ fontSize: 9, fontWeight: "800", letterSpacing: 0.5,
                  color: live?.onGround ? C.am : C.gn }}>
                  {live?.onGround ? "ON GROUND" : "AIRBORNE"}
                </Text>
              </View>
            </View>

            {/* Stats row */}
            <View style={{ flexDirection: "row", gap: 8 }}>
              <StatCard label="GS"  value={live.gsKt  != null ? Math.round(live.gsKt)                     : null} unit="kt"  color={C.cy} />
              <StatCard label="ALT" value={live.altFt  != null ? Math.round(live.altFt).toLocaleString()   : null} unit="ft"  color={C.am} />
              <StatCard label="V/S" value={live.vsFpm  != null ? Math.round(live.vsFpm)                    : null} unit="fpm" color={live?.vsFpm < -200 ? C.rd : C.gn} />
              <StatCard label="ETE" value={ete}                                                                     unit=""    color={C.cy} />
            </View>
          </View>
        )}

        {/* ── No bridge notice ── */}
        {!isLive && (
          <View style={{
            backgroundColor: "rgba(94,200,255,.04)", borderColor: "rgba(94,200,255,.12)",
            borderWidth: 1, borderRadius: 16, padding: 14,
            flexDirection: "row", alignItems: "center", gap: 12,
          }}>
            <Ionicons name="wifi-outline" size={22} color={C.dim} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.tx, fontWeight: "700", fontSize: 13 }}>Bridge nincs csatlakoztatva</Text>
              <Text style={{ color: C.dim, fontSize: 11, marginTop: 3, lineHeight: 16 }}>
                Élő adatokhoz futtasd a bridge-et az MSFS-es gépen.
              </Text>
            </View>
          </View>
        )}

        {/* ── Shortcuts ── */}
        <Text style={{ fontSize: 10, color: C.dim, letterSpacing: 1.5, fontWeight: "700" }}>
          GYORSELÉRÉS
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {SHORTCUTS.map(sc => (
            <Pressable
              key={sc.label}
              onPress={() => Linking.openURL(sc.url)}
              style={({ pressed }) => ({
                width: "30%", flexGrow: 1,
                backgroundColor: pressed ? C.p2 : C.panel,
                borderColor: C.line, borderWidth: 1, borderRadius: 16,
                padding: 12, alignItems: "center", gap: 6,
              })}
            >
              <View style={{
                width: 38, height: 38, borderRadius: 11,
                backgroundColor: `${sc.color}1a`,
                alignItems: "center", justifyContent: "center",
              }}>
                <Ionicons name={sc.icon} size={19} color={sc.color} />
              </View>
              <Text style={{ color: C.tx, fontWeight: "600", fontSize: 11, textAlign: "center" }}>
                {sc.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* ── OFP mini-card ── */}
        {live?.ofp && (
          <View style={{ backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: 16, padding: 14 }}>
            <Text style={{ fontSize: 10, color: C.dim, letterSpacing: 1.2, fontWeight: "700", marginBottom: 8 }}>
              SIMBRIEF OFP
            </Text>
            {[
              ["Route",   dep && arr ? `${dep} → ${arr}` : null],
              ["Block",   live.ofp.blockFuel != null ? `${Math.round(live.ofp.blockFuel).toLocaleString()} ${live.ofp.units || "kg"}` : null],
              ["PAX",     live.ofp.pax],
            ].map(([k, v]) => (
              <View key={k} style={{ flexDirection:"row", justifyContent:"space-between",
                paddingVertical: 7, borderBottomColor: C.line, borderBottomWidth: 1 }}>
                <Text style={{ color: C.dim, fontSize: 13 }}>{k}</Text>
                <Text style={{ color: C.tx, fontSize: 13, fontFamily: "Courier New" }}>{v ?? "—"}</Text>
              </View>
            ))}
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}
