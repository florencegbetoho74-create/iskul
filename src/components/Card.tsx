import React from "react";
import { View, StyleSheet, ViewProps } from "react-native";
import { COLOR } from "@/theme/colors";

export default function Card({ style, ...props }: ViewProps) {
  return <View style={[styles.card, style]} {...props} />;
}
const styles = StyleSheet.create({
  card: { backgroundColor: COLOR.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: COLOR.border }
});
