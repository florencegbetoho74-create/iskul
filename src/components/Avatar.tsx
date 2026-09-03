import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { useThemedStyles } from "@/theme/useStyles";
import type { Theme } from "@/theme/ThemeProvider";

export default function Avatar({ uri, name, size = 72 }: { uri?: string; name?: string; size?: number }) {
  const { styles, theme } = useThemedStyles(makeStyles);
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

const makeStyles = (t: Theme) =>
  StyleSheet.create({
  img: {
    borderWidth: 2,
    borderColor: t.color.border,
    backgroundColor: t.color.surface,
    ...t.elevation(2),
  },
  fallback: {
    backgroundColor: t.color.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: t.color.border,
    ...t.elevation(2),
  },
  txt: { color: t.color.text, fontFamily: t.type.heading.fontFamily, fontSize: 22 }
});
