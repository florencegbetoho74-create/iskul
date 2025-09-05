import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from "react-native";
import { COLOR } from "@/theme/colors";
import Avatar from "@/components/Avatar";
import { useAuth } from "@/providers/AuthProvider";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getProfile } from "@/storage/profile";
import { listByOwner } from "@/storage/courses";
import { listMine } from "@/storage/lives";
import { listBooksByOwner } from "@/storage/books";
import { listRecentProgress } from "@/storage/progress";
import { listPurchased } from "@/storage/purchases";
import { listThreadsForUser } from "@/storage/chat";

export default function ProfileTab() {
  const { user, signOut } = useAuth() as any;
  const router = useRouter();
  const [prof, setProf] = useState<any | null>(null);
  const [stats, setStats] = useState<{label: string; value: number}[]>([]);

  const refresh = useCallback(async () => {
    if (!user) return;
    const p = await getProfile(user.id);
    setProf(p);

    if (user.role === "teacher") {
      const courses = await listByOwner(user.id);
      const lives = await listMine(user.id);
      const books = await listBooksByOwner(user.id);
      setStats([
        { label: "Cours", value: courses.length },
        { label: "Lives", value: lives.length },
        { label: "Livres", value: books.length }
      ]);
    } else {
      const prog = await listRecentProgress(user.id, 1000);
      const bought = await listPurchased(user.id);
      const threads = await listThreadsForUser(user.id, "student");
      const unread = threads.reduce((s, t) => s + (t.unreadForStudent || 0), 0);
      setStats([
        { label: "Leçons suivies", value: prog.length },
        { label: "Mes livres", value: bought.length },
        { label: "Non lus", value: unread }
      ]);
    }
  }, [user?.id, user?.role]);

  useFocusEffect(React.useCallback(() => { refresh(); }, [refresh]));
  useEffect(() => { refresh(); }, [refresh]);

  if (!user) return null;

  const displayName = prof?.name || user.name;
  const subtitle = user.role === "teacher"
    ? (prof?.subjects?.length ? `Prof • ${prof.subjects.join(", ")}` : "Professeur")
    : (prof?.grade ? `Élève • ${prof.grade}` : "Élève");

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Avatar uri={prof?.avatarUrl} name={displayName} size={76} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.sub}>{subtitle}</Text>
          {prof?.school ? <Text style={styles.sub}>{prof.school}</Text> : null}
        </View>
      </View>

      {prof?.bio ? <Text style={styles.bio}>{prof.bio}</Text> : null}

      <View style={styles.row}>
        <TouchableOpacity style={styles.primary} onPress={() => router.push("/(app)/profile/edit")}>
          <Ionicons name="create-outline" size={18} color="#fff" />
          <Text style={styles.primaryTxt}>Modifier le profil</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondary} onPress={() => router.push("/(app)/profile/settings")}>
          <Ionicons name="settings-outline" size={18} color="#cbd5e1" />
          <Text style={styles.secondaryTxt}>Réglages</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.section}>Mes stats</Text>
      <FlatList
        data={stats}
        keyExtractor={(i) => i.label}
        numColumns={3}
        columnWrapperStyle={{ gap: 10, paddingHorizontal: 16 }}
        contentContainerStyle={{ gap: 10 }}
        renderItem={({ item }) => (
          <View style={styles.statCard}>
            <Text style={styles.statVal}>{item.value}</Text>
            <Text style={styles.statLbl}>{item.label}</Text>
          </View>
        )}
      />

      <View style={{ height: 14 }} />
      <TouchableOpacity
        style={styles.logout}
        onPress={() => signOut ? signOut() : null}
        activeOpacity={0.9}
      >
        <Ionicons name="log-out-outline" size={18} color="#fff" />
        <Text style={styles.logoutTxt}>Se déconnecter</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLOR.bg, padding: 24, gap: 12 },
  header: { flexDirection: "row", gap: 12, alignItems: "center" },
  name: { color: COLOR.text, fontSize: 20, fontWeight: "900" },
  sub: { color: COLOR.sub },
  bio: { color: COLOR.text, backgroundColor: "#111214", borderColor: "#1F2023", borderWidth: 1, borderRadius: 12, padding: 12 },
  row: { flexDirection: "row", gap: 10 },
  primary: { backgroundColor: COLOR.primary, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, flexDirection: "row", gap: 8, alignItems: "center" },
  primaryTxt: { color: "#fff", fontWeight: "800" },
  secondary: { backgroundColor: "#111214", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, flexDirection: "row", gap: 8, alignItems: "center", borderWidth: 1, borderColor: "#1F2023" },
  secondaryTxt: { color: "#cbd5e1", fontWeight: "800" },
  section: { color: COLOR.text, fontWeight: "800", marginTop: 8, paddingHorizontal: 4 },
  statCard: { flex: 1, backgroundColor: "#111214", borderColor: "#1F2023", borderWidth: 1, borderRadius: 12, padding: 14, alignItems: "center" },
  statVal: { color: "#fff", fontWeight: "900", fontSize: 18 },
  statLbl: { color: COLOR.sub, marginTop: 4 },
  logout: { backgroundColor: "#e11d48", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" },
  logoutTxt: { color: "#fff", fontWeight: "800" }
});
