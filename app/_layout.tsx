import React from "react";
import { Slot } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ActivityIndicator, View } from "react-native";
import { COLOR } from "@/theme/colors";
import { AuthProvider, useAuth } from "@/providers/AuthProvider";

function Gate({ children }: { children: React.ReactNode }) {
  const { initializing } = useAuth(); // ✅ on est déjà DANS le Provider ci-dessous
  if (initializing) {
    return (
      <View style={{ flex: 1, backgroundColor: COLOR.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }
  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <Gate>
          {/* Rendra les groupes (auth) et (app) */}
          <Slot />
        </Gate>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
