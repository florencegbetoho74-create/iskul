import React from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import * as Clipboard from "expo-clipboard";
import { ChatAttachment } from "@/types/chat";
import { COLOR, FONT } from "@/theme/colors";

export default function ChatBubble({ text, mine, attachments }: { text?: string; mine: boolean; attachments?: ChatAttachment[] }) {
  const onLong = async () => {
    if (!text) return;
    await Clipboard.setStringAsync(text);
    Alert.alert("Copie", "Texte copie dans le presse-papiers.");
  };

  return (
    <View style={[styles.wrap, mine ? styles.right : styles.left]}>
      <TouchableOpacity
        activeOpacity={0.95}
        onLongPress={onLong}
        disabled={!text}
        style={[styles.bubble, mine ? styles.me : styles.other]}
      >
        {!!text && <Text style={[styles.txt, !mine && { color: COLOR.text }]}>{text}</Text>}

        {!!attachments?.length && (
          <View style={{ gap: 8, marginTop: text ? 8 : 0 }}>
            {attachments.map(att => (
              att.mime?.startsWith("image/") ? (
                <TouchableOpacity key={att.id} onPress={() => WebBrowser.openBrowserAsync(att.uri)} activeOpacity={0.9}>
                  <Image source={{ uri: att.uri }} style={styles.img} resizeMode="cover" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity key={att.id} onPress={() => WebBrowser.openBrowserAsync(att.uri)} activeOpacity={0.9} style={styles.fileRow}>
                  <Ionicons name="document-text-outline" size={18} color={mine ? COLOR.text : COLOR.text} />
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={styles.fileName}>{att.name || "Fichier"}</Text>
                    {att.mime ? <Text style={styles.fileMeta}>{att.mime}</Text> : null}
                  </View>
                  <Ionicons name="open-outline" size={18} color={COLOR.sub} />
                </TouchableOpacity>
              )
            ))}
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 8, marginVertical: 4, flexDirection: "row" },
  left: { justifyContent: "flex-start" },
  right: { justifyContent: "flex-end" },
  bubble: { maxWidth: "85%", borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1 },
  me: { backgroundColor: COLOR.primary, borderColor: "transparent" },
  other: { backgroundColor: COLOR.surface, borderColor: COLOR.border },
  txt: { color: "#fff", fontFamily: FONT.body, lineHeight: 20 },

  img: { width: 220, height: 160, borderRadius: 12, backgroundColor: COLOR.muted, borderWidth: 1, borderColor: COLOR.border },
  fileRow: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: COLOR.tint, borderColor: COLOR.border, borderWidth: 1, padding: 10, borderRadius: 12 },
  fileName: { color: COLOR.text, fontFamily: FONT.bodyBold },
  fileMeta: { color: COLOR.sub, fontSize: 12, fontFamily: FONT.body }
});
