import React from "react";
import { Stack } from "expo-router";
import { COLOR, FONT } from "@/theme/colors";

export default function PublicLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: COLOR.bg },
        headerShadowVisible: false,
        headerTintColor: COLOR.text,
        headerTitleStyle: { fontFamily: FONT.headingAlt },
      }}
    />
  );
}
