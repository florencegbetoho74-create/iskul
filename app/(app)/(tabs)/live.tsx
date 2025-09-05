import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList } from "react-native";
import { COLOR } from "@/theme/colors";
import SectionHeader from "@/components/SectionHeader";
import LiveItem from "@/components/LiveItem";
import { listUpcoming } from "@/storage/lives";

function fmtWhen(ts: number) {
  const d = new Date(ts);
  return d.toLocaleString();
}

export default function LiveTab() {
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const rows = await listUpcoming();
      setItems(rows);
    })();
  }, []);

  return (
    <View style={styles.container}>
      <SectionHeader title="En direct & à venir" />
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        renderItem={({ item }) => (
          <LiveItem item={{ id: item.id, title: item.title, when: fmtWhen(item.startAt), teacher: item.ownerName, status: item.status }} />
        )}
        ListEmptyComponent={<Text style={{ color: COLOR.sub, paddingHorizontal: 16 }}>Aucun direct pour le moment.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLOR.bg, paddingTop: 24 }
});
