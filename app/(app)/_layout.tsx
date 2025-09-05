import React from "react";
import { Stack, Redirect } from "expo-router";
import { useAuth } from "@/providers/AuthProvider";

export default function AppGroupLayout() {
  const { user, initializing } = useAuth();

  if (initializing) return null;           // on attend l’état d’auth
  if (!user) return <Redirect href="/(auth)/sign-in" />;  // si déconnecté -> login

  return <Stack screenOptions={{ headerShown: false }} />;
}
