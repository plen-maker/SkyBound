import { Tabs } from "expo-router";
import { C } from "../../src/theme";

export default function TabLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarStyle: { backgroundColor: C.panel, borderTopColor: C.line, height: 60 },
      tabBarActiveTintColor: C.cy,
      tabBarInactiveTintColor: C.dim,
      tabBarLabelStyle: { fontSize: 10, fontWeight: "600" },
    }}>
      <Tabs.Screen name="index"       options={{ title: "Home" }}/>
      <Tabs.Screen name="ofp"         options={{ title: "SimBrief" }}/>
      <Tabs.Screen name="vatsim"      options={{ title: "VATSIM" }}/>
      <Tabs.Screen name="alerts"      options={{ title: "Alerts" }}/>
      <Tabs.Screen name="settings"    options={{ title: "Settings" }}/>
    </Tabs>
  );
}
