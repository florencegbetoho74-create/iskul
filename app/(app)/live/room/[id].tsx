import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { COLOR, FONT } from "@/theme/colors";

export default function LiveRoom() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Salle live {id}</Text>
      <Text style={styles.sub}>Lecteur video, chat, levee de main, participants...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLOR.bg, padding: 16 },
  title: { color: COLOR.text, fontSize: 20, fontFamily: FONT.headingAlt },
  sub: { color: COLOR.sub, marginTop: 6, fontFamily: FONT.body },
});
