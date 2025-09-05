import React, { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { getCourse } from "@/storage/courses";
import { getOrCreateThread } from "@/storage/chat";
import { useAuth } from "@/providers/AuthProvider";
import { COLOR } from "@/theme/colors";

export default function StartMsg() {
  const { courseId } = useLocalSearchParams<{ courseId: string }>();
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    (async () => {
      if (!user || !courseId) return;
      const c = await getCourse(courseId);
      if (!c) return router.back();
      const t = await getOrCreateThread({
        courseId: c.id,
        courseTitle: c.title,
        studentId: user.id,
        studentName: user.name,
        teacherId: c.ownerId,
        teacherName: c.ownerName
      });
      router.replace(`/(app)/messages/${t.id}`);
    })();
  }, [user?.id, courseId]);

  return <View style={{ flex:1, backgroundColor: COLOR.bg, alignItems:"center", justifyContent:"center" }}>
    <ActivityIndicator />
  </View>;
}
