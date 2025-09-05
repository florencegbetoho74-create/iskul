import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Link } from "expo-router";
import { COLOR } from "@/theme/colors";

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
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8, marginBottom: 6 },
  title: { color: COLOR.text, fontSize: 16, fontWeight: "800" },
  cta: { color: COLOR.sub, fontWeight: "700", textDecorationLine: "underline" }
});
