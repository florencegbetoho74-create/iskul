import React, { useEffect } from "react";
import { View, ActivityIndicator, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { getCourse } from "@/storage/courses";
import { startThread } from "@/storage/chat";
import { useAuth } from "@/providers/AuthProvider";
import { COLOR } from "@/theme/colors";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function StartMsg() {
  const { courseId } = useLocalSearchParams<{ courseId: string }>();
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    (async () => {
      if (!user || !courseId) return;
      const c = await getCourse(courseId);
      if (!c) return router.back();
      if (!c.ownerId || !UUID_RE.test(c.ownerId)) {
        Alert.alert("Impossible", "Ce cours n'est pas associe a un professeur valide.");
        return router.back();
      }
      try {
        const t = await startThread({
          courseId: c.id,
          courseTitle: c.title,
          studentId: user.id,
          studentName: user.name,
          teacherId: c.ownerId,
          teacherName: c.ownerName,
        });
        router.replace(`/(app)/messages/${t.id}`);
      } catch (e: any) {
        Alert.alert("Erreur", e?.message || "Impossible de demarrer la discussion.");
        router.back();
      }
    })();
  }, [user?.id, courseId]);

  return <View style={{ flex:1, backgroundColor: COLOR.bg, alignItems:"center", justifyContent:"center" }}>
    <ActivityIndicator />
  </View>;
}
