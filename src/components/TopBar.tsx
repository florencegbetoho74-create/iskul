import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { COLOR } from "@/theme/colors";

type Props = { title?: string; right?: React.ReactNode };
export default function TopBar({ title, right }: Props) {
  const router = useRouter();
  return (
    <View style={styles.bar}>
      <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
        <Ionicons name="arrow-back" size={20} color="#fff" />
      </TouchableOpacity>
      <Text style={styles.title} numberOfLines={1}>{title ?? ""}</Text>
      <View style={styles.right}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  iconBtn: { padding: 8, borderRadius: 999, backgroundColor: "#15161a", borderWidth: 1, borderColor: "#24262a" },
  title: { color: COLOR.text, fontWeight: "800", flex: 1 },
  right: { minWidth: 36, alignItems: "flex-end" }
});
