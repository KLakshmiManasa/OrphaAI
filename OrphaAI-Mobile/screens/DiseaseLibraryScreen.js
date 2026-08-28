import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from "react-native";
import { apiRequest } from "../api";
import { Badge } from "../components";
import { COLORS, shadow } from "../theme";

export default function DiseaseLibraryScreen({ navigation }) {
  const [query, setQuery] = useState("");
  const [diseases, setDiseases] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadDiseases = async (q = "") => {
    setLoading(true);
    try {
      const payload = await apiRequest(`/diseases?per_page=50&q=${encodeURIComponent(q)}`, {}, navigation);
      setDiseases(payload.diseases || []);
    } catch (error) {
      Alert.alert("Disease Library", error.message || "No verified data available.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDiseases();
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Disease Library</Text>
      <View style={styles.searchRow}>
        <TextInput style={styles.input} value={query} onChangeText={setQuery} placeholder="Search Parkinson's, ALS..." />
        <TouchableOpacity style={styles.button} onPress={() => loadDiseases(query.trim())}><Text style={styles.buttonText}>Search</Text></TouchableOpacity>
      </View>
      {loading && <ActivityIndicator color={COLORS.primary} />}
      {!loading && diseases.length === 0 && <Text style={styles.empty}>No verified data available.</Text>}
      {diseases.map((disease) => (
        <View key={disease.id || disease.name} style={styles.card}>
          <Text style={styles.cardTitle}>{disease.name || "Not available"}</Text>
          <View style={styles.badges}>
            <Badge tone="purple">{disease.diseaseType || "Not available"}</Badge>
            {disease.isRare ? <Badge tone="amber">rare</Badge> : null}
            <Badge tone="navy">ID: {disease.omimId || disease.efoId || disease.id || "Not available"}</Badge>
          </View>
          <Text style={styles.line}>Category: {disease.diseaseType || "Not available"}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 20, paddingBottom: 36 },
  title: { fontSize: 30, color: COLORS.navy, fontWeight: "900", marginBottom: 16 },
  searchRow: { gap: 10, marginBottom: 16 },
  input: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 14 },
  button: { backgroundColor: COLORS.primary, borderRadius: 10, padding: 14, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "900" },
  card: { backgroundColor: COLORS.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: COLORS.border, marginBottom: 12, ...shadow },
  cardTitle: { color: COLORS.navy, fontSize: 19, fontWeight: "900" },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  line: { color: COLORS.muted, marginTop: 10 },
  empty: { color: COLORS.muted, textAlign: "center", marginTop: 20 },
});
