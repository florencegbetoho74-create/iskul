import React from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, useWindowDimensions } from "react-native";
import { Link, usePathname } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLOR, FONT } from "@/theme/colors";
import { useAuth } from "@/providers/AuthProvider";

type NavItem = { label: string; href: string; icon: keyof typeof Ionicons.glyphMap };

const NAV_ITEMS: NavItem[] = [
  { label: "Tableau de bord", href: "/(app)/admin", icon: "speedometer-outline" },
  { label: "Utilisateurs", href: "/(app)/admin/users", icon: "people-outline" },
  { label: "Cours", href: "/(app)/admin/courses", icon: "book-outline" },
  { label: "Documents", href: "/(app)/admin/books", icon: "library-outline" },
  { label: "Lives", href: "/(app)/admin/lives", icon: "radio-outline" },
  { label: "Quiz", href: "/(app)/admin/quizzes", icon: "help-circle-outline" },
  { label: "Messages", href: "/(app)/admin/messages", icon: "chatbubbles-outline" },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const pathname = usePathname();
  const { signOut, user } = useAuth();
  const isWide = width >= 1080;

  const renderNavItem = (item: NavItem) => {
    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
    return (
      <Link key={item.href} href={item.href} asChild>
        <Pressable style={[styles.navItem, active && styles.navItemActive]}>
          <Ionicons name={item.icon} size={18} color={active ? COLOR.text : COLOR.sub} />
          <Text style={[styles.navText, active && styles.navTextActive]}>{item.label}</Text>
        </Pressable>
      </Link>
    );
  };

  const contentPadTop = isWide ? 0 : 104;

  return (
    <View style={[styles.root, !isWide && { flexDirection: "column" }]}>
      {isWide ? (
        <View style={styles.sidebar}>
          <View style={styles.brand}>
            <View style={styles.brandDot} />
            <Text style={styles.brandText}>iSkul Admin</Text>
          </View>

          <View style={styles.navList}>
            {NAV_ITEMS.map(renderNavItem)}
          </View>

          <View style={styles.profileCard}>
            <Text style={styles.profileName} numberOfLines={1}>{user?.name || "Admin"}</Text>
            <Text style={styles.profileMeta} numberOfLines={1}>{user?.email || "admin@iskul"}</Text>
            <Pressable style={styles.signOutBtn} onPress={() => signOut?.()}>
              <Ionicons name="log-out-outline" size={16} color={COLOR.text} />
              <Text style={styles.signOutText}>Deconnexion</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.topNav}>
          <View style={styles.topBar}>
            <Text style={styles.brandText}>iSkul Admin</Text>
            <Pressable style={styles.signOutIcon} onPress={() => signOut?.()}>
              <Ionicons name="log-out-outline" size={18} color={COLOR.text} />
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.topNavRow}>
            {NAV_ITEMS.map(renderNavItem)}
          </ScrollView>
        </View>
      )}

      <View style={[styles.content, { paddingTop: contentPadTop }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLOR.bg, flexDirection: "row" },
  sidebar: {
    width: 260,
    padding: 18,
    backgroundColor: COLOR.surface,
    borderRightWidth: 1,
    borderRightColor: COLOR.border,
    gap: 18,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandDot: { width: 12, height: 12, borderRadius: 4, backgroundColor: COLOR.primary },
  brandText: { color: COLOR.text, fontFamily: FONT.headingAlt, fontSize: 16 },
  navList: { gap: 8, marginTop: 8 },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "transparent",
  },
  navItemActive: {
    backgroundColor: COLOR.tint,
    borderColor: COLOR.border,
  },
  navText: { color: COLOR.sub, fontFamily: FONT.bodyBold, fontSize: 13 },
  navTextActive: { color: COLOR.text },
  profileCard: {
    marginTop: "auto",
    backgroundColor: COLOR.bg,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLOR.border,
    gap: 6,
  },
  profileName: { color: COLOR.text, fontFamily: FONT.bodyBold },
  profileMeta: { color: COLOR.sub, fontFamily: FONT.body, fontSize: 12 },
  signOutBtn: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: COLOR.surface,
    borderWidth: 1,
    borderColor: COLOR.border,
  },
  signOutText: { color: COLOR.text, fontFamily: FONT.bodyBold, fontSize: 12 },
  content: { flex: 1, backgroundColor: COLOR.bg },
  topNav: {
    width: "100%",
    borderBottomWidth: 1,
    borderBottomColor: COLOR.border,
    backgroundColor: COLOR.surface,
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 10,
  },
  topBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  signOutIcon: {
    padding: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLOR.border,
    backgroundColor: COLOR.bg,
  },
  topNavRow: {
    paddingHorizontal: 10,
    paddingBottom: 12,
    gap: 8,
  },
});
