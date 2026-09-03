import React from "react";
import { Stack } from "expo-router";
import { useTheme } from "@/theme/ThemeProvider";
import { FONT_FAMILY } from "@/theme/tokens";

export default function PublicLayout() {
  const { color } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: color.bg },
        headerShadowVisible: false,
        headerTintColor: color.text,
        headerTitleStyle: { fontFamily: FONT_FAMILY.headingAlt },
      }}
    />
  );
}
