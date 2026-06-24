import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar, View, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './src/firebase';
import { THEME as C } from './src/theme';
import { registerForPushNotifications } from './src/notifications';

import LoginScreen    from './src/screens/LoginScreen';
import EFBScreen      from './src/screens/EFBScreen';
import HomeScreen     from './app/(tabs)/index';
import OFPScreen      from './app/(tabs)/ofp';
import VatsimScreen   from './app/(tabs)/vatsim';
import AlertsScreen   from './app/(tabs)/alerts';
import SettingsScreen from './app/(tabs)/settings';

const Tab   = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const TABS = [
  { name:"Home",     label:"Home",    icon:"home",          color: C.cy  },
  { name:"OFP",      label:"OFP",     icon:"document-text", color: C.am  },
  { name:"VATSIM",   label:"VATSIM",  icon:"radio",         color: C.gn  },
  { name:"Alerts",   label:"Alerts",  icon:"notifications", color: C.rd  },
  { name:"Desktop",  label:"Desktop", icon:"laptop",        color: C.pu  },
  { name:"Settings", label:"Setup",   icon:"settings",      color: C.dim },
];

const SCREENS = {
  Home:     HomeScreen,
  OFP:      OFPScreen,
  VATSIM:   VatsimScreen,
  Alerts:   AlertsScreen,
  Desktop:  EFBScreen,
  Settings: SettingsScreen,
};

function MainTabs() {
  return (
    <Tab.Navigator
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
            height:          Platform.OS === 'ios' ? 84 : 62,
            paddingBottom:   Platform.OS === 'ios' ? 24 : 6,
            paddingTop:      6,
            elevation:       0,
          },
          tabBarLabelStyle: { fontSize: 10, fontWeight: '700', letterSpacing: 0.2, marginTop: 1 },
          tabBarIcon: ({ focused, color }) => (
            <View style={{
              alignItems: 'center', justifyContent: 'center',
              width: 44, height: 26, borderRadius: 13,
              backgroundColor: focused ? `${t.color}1a` : 'transparent',
            }}>
              <Ionicons
                name={focused ? t.icon : `${t.icon}-outline`}
                size={20}
                color={color}
              />
            </View>
          ),
        };
      }}
    >
      {TABS.map(t => (
        <Tab.Screen
          key={t.name}
          name={t.name}
          component={SCREENS[t.name]}
          options={{ title: t.label }}
        />
      ))}
    </Tab.Navigator>
  );
}

export default function App() {
  const [user,  setUser]  = useState(undefined);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, async u => {
      setUser(u);
      if (u) registerForPushNotifications().catch(() => {});
      setReady(true);
    });
  }, []);

  if (!ready) {
    return (
      <View style={{ flex:1, backgroundColor:C.bg, justifyContent:'center', alignItems:'center' }}>
        <ActivityIndicator color={C.cy} size="large"/>
      </View>
    );
  }

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={C.bg}/>
      <NavigationContainer theme={{
        dark: true,
        colors: {
          primary:      C.cy,
          background:   C.bg,
          card:         C.panel,
          text:         C.tx,
          border:       C.line,
          notification: C.cy,
        },
      }}>
        <Stack.Navigator screenOptions={{ headerShown:false, animation:'fade' }}>
          {!user
            ? <Stack.Screen name="Login" component={LoginScreen}/>
            : <Stack.Screen name="Main"  component={MainTabs}/>
          }
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
}
