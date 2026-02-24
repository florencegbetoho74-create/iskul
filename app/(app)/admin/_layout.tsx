// app/(app)/admin/_layout.tsx
import { useEffect } from "react";
import { useRouter, Slot } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { useAuth } from "@/providers/AuthProvider";
import AdminShell from "@/components/admin/AdminShell";
import { COLOR } from "@/theme/colors";

export default function AdminLayout() {
  const { user, canAccessAdmin, initializing } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!initializing && (!user || !canAccessAdmin)) {
      router.replace("/(app)/(tabs)");
    }
  }, [initializing, user, canAccessAdmin, router]);

  if (initializing) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLOR.bg }}>
        <ActivityIndicator color={COLOR.primary} />
      </View>
    );
  }

  return (
    <AdminShell>
      <Slot />
    </AdminShell>
  );
}
