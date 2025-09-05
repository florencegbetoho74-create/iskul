import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { COLOR } from "@/theme/colors";

type Q = { id: string; question: string; choices: string[]; answer: number };
export default function QuizCard({ data }: { data: Q }) {
  const [picked, setPicked] = useState<number | null>(null);
  const [result, setResult] = useState<null | boolean>(null);

  const submit = () => {
    if (picked === null) return;
    setResult(picked === data.answer);
  };

  return (
    <View style={styles.card}>
      <Text style={styles.q}>{data.question}</Text>
      <View style={{ height: 8 }} />
      {data.choices.map((c, idx) => (
        <TouchableOpacity key={idx} style={[styles.choice, picked === idx && styles.choiceActive]} onPress={() => setPicked(idx)}>
          <Text style={[styles.choiceText, picked === idx && styles.choiceTextActive]}>{c}</Text>
        </TouchableOpacity>
      ))}
      <View style={{ height: 12 }} />
      <TouchableOpacity style={styles.submit} onPress={submit}>
        <Text style={styles.submitText}>Valider</Text>
      </TouchableOpacity>
      {result !== null ? (
        <Text style={[styles.feedback, { color: result ? "#10b981" : "#ef4444" }]}>
          {result ? "Bonne réponse ✅" : "Mauvaise réponse ❌"}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: COLOR.card, borderRadius: 16, borderColor: COLOR.border, borderWidth: 1, padding: 14 },
  q: { color: COLOR.text, fontWeight: "800" },
  choice: { borderWidth: 1, borderColor: COLOR.border, borderRadius: 12, padding: 10, marginTop: 8, backgroundColor: "#111214" },
  choiceActive: { borderColor: COLOR.primary, backgroundColor: "#17181b" },
  choiceText: { color: COLOR.sub, fontWeight: "700" },
  choiceTextActive: { color: "#fff" },
  submit: { marginTop: 12, backgroundColor: COLOR.primary, padding: 12, borderRadius: 12, alignItems: "center" },
  submitText: { color: "#fff", fontWeight: "800" },
  feedback: { marginTop: 10, fontWeight: "800" }
});
