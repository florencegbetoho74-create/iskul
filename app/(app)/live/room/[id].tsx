import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { COLOR } from "@/theme/colors";

export default function LiveRoom() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Salle de direct: {id}</Text>
      <Text style={styles.sub}>Lecteur vidéo, chat, levée de main, liste des participants…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLOR.bg, padding: 16 },
  title: { color: COLOR.text, fontSize: 20, fontWeight: "800" },
  sub: { color: COLOR.sub, marginTop: 6 }
});
