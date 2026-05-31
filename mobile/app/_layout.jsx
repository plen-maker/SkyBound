import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { auth, onAuthStateChanged } from "../src/firebase";
import { registerForPush } from "../src/push";
import LoginScreen from "../src/screens/LoginScreen";

export default function RootLayout() {
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    return onAuthStateChanged(auth, u => {
      setUser(u);
      if (u) registerForPush(u.uid).catch(() => {});
    });
  }, []);

  if (user === undefined) return (
    <View style={{ flex:1, backgroundColor:"#070b12", alignItems:"center", justifyContent:"center" }}>
      <ActivityIndicator color="#5ec8ff" size="large"/>
    </View>
  );

  if (!user) return <LoginScreen/>;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor:"#070b12" } }}>
      <Stack.Screen name="(tabs)"/>
    </Stack>
  );
}
