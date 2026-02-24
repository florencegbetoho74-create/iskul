import React, { useState } from "react";
import { View, Text, StyleSheet, Switch, Pressable, Alert, Linking } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";

import { COLOR, FONT } from "@/theme/colors";
import { useAuth } from "@/providers/AuthProvider";

const Row = ({ icon, title, subtitle, right, onPress }: any) => (
  <Pressable onPress={onPress} style={styles.row}>
    {icon}
    <View style={{ flex: 1 }}>
      <Text style={styles.rowTitle}>{title}</Text>
      {subtitle ? <Text style={styles.rowSub}>{subtitle}</Text> : null}
    </View>
    {right}
  </Pressable>
);

export default function Settings() {
  const { user } = useAuth() as any;
  const [notif, setNotif] = useState(true);

  const clearLocal = async () => {
    Alert.alert("Vider le cache", "Effacer les donnees locales (progression, chats, etc.) ?", [
      { text: "Annuler" },
      {
        text: "Oui, effacer",
        style: "destructive",
        onPress: async () => {
          await AsyncStorage.clear();
          Alert.alert("OK", "Cache local vide. Veuillez vous reconnecter.");
        },
      },
    ]);
  };

  const openAdminWeb = async () => {
    const url = String((process.env as any)?.EXPO_PUBLIC_WEB_ADMIN_URL || "http://localhost:5173/admin/login");
    const canOpen = await Linking.canOpenURL(url).catch(() => false);
    if (!canOpen) {
      Alert.alert("Lien indisponible", `Impossible d'ouvrir: ${url}`);
      return;
    }
    await Linking.openURL(url).catch(() => {
      Alert.alert("Erreur", "Ouverture de la console web impossible.");
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Reglages</Text>

      <Row
        icon={<Ionicons name="notifications-outline" size={18} color={COLOR.text} />}
        title="Notifications"
        subtitle="Alertes pour messages et cours publies"
        right={<Switch value={notif} onValueChange={setNotif} />}
      />

      <Row
        icon={<Ionicons name="globe-outline" size={18} color={COLOR.text} />}
        title="Langue"
        subtitle="Francais"
        right={<Text style={styles.rowSub}>FR</Text>}
      />

      <Row
        icon={<Ionicons name="trash-outline" size={18} color={COLOR.danger} />}
        title="Vider le cache local"
        subtitle="Reinitialise les donnees stockees sur cet appareil"
        onPress={clearLocal}
      />

      <Row
        icon={<Ionicons name="speedometer-outline" size={18} color={COLOR.text} />}
        title="Console admin (web)"
        subtitle="Ouvrir la console desktop externe"
        onPress={openAdminWeb}
      />

      <View style={{ marginTop: 18 }}>
        <Text style={styles.caption}>Connecte en tant que</Text>
        <Text style={styles.userLine}>{user?.name} ({user?.role})</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLOR.bg, padding: 16, gap: 10 },
  title: { color: COLOR.text, fontSize: 22, fontFamily: FONT.heading },
  row: {
    backgroundColor: COLOR.surface,
    borderColor: COLOR.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  rowTitle: { color: COLOR.text, fontFamily: FONT.bodyBold },
  rowSub: { color: COLOR.sub, marginTop: 2, fontFamily: FONT.body },
  caption: { color: COLOR.sub, marginBottom: 4, fontFamily: FONT.body },
  userLine: { color: COLOR.text, fontFamily: FONT.bodyBold },
});
