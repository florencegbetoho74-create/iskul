import React from "react";
import { Tabs } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/theme/ThemeProvider";
import { useAuth } from "@/providers/AuthProvider";
import { FONT_FAMILY } from "@/theme/tokens";

/** Onglet masque : expo-router exige que l'ecran reste declare. */
const HIDDEN = { href: null } as const;

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { color, radius, elevation } = useTheme();
  const { user } = useAuth();

  const isTeacher = String(user?.role || "") === "teacher";

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
      {/*
        Eleve et professeur n'ont pas les memes besoins quotidiens. Chacun voit
        cinq onglets qui le concernent, plutot que six generiques dont certains
        ne lui servent jamais.
      */}
      <Tabs.Screen
        name="index"
        options={{
          title: isTeacher ? "Tableau" : "Accueil",
          tabBarIcon: ({ color: c, size }) => (
            <Ionicons name={isTeacher ? "stats-chart-outline" : "home-outline"} size={size} color={c} />
          ),
        }}
      />

      <Tabs.Screen
        name="courses"
        options={{
          title: isTeacher ? "Mes cours" : "Cours",
          tabBarIcon: ({ color: c, size }) => <Ionicons name="book-outline" size={size} color={c} />,
        }}
      />

      {/* L'auto-evaluation est une promesse centrale : elle a sa place dans la barre. */}
      <Tabs.Screen
        name="quizzes"
        options={
          isTeacher
            ? HIDDEN
            : {
                title: "Quiz",
                tabBarIcon: ({ color: c, size }) => (
                  <MaterialCommunityIcons name="brain" size={size} color={c} />
                ),
              }
        }
      />

      {/*
        Le professeur anime ses seances depuis la barre ; l'eleve, lui, y est
        amene par la notification et par la section Aujourd'hui de son accueil.
        Un live est un rendez-vous, pas quelque chose qu'on parcourt.
      */}
      <Tabs.Screen
        name="live"
        options={
          isTeacher
            ? {
                title: "Live",
                tabBarIcon: ({ color: c, size }) => (
                  <MaterialCommunityIcons name="broadcast" size={size} color={c} />
                ),
              }
            : HIDDEN
        }
      />

      <Tabs.Screen
        name="library"
        options={
          isTeacher
            ? HIDDEN
            : {
                title: "Bibliothèque",
                tabBarIcon: ({ color: c, size }) => (
                  <Ionicons name="library-outline" size={size} color={c} />
                ),
              }
        }
      />

      <Tabs.Screen
        name="learners"
        options={
          isTeacher
            ? {
                title: "Élèves",
                tabBarIcon: ({ color: c, size }) => (
                  <Ionicons name="people-outline" size={size} color={c} />
                ),
              }
            : HIDDEN
        }
      />

      {/* Messages reste dans l'en-tete de l'accueil, badge de non-lus compris. */}
      <Tabs.Screen name="messages" options={HIDDEN} />

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
