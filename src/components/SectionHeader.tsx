import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Link } from "expo-router";
import { useThemedStyles } from "@/theme/useStyles";
import type { Theme } from "@/theme/ThemeProvider";

type Props = { title: string; href?: string; cta?: string };
export default function SectionHeader({ title, href, cta = "Voir tout" }: Props) {
  const { styles, theme } = useThemedStyles(makeStyles);
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      {href ? (
        <Link href={href} asChild>
          <TouchableOpacity><Text style={styles.cta}>{cta}</Text></TouchableOpacity>
        </Link>
      ) : null}
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: t.space.sm,
    marginBottom: t.space.sm,
    gap: t.space.md,
  },
  title: { color: t.color.text, fontSize: 17, fontFamily: t.type.heading.fontFamily, flex: 1 },
  cta: {
    color: t.color.primary,
    fontFamily: t.type.bodyStrong.fontFamily,
    fontSize: 12,
    borderWidth: 1,
    borderColor: t.color.borderStrong,
    backgroundColor: t.color.primarySoft,
    borderRadius: t.radius.pill,
    paddingHorizontal: t.space.md,
    paddingVertical: 5,
    overflow: "hidden",
  }
});
