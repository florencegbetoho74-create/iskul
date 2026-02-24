import React from "react";
import { Tabs } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLOR, ELEVATION, FONT, RADIUS } from "@/theme/colors";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const safeBottom = Math.max(0, insets.bottom);
  const tabBarBottom = Math.max(8, safeBottom > 0 ? safeBottom - 2 : 10);
  const tabBarHeight = 58 + safeBottom;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        sceneStyle: { backgroundColor: COLOR.bg },
        tabBarStyle: {
          position: "absolute",
          left: 10,
          right: 10,
          bottom: tabBarBottom,
          height: tabBarHeight,
          paddingBottom: Math.max(8, safeBottom),
          paddingTop: 8,
          backgroundColor: "rgba(255,255,255,0.96)",
          borderWidth: 1,
          borderTopWidth: 1,
          borderColor: COLOR.border,
          borderRadius: RADIUS.xl,
          ...ELEVATION.floating,
        },
        tabBarItemStyle: { borderRadius: RADIUS.md },
        tabBarActiveTintColor: COLOR.primary,
        tabBarInactiveTintColor: "#66748D",
        tabBarLabelStyle: {
          fontFamily: FONT.bodyBold,
          fontSize: 11,
          marginTop: -1,
        },
        tabBarIconStyle: { marginTop: -2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Accueil",
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="courses"
        options={{
          title: "Cours",
          tabBarIcon: ({ color, size }) => <Ionicons name="book-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="quizzes"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="live"
        options={{
          title: "Live",
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="broadcast" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: "Bibliotheque",
          tabBarIcon: ({ color, size }) => <Ionicons name="library-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profil",
          tabBarIcon: ({ color, size }) => <Ionicons name="person-circle-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

