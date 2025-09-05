import React from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity } from "react-native";
import { COLOR } from "@/theme/colors";
import { Ionicons } from "@expo/vector-icons";
import type { Book } from "@/types/book";

type Props = { item: Book; onPress?: () => void };

export default function BookCard({ item, onPress }: Props) {
  const priceText = !item.price ? "Gratuit" : `${item.price} FCFA`;
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.9} onPress={onPress}>
      <View style={styles.thumbWrap}>
        {item.coverUrl ? (
          <Image source={{ uri: item.coverUrl }} style={styles.thumb} />
        ) : (
          <View style={styles.thumbFallback}>
            <Ionicons name="book" size={22} color="#cbd5e1" />
          </View>
        )}
        <View style={styles.priceBadge}><Text style={styles.priceText}>{priceText}</Text></View>
      </View>
      <View style={styles.body}>
        <Text numberOfLines={2} style={styles.title}>{item.title}</Text>
        <Text numberOfLines={1} style={styles.meta}>{item.subject} • {item.level}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, backgroundColor: "#111214", borderRadius: 14, borderWidth: 1, borderColor: "#1F2023", overflow: "hidden", minHeight: 220 },
  thumbWrap: { height: 120, backgroundColor: "#0b0b0c" },
  thumb: { width: "100%", height: "100%" },
  thumbFallback: { flex: 1, alignItems: "center", justifyContent: "center" },
  body: { padding: 10, gap: 6 },
  title: { color: COLOR.text, fontWeight: "900" },
  meta: { color: COLOR.sub, fontSize: 12 },
  priceBadge: { position: "absolute", top: 6, right: 6, backgroundColor: "rgba(0,0,0,0.65)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  priceText: { color: "#fff", fontSize: 12, fontWeight: "900" }
});
