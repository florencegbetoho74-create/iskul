import React from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity, Alert } from "react-native";
import { COLOR } from "@/theme/colors";
import * as WebBrowser from "expo-web-browser";
import * as Clipboard from "expo-clipboard";
import { Attachment } from "@/types/chat";
import { Ionicons } from "@expo/vector-icons";

export default function ChatBubble({ text, mine, attachments }: { text?: string; mine: boolean; attachments?: Attachment[] }) {
  const onLong = async () => {
    if (!text) return;
    await Clipboard.setStringAsync(text);
    Alert.alert("Copié", "Texte copié dans le presse-papiers.");
  };

  return (
    <View style={[styles.wrap, mine ? styles.right : styles.left]}>
      <TouchableOpacity
        activeOpacity={0.95}
        onLongPress={onLong}
        disabled={!text}
        style={[styles.bubble, mine ? styles.me : styles.other]}
      >
        {!!text && <Text style={styles.txt}>{text}</Text>}

        {!!attachments?.length && (
          <View style={{ gap: 8, marginTop: text ? 8 : 0 }}>
            {attachments.map(att => (
              att.mime?.startsWith("image/") ? (
                <TouchableOpacity key={att.id} onPress={() => WebBrowser.openBrowserAsync(att.uri)} activeOpacity={0.9}>
                  <Image source={{ uri: att.uri }} style={styles.img} resizeMode="cover" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity key={att.id} onPress={() => WebBrowser.openBrowserAsync(att.uri)} activeOpacity={0.9} style={styles.fileRow}>
                  <Ionicons name="document-text-outline" size={18} color="#fff" />
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={styles.fileName}>{att.name || "Fichier"}</Text>
                    {att.mime ? <Text style={styles.fileMeta}>{att.mime}</Text> : null}
                  </View>
                  <Ionicons name="open-outline" size={18} color="#cbd5e1" />
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
  bubble: { maxWidth: "85%", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1 },
  me: { backgroundColor: "#6C5CE7", borderColor: "#5A4ED3" },
  other: { backgroundColor: "#111214", borderColor: "#1F2023" },
  txt: { color: "#fff" },

  img: { width: 220, height: 160, borderRadius: 12, backgroundColor: "#0b0b0c", borderWidth: 1, borderColor: "#2a2b2f" },
  fileRow: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#0f1013", borderColor: "#1F2023", borderWidth: 1, padding: 10, borderRadius: 12 },
  fileName: { color: "#fff", fontWeight: "800" },
  fileMeta: { color: "#cbd5e1", fontSize: 12 }
});
