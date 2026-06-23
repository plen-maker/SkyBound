import { Tabs } from "expo-router";
import { View, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C } from "../../src/theme";

const TABS = [
  { name:"index",    label:"Home",     icon:"home",          color: C.cy  },
  { name:"ofp",      label:"OFP",      icon:"document-text", color: C.am  },
  { name:"vatsim",   label:"VATSIM",   icon:"radio",         color: C.gn  },
  { name:"alerts",   label:"Alerts",   icon:"notifications", color: C.rd  },
  { name:"settings", label:"Settings", icon:"settings",      color: C.dim },
];

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => {
        const t = TABS.find(x => x.name === route.name) || TABS[0];
        return {
          headerShown: false,
          tabBarActiveTintColor:   t.color,
          tabBarInactiveTintColor: C.dim,
          tabBarStyle: {
            backgroundColor: "rgba(8,9,14,0.97)",
            borderTopWidth:  0.5,
            borderTopColor:  "rgba(255,255,255,0.06)",
            height:          Platform.OS === "ios" ? 84 : 64,
            paddingBottom:   Platform.OS === "ios" ? 26 : 6,
            paddingTop:      6,
            elevation:       0,
          },
          tabBarLabelStyle: { fontSize: 10, fontWeight: "700", letterSpacing: 0.2, marginTop: 2 },
          tabBarIcon: ({ focused, color }) => (
            <View style={{
              alignItems: "center", justifyContent: "center",
              width: 46, height: 28, borderRadius: 14,
              backgroundColor: focused ? `${t.color}1a` : "transparent",
            }}>
              <Ionicons
                name={focused ? t.icon : `${t.icon}-outline`}
                size={21}
                color={color}
              />
            </View>
          ),
        };
      }}
    >
      {TABS.map(t => (
        <Tabs.Screen key={t.name} name={t.name} options={{ title: t.label }} />
      ))}
    </Tabs>
  );
}
