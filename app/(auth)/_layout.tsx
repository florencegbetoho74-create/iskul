import React from "react";
import { Stack, Redirect } from "expo-router";
import { useAuth } from "@/providers/AuthProvider";

export default function AuthGroupLayout() {
  const { user, initializing } = useAuth();

  if (initializing) return null;           // on attend l’état d’auth
  if (user) return <Redirect href="/(app)/(tabs)" />;     // si déjà connecté -> app

  return <Stack screenOptions={{ headerShown: false }} />;
}
