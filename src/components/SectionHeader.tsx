import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Link } from "expo-router";
import { COLOR, FONT, RADIUS, SPACE } from "@/theme/colors";

type Props = { title: string; href?: string; cta?: string };
export default function SectionHeader({ title, href, cta = "Voir tout" }: Props) {
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

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACE.xs,
    marginBottom: SPACE.xs,
    gap: SPACE.sm,
  },
  title: { color: COLOR.text, fontSize: 17, fontFamily: FONT.headingAlt, flex: 1 },
  cta: {
    color: COLOR.primary,
    fontFamily: FONT.bodyBold,
    fontSize: 12,
    borderWidth: 1,
    borderColor: COLOR.ring,
    backgroundColor: COLOR.tint,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACE.sm,
    paddingVertical: 5,
    overflow: "hidden",
  }
});
