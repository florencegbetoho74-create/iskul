import React, { useState } from "react";
import { View, Text, StyleSheet, Switch, TouchableOpacity, Alert } from "react-native";
import { COLOR } from "@/theme/colors";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/providers/AuthProvider";

const Row = ({ icon, title, subtitle, right, onPress }: any) => (
  <TouchableOpacity onPress={onPress} activeOpacity={onPress ? 0.9 : 1} style={styles.row}>
    {icon}
    <View style={{ flex: 1 }}>
      <Text style={styles.rowTitle}>{title}</Text>
      {subtitle ? <Text style={styles.rowSub}>{subtitle}</Text> : null}
    </View>
    {right}
  </TouchableOpacity>
);

export default function Settings() {
  const { user } = useAuth() as any;
  const [notif, setNotif] = useState(true);

  const clearLocal = async () => {
    Alert.alert("Vider le cache", "Effacer les données locales (progression, chats, etc.) ?", [
      { text: "Annuler" },
      { text: "Oui, effacer", style: "destructive", onPress: async () => {
        // ⚠️ efface tout le sandbox AsyncStorage (app iSkul)
        await AsyncStorage.clear();
        Alert.alert("OK", "Cache local vidé. Veuillez vous reconnecter.");
      }}
    ]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Réglages</Text>

      <Row
        icon={<Ionicons name="notifications-outline" size={18} color="#cbd5e1" />}
        title="Notifications"
        subtitle="Alerte nouveaux messages, cours publiés"
        right={<Switch value={notif} onValueChange={setNotif} />}
      />

      <Row
        icon={<Ionicons name="globe-outline" size={18} color="#cbd5e1" />}
        title="Langue"
        subtitle="Français"
      />

      <Row
        icon={<Ionicons name="trash-outline" size={18} color="#e11d48" />}
        title="Vider le cache local"
        subtitle="Réinitialise les données stockées sur cet appareil"
        onPress={clearLocal}
      />

      <View style={{ marginTop: 18 }}>
        <Text style={styles.caption}>Connecté en tant que</Text>
        <Text style={styles.userLine}>{user?.name} ({user?.role})</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLOR.bg, padding: 16, gap: 10 },
  title: { color: COLOR.text, fontSize: 20, fontWeight: "900" },
  row: { backgroundColor: "#111214", borderColor: "#1F2023", borderWidth: 1, borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  rowTitle: { color: "#fff", fontWeight: "800" },
  rowSub: { color: COLOR.sub, marginTop: 2 },
  caption: { color: COLOR.sub, marginBottom: 4 },
  userLine: { color: COLOR.text, fontWeight: "800" }
});
