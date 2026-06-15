import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar, View, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { onAuthStateChanged } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from './src/firebase';
import { THEME } from './src/theme';
import { registerForPushNotifications } from './src/notifications';

import LoginScreen   from './src/screens/LoginScreen';
import ConnectScreen from './src/screens/ConnectScreen';
import EFBScreen     from './src/screens/EFBScreen';
import NoteScreen    from './src/screens/NoteScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Tab   = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function MainTabs({ desktopUrl }) {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          const icons = {
            EFB:      ['albums',   'albums-outline'],
            Note:     ['pencil',   'pencil-outline'],
            Settings: ['settings', 'settings-outline'],
          };
          const [active, inactive] = icons[route.name] || ['ellipse','ellipse-outline'];
          return <Ionicons name={focused ? active : inactive} size={size} color={color} />;
        },
        tabBarActiveTintColor: THEME.cy,
        tabBarInactiveTintColor: THEME.dim,
        tabBarStyle: {
          backgroundColor: THEME.panel,
          borderTopColor: THEME.line,
          borderTopWidth: 1,
          paddingBottom: 4,
          height: 56,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
        headerShown: false,
      })}
    >
      <Tab.Screen
        name="EFB"
        component={EFBScreen}
        initialParams={{ desktopUrl }}
      />
      <Tab.Screen name="Note" component={NoteScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [user, setUser]           = useState(undefined); // undefined = loading
  const [desktopUrl, setDesktopUrl] = useState(null);
  const [checking, setChecking]   = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async u => {
      setUser(u);
      if (u) {
        await registerForPushNotifications();
        const saved = await AsyncStorage.getItem('desktopUrl');
        setDesktopUrl(saved || null);
      }
      setChecking(false);
    });
  }, []);

  if (checking || user === undefined) {
    return (
      <View style={{ flex:1, backgroundColor: THEME.bg, justifyContent:'center', alignItems:'center' }}>
        <ActivityIndicator color={THEME.cy} size="large" />
      </View>
    );
  }

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={THEME.bg} />
      <NavigationContainer theme={{
        dark: true,
        colors: {
          primary: THEME.cy,
          background: THEME.bg,
          card: THEME.panel,
          text: THEME.tx,
          border: THEME.line,
          notification: THEME.cy,
        },
      }}>
        <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
          {!user ? (
            <Stack.Screen name="Login" component={LoginScreen} />
          ) : !desktopUrl ? (
            <Stack.Screen name="Connect">
              {props => (
                <ConnectScreen
                  {...props}
                  onConnected={url => setDesktopUrl(url)}
                />
              )}
            </Stack.Screen>
          ) : (
            <Stack.Screen name="Main">
              {() => <MainTabs desktopUrl={desktopUrl} />}
            </Stack.Screen>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
}
