// (Optionnel si déjà au root) — peut rester sans ces imports
import React from "react";
import { Stack, Redirect } from "expo-router";
import { useAuth } from "@/providers/AuthProvider";

export default function AppGroupLayout() {
  const { user, initializing } = useAuth();

  if (initializing) return null;
  if (!user) return <Redirect href="/(auth)/sign-in" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
