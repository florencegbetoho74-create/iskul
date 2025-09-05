import React from "react";
import { Stack } from "expo-router";

export default function PublicLayout() {
  return <Stack screenOptions={{ headerStyle: { backgroundColor: "#0B0B0C" }, headerTintColor: "#fff" }} />;
}
