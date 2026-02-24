import React from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Book } from "@/types/book";
import { COLOR, FONT } from "@/theme/colors";

type Props = { item: Book; onPress?: () => void };

export default function BookCard({ item, onPress }: Props) {
  const priceText = !item.price ? "Gratuit" : `${item.price} FCFA`;
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.9} onPress={onPress}>
      <View style={styles.thumbWrap}>
        {item.coverUrl ? (
          <Image source={{ uri: item.coverUrl }} style={styles.thumb} resizeMode="cover" />
        ) : (
          <View style={styles.thumbFallback}>
            <Ionicons name="book" size={24} color={COLOR.sub} />
          </View>
        )}
        <View style={styles.priceBadge}><Text style={styles.priceText}>{priceText}</Text></View>
      </View>
      <View style={styles.body}>
        <Text numberOfLines={2} style={styles.title}>{item.title}</Text>
        <Text numberOfLines={1} style={styles.meta}>{item.subject || "Sujet ?"} - {item.level || "Niveau ?"}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: COLOR.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLOR.border,
    overflow: "hidden",
    minHeight: 220,
    shadowColor: "#0B1D39",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  thumbWrap: { height: 120, backgroundColor: COLOR.muted },
  thumb: { width: "100%", height: "100%" },
  thumbFallback: { flex: 1, alignItems: "center", justifyContent: "center" },
  body: { padding: 12, gap: 6 },
  title: { color: COLOR.text, fontFamily: FONT.headingAlt, fontSize: 15 },
  meta: { color: COLOR.sub, fontSize: 12, fontFamily: FONT.body },
  priceBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(255,255,255,0.9)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLOR.border,
  },
  priceText: { color: COLOR.text, fontSize: 12, fontFamily: FONT.bodyBold }
});

