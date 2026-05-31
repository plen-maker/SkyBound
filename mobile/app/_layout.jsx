import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { Stack } from "expo-router";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { app } from "../../src/firebase";
import LoginScreen from "../../src/screens/LoginScreen";

const auth = getAuth(app);

export default function RootLayout() {
  const [user, setUser] = useState(undefined);
  useEffect(() => onAuthStateChanged(auth, setUser), []);

  if (user === undefined) return (
    <View style={{ flex:1, backgroundColor:"#070b12",
      alignItems:"center", justifyContent:"center" }}>
      <ActivityIndicator color="#5ec8ff" size="large"/>
    </View>
  );

  if (!user) return <LoginScreen/>;

  return (
    <Stack screenOptions={{
      headerShown: false,
      contentStyle: { backgroundColor:"#070b12" },
    }}>
      <Stack.Screen name="(tabs)"/>
    </Stack>
  );
}
