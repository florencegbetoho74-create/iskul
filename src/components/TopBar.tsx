import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLOR, ELEVATION, FONT, RADIUS, SPACE } from "@/theme/colors";

type Props = { title?: string; right?: React.ReactNode };
export default function TopBar({ title, right }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingTop: insets.top + 10 }]}>
      <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
        <Ionicons name="arrow-back" size={20} color={COLOR.text} />
      </TouchableOpacity>
      <Text style={styles.title} numberOfLines={1}>{title ?? ""}</Text>
      <View style={styles.right}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACE.md,
    paddingBottom: SPACE.xs,
    gap: SPACE.xs,
    backgroundColor: "rgba(244,247,252,0.92)",
    borderBottomWidth: 1,
    borderBottomColor: COLOR.border,
    ...ELEVATION.card,
  },
  iconBtn: {
    padding: 9,
    borderRadius: RADIUS.md,
    backgroundColor: COLOR.surface,
    borderWidth: 1,
    borderColor: COLOR.border,
    minWidth: 40,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: COLOR.text, fontFamily: FONT.headingAlt, fontSize: 17, flex: 1 },
  right: { minWidth: 36, alignItems: "flex-end" }
});

