import React from "react";
import { View, StyleSheet } from "react-native";
import { COLOR } from "@/theme/colors";

export default function ProgressBar({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <View style={styles.track}>
      <View style={[styles.bar, { width: `${v}%` }]} />
    </View>
  );
}
const styles = StyleSheet.create({
  track: { height: 8, borderRadius: 999, backgroundColor: "#1A1B1E", overflow: "hidden" },
  bar: { height: 8, borderRadius: 999, backgroundColor: COLOR.primary }
});
