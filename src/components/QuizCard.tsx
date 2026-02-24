import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { COLOR, FONT } from "@/theme/colors";

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
        <Text style={[styles.feedback, { color: result ? COLOR.success : COLOR.danger }]}>
          {result ? "Bonne reponse" : "Mauvaise reponse"}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLOR.surface,
    borderRadius: 18,
    borderColor: COLOR.border,
    borderWidth: 1,
    padding: 14,
    shadowColor: "#0B1D39",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  q: { color: COLOR.text, fontFamily: FONT.headingAlt },
  choice: { borderWidth: 1, borderColor: COLOR.border, borderRadius: 12, padding: 10, marginTop: 8, backgroundColor: COLOR.surface },
  choiceActive: { borderColor: COLOR.primary, backgroundColor: "rgba(29,78,216,0.08)" },
  choiceText: { color: COLOR.sub, fontFamily: FONT.bodyBold },
  choiceTextActive: { color: COLOR.text },
  submit: { marginTop: 12, backgroundColor: COLOR.primary, padding: 12, borderRadius: 12, alignItems: "center" },
  submitText: { color: "#fff", fontFamily: FONT.bodyBold },
  feedback: { marginTop: 10, fontFamily: FONT.bodyBold }
});

