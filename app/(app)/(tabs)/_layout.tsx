import React from "react";
import { Tabs } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { COLOR } from "@/theme/colors";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: "#0B0B0C", borderTopColor: "#1F2023" },
        tabBarActiveTintColor: COLOR.primary,
        tabBarInactiveTintColor: COLOR.sub
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Accueil",
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />
        }}
      />
      <Tabs.Screen
        name="courses"
        options={{
          title: "Cours",
          tabBarIcon: ({ color, size }) => <Ionicons name="book-outline" size={size} color={color} />
        }}
      />
      <Tabs.Screen
        name="live"
        options={{
          title: "Direct",
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="broadcast" size={size} color={color} />
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: "Bibliothèque",
          tabBarIcon: ({ color, size }) => <Ionicons name="library-outline" size={size} color={color} />
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: "Messages",
          tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles-outline" size={size} color={color} />
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profil",
          tabBarIcon: ({ color, size }) => <Ionicons name="person-circle-outline" size={size} color={color} />
        }}
      />
    </Tabs>
  );
}
