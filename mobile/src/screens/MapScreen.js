import React from "react";
import { View, Text, StyleSheet } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { useLiveSession } from "../useLiveSession";
import { C } from "../theme";

export default function MapScreen({ uid }) {
  const { live } = useLiveSession(uid);
  if (!live) return <View style={st.center}><Text style={{ color: C.dim }}>Várakozás pozícióra…</Text></View>;
  return (
    <MapView
      provider={PROVIDER_GOOGLE}
      style={{ flex: 1 }}
      mapType="satellite"
      region={{ latitude: live.lat, longitude: live.lon, latitudeDelta: 1.2, longitudeDelta: 1.2 }}>
      <Marker coordinate={{ latitude: live.lat, longitude: live.lon }} rotation={0} title={live.ofp?.arr ? `→ ${live.ofp.arr}` : "Aircraft"} />
    </MapView>
  );
}
const st = StyleSheet.create({ center: { flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" } });
