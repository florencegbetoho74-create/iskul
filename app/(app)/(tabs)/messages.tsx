import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from "react-native";
import { COLOR } from "@/theme/colors";
import { useAuth } from "@/providers/AuthProvider";
import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import type { Thread } from "@/types/chat";
import { watchInbox, hasUnread } from "@/storage/chat";

export default function Inbox() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Thread[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    const unsub = watchInbox(user.id, (list) => {
      setRows(list);
      setReady(true);
    });
    return () => unsub();
  }, [user?.id]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Messagerie</Text>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        renderItem={({ item }) => {
          const otherName = user?.id === item.teacherId ? (item.studentName || "Élève") : (item.teacherName || "Professeur");
          const unread = hasUnread(item, user!.id);
          return (
            <Link href={`/(app)/messages/${item.id}`} asChild>
              <TouchableOpacity style={styles.thread} activeOpacity={0.85}>
                <View style={styles.avatar}>
                  <Ionicons name="person" size={18} color="#cbd5e1" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={1}>{otherName}</Text>
                  <Text style={styles.meta} numberOfLines={1}>{item.courseTitle || "1:1"}</Text>
                  <Text style={styles.last} numberOfLines={1}>{item.lastText || "—"}</Text>
                </View>
                {unread ? <View style={styles.dot} /> : null}
              </TouchableOpacity>
            </Link>
          );
        }}
        ListEmptyComponent={<Text style={{ color: COLOR.sub, paddingHorizontal: 16 }}>
          {ready ? "Aucune conversation." : "Chargement…"}
        </Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLOR.bg },
  header: { padding: 16, borderBottomColor: "#1F2023", borderBottomWidth: 1 },
  title: { color: COLOR.text, fontSize: 20, fontWeight: "900" },

  thread: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#111214", borderColor: "#1F2023", borderWidth: 1, borderRadius: 14, padding: 12 },
  avatar: { width: 42, height: 42, borderRadius: 999, backgroundColor: "#0b0b0c", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#232428" },
  name: { color: COLOR.text, fontWeight: "900" },
  meta: { color: COLOR.sub, fontSize: 12 },
  last: { color: "#cbd5e1", fontSize: 12, marginTop: 2 },
  dot: { width: 10, height: 10, borderRadius: 999, backgroundColor: "#10b981", marginLeft: 8 }
});
