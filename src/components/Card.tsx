import React from "react";
import { View, StyleSheet, ViewProps } from "react-native";
import { COLOR, ELEVATION, RADIUS, SPACE } from "@/theme/colors";

export default function Card({ style, ...props }: ViewProps) {
  return <View style={[styles.card, style]} {...props} />;
}
const styles = StyleSheet.create({
  card: {
    backgroundColor: COLOR.surface,
    borderRadius: RADIUS.lg,
    padding: SPACE.sm,
    borderWidth: 1,
    borderColor: COLOR.border,
    ...ELEVATION.card,
  }
});
