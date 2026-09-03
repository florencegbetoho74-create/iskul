import React from "react";
import { Tabs } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/theme/ThemeProvider";
import { FONT_FAMILY } from "@/theme/tokens";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { color, radius, elevation } = useTheme();

  const safeBottom = Math.max(0, insets.bottom);
  const barBottom = Math.max(8, safeBottom > 0 ? safeBottom - 2 : 10);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        sceneStyle: { backgroundColor: color.bg },
        tabBarStyle: {
          position: "absolute",
          left: 10,
          right: 10,
          bottom: barBottom,
          height: 58 + safeBottom,
          paddingBottom: Math.max(8, safeBottom),
          paddingTop: 8,
          backgroundColor: color.surfaceRaised,
          borderWidth: 1,
          borderTopWidth: 1,
          borderColor: color.border,
          borderRadius: radius.xl,
          ...elevation(3),
        },
        tabBarItemStyle: { borderRadius: radius.md },
        tabBarActiveTintColor: color.primary,
        tabBarInactiveTintColor: color.textFaint,
        tabBarLabelStyle: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 10, marginTop: -1 },
        tabBarIconStyle: { marginTop: -2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Accueil",
          tabBarIcon: ({ color: c, size }) => <Ionicons name="home-outline" size={size} color={c} />,
        }}
      />
      <Tabs.Screen
        name="courses"
        options={{
          title: "Cours",
          tabBarIcon: ({ color: c, size }) => <Ionicons name="book-outline" size={size} color={c} />,
        }}
      />
      {/*
        Quiz etait masque de la barre (href: null) et n'etait atteignable que
        par un bouton de l'accueil : l'auto-evaluation, promesse centrale du
        produit, restait introuvable.

        Messages garde son entree dans l'en-tete de l'accueil, badge de non-lus
        compris. Un septieme onglet aurait tronque tous les libelles et reduit
        les cibles sous le seuil confortable.
      */}
      <Tabs.Screen
        name="quizzes"
        options={{
          title: "Quiz",
          tabBarIcon: ({ color: c, size }) => (
            <MaterialCommunityIcons name="brain" size={size} color={c} />
          ),
        }}
      />
      <Tabs.Screen
        name="live"
        options={{
          title: "Live",
          tabBarIcon: ({ color: c, size }) => (
            <MaterialCommunityIcons name="broadcast" size={size} color={c} />
          ),
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: "Bibliothèque",
          tabBarIcon: ({ color: c, size }) => (
            <Ionicons name="library-outline" size={size} color={c} />
          ),
        }}
      />
      <Tabs.Screen name="messages" options={{ href: null }} />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profil",
          tabBarIcon: ({ color: c, size }) => (
            <Ionicons name="person-circle-outline" size={size} color={c} />
          ),
        }}
      />
    </Tabs>
  );
}
