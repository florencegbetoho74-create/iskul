import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from "react-native";
import { COLOR } from "@/theme/colors";
import { useAuth } from "@/providers/AuthProvider";
import { useRouter } from "expo-router";
import { Course } from "@/types/course";
import { watchCoursesOrdered } from "@/storage/courses";
import CourseItem from "@/components/CourseItem";
import SectionHeader from "@/components/SectionHeader";
import QuickAction from "@/components/QuickAction";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

export default function Home() {
  const { user } = useAuth();
  const router = useRouter();
  const isTeacher = user?.role === "teacher";
  const [all, setAll] = useState<Course[]>([]);

  // Temps réel: derniers cours (server orderBy updatedAtMs) -> filtrage client
  useEffect(() => {
    const unsub = watchCoursesOrdered(setAll, 100);
    return () => unsub();
  }, []);

  const recent = useMemo(() => {
    if (!user) return [];
    return isTeacher
      ? all.filter(c => c.ownerId === user.id).slice(0, 6)
      : all.filter(c => c.published).slice(0, 6);
  }, [all, user?.id, isTeacher]);

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Hello, {user?.name} 👋</Text>

      {isTeacher ? (
        <View style={{ gap: 10, paddingHorizontal: 16 }}>
          <SectionHeader title="Actions rapides" />
          <View style={styles.actionsRow}>
            <QuickAction label="Créer un cours" left={<Ionicons name="add-circle" size={18} color={COLOR.text} />} onPress={() => router.push("/(app)/course/new")} />
            <QuickAction label="Mes cours" left={<Ionicons name="folder-open-outline" size={18} color={COLOR.text} />} onPress={() => router.push("/(app)/course/mine")} />
            <QuickAction label="Programmer un live" left={<MaterialCommunityIcons name="calendar-clock" size={18} color={COLOR.text} />} onPress={() => { /* later */ }} />
          </View>
        </View>
      ) : null}

      <View style={{ paddingHorizontal: 16, marginTop: 6 }}>
        <SectionHeader title={isTeacher ? "Vos cours récents" : "Cours récents"} href="/(app)/(tabs)/courses" />
      </View>

      <FlatList
        data={recent}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 120 }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => <CourseItem item={item} />}
        ListEmptyComponent={<Text style={{ color: COLOR.sub, paddingHorizontal: 16 }}>{isTeacher ? "Créez un cours pour commencer." : "Aucun cours disponible pour l’instant."}</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLOR.bg },
  heading: { color: COLOR.text, fontSize: 22, fontWeight: "800", margin: 16, marginBottom: 8 },
  actionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 }
});
