import React from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Book } from "@/types/book";
import { useThemedStyles } from "@/theme/useStyles";
import type { Theme } from "@/theme/ThemeProvider";

type Props = { item: Book; onPress?: () => void };

export default function BookCard({ item, onPress }: Props) {
  const { styles, theme } = useThemedStyles(makeStyles);
  // La bibliotheque est gratuite tant qu'aucun paiement n'est branche : aucun
  // prix n'est encaisse ni ne conditionne l'acces, l'afficher induirait en erreur.
  const priceText = "Gratuit";
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.9} onPress={onPress}>
      <View style={styles.thumbWrap}>
        {item.coverUrl ? (
          <Image source={{ uri: item.coverUrl }} style={styles.thumb} resizeMode="cover" />
        ) : (
          <View style={styles.thumbFallback}>
            <Ionicons name="book" size={24} color={theme.color.textMuted} />
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

const makeStyles = (t: Theme) =>
  StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: t.color.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: t.color.border,
    overflow: "hidden",
    minHeight: 220,
    shadowColor: t.color.shadow,
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  thumbWrap: { height: 120, backgroundColor: t.color.surfaceSunk },
  thumb: { width: "100%", height: "100%" },
  thumbFallback: { flex: 1, alignItems: "center", justifyContent: "center" },
  body: { padding: 12, gap: 6 },
  title: { color: t.color.text, fontFamily: t.type.heading.fontFamily, fontSize: 15 },
  meta: { color: t.color.textMuted, fontSize: 12, fontFamily: t.type.body.fontFamily },
  priceBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(255,255,255,0.9)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: t.color.border,
  },
  priceText: { color: t.color.text, fontSize: 12, fontFamily: t.type.bodyStrong.fontFamily }
});

