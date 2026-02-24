// app/_layout.tsx

// ✅ MUST be first:
import "react-native-url-polyfill/auto";
import "react-native-get-random-values";

import React from "react";
import { Slot, useRouter, useSegments } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { View, Image, Text, Pressable, Platform } from "react-native";
import { AuthProvider, useAuth } from "@/providers/AuthProvider";
import { useFonts } from "@expo-google-fonts/sora";
import { Sora_600SemiBold, Sora_700Bold } from "@expo-google-fonts/sora";
import { Manrope_500Medium, Manrope_700Bold } from "@expo-google-fonts/manrope";
import { COLOR } from "@/theme/colors";
import * as ScreenOrientation from "expo-screen-orientation";

function Gate({ children, fontsReady }: { children: React.ReactNode; fontsReady: boolean }) {
  const { initializing, user } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const hasSession = !!user;
  const hasExplicitRoute = segments.length > 0;
  const [timedOut, setTimedOut] = React.useState(false);

  React.useEffect(() => {
    console.log("GATE", { fontsLoaded: fontsReady, initializing, hasSession, timedOut, segments });
  }, [fontsReady, initializing, hasSession, timedOut, segments]);

  React.useEffect(() => {
    if (!initializing) {
      setTimedOut(false);
      return;
    }
    const id = setTimeout(() => setTimedOut(true), 4500);
    return () => clearTimeout(id);
  }, [initializing]);

  React.useEffect(() => {
    if (initializing) return;
    if (hasExplicitRoute) return;
    const target = hasSession ? "/(app)/(tabs)" : "/(auth)/sign-in";
    router.replace(target);
  }, [initializing, hasSession, hasExplicitRoute, router]);

  if (initializing) {
    if (timedOut) {
      return (
        <View
          style={{
            flex: 1,
            backgroundColor: COLOR.bg,
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <Image
            source={require("../assets/logo.png")}
            style={{ width: 120, height: 120, resizeMode: "contain" }}
          />
          <Text
            style={{
              marginTop: 16,
              color: COLOR.text,
              fontWeight: "600",
              textAlign: "center",
              lineHeight: 20,
            }}
          >
            Impossible de démarrer l&apos;app. Vérifie ta connexion ou relance.
          </Text>
          <Pressable
            style={{
              marginTop: 14,
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 999,
              backgroundColor: COLOR.primary,
            }}
            onPress={() => {
              console.log("[Auth] retry requested from splash fallback");
              setTimedOut(false);
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>Réessayer</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View
        style={{
          flex: 1,
          backgroundColor: COLOR.bg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Image
          source={require("../assets/logo.png")}
          style={{ width: 140, height: 140, resizeMode: "contain" }}
        />
      </View>
    );
  }

  if (!fontsReady) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: COLOR.bg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: COLOR.text, fontSize: 16 }}>Chargement des polices…</Text>
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Sora_600SemiBold,
    Sora_700Bold,
    Manrope_500Medium,
    Manrope_700Bold,
  });

  React.useEffect(() => {
    if (Platform.OS === "web") return;
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <Gate fontsReady={fontsLoaded}>
          <Slot />
        </Gate>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
