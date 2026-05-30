import React, { useEffect, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { watchAuth, useGoogleAuth, signInWithGoogleIdToken } from "./src/firebase";
import { registerForPush } from "./src/push";
import HomeScreen from "./src/screens/HomeScreen";
import MapScreen from "./src/screens/MapScreen";
import OfpScreen from "./src/screens/OfpScreen";
import AlertsScreen from "./src/screens/AlertsScreen";
import BindScreen from "./src/screens/BindScreen";

const Tab = createBottomTabNavigator();
const C = { bg: "#070b12", panel: "#0e1521", line: "#1e293b", cy: "#5ec8ff", tx: "#cdd9ec", dim: "#6b7c95" };

export default function App() {
  const [user, setUser] = useState(undefined);
  const { request, response, promptAsync } = useGoogleAuth();

  useEffect(() => watchAuth(setUser), []);
  useEffect(() => {
    if (response?.type === "success") signInWithGoogleIdToken(response.params.id_token);
  }, [response]);
  useEffect(() => { if (user) registerForPush(user.uid, "phone").catch(() => {}); }, [user]);

  if (user === undefined)
    return <View style={s.center}><ActivityIndicator color={C.cy} /></View>;

  if (!user) return <SignIn onPress={() => promptAsync()} disabled={!request} />;

  const theme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: C.bg, card: C.panel, border: C.line, text: C.tx, primary: C.cy } };
  return (
    <NavigationContainer theme={theme}>
      <Tab.Navigator screenOptions={{ headerStyle: { backgroundColor: C.panel }, headerTintColor: C.tx, tabBarActiveTintColor: C.cy, tabBarStyle: { backgroundColor: C.panel, borderTopColor: C.line } }}>
        <Tab.Screen name="Home">{() => <HomeScreen uid={user.uid} />}</Tab.Screen>
        <Tab.Screen name="Map">{() => <MapScreen uid={user.uid} />}</Tab.Screen>
        <Tab.Screen name="SimBrief">{() => <OfpScreen uid={user.uid} />}</Tab.Screen>
        <Tab.Screen name="Alerts">{() => <AlertsScreen uid={user.uid} />}</Tab.Screen>
        <Tab.Screen name="Bind">{() => <BindScreen uid={user.uid} />}</Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  );
}

function SignIn({ onPress, disabled }) {
  return (
    <View style={s.center}>
      <Text style={{ color: C.cy, fontSize: 26, fontWeight: "700" }}>SKYBOUND EFB</Text>
      <Text style={{ color: C.dim, marginVertical: 16 }}>Jelentkezz be a párosításhoz</Text>
      <Pressable onPress={onPress} disabled={disabled} style={s.btn}>
        <Text style={{ color: "#070b12", fontWeight: "700" }}>Belépés Google-lel</Text>
      </Pressable>
    </View>
  );
}
const s = StyleSheet.create({
  center: { flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" },
  btn: { backgroundColor: C.cy, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 10 },
});
