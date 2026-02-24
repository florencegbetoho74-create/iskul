import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { COLOR, ELEVATION, FONT } from "@/theme/colors";

export default function Avatar({ uri, name, size = 72 }: { uri?: string; name?: string; size?: number }) {
  const initials = (name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map(s => s[0]?.toUpperCase())
    .join("");
  if (uri) {
    return (
      <Image source={{ uri }} style={[styles.img, { width: size, height: size, borderRadius: size / 2 }]} />
    );
  }
  return (
    <View style={[styles.fallback, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={styles.txt}>{initials || "?"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  img: {
    borderWidth: 2,
    borderColor: COLOR.border,
    backgroundColor: COLOR.surface,
    ...ELEVATION.card,
  },
  fallback: {
    backgroundColor: COLOR.tint,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: COLOR.border,
    ...ELEVATION.card,
  },
  txt: { color: COLOR.text, fontFamily: FONT.headingAlt, fontSize: 22 }
});
