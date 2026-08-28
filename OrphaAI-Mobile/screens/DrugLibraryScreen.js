import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from "react-native";
import { apiRequest } from "../api";
import { Badge } from "../components";
import { COLORS, shadow } from "../theme";

export default function DrugLibraryScreen({ navigation }) {
  const [query, setQuery] = useState("");
  const [drugs, setDrugs] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadDrugs = async (q = "") => {
    setLoading(true);
    try {
      const payload = await apiRequest(`/drugs?per_page=50&q=${encodeURIComponent(q)}`, {}, navigation);
      setDrugs(payload.drugs || []);
    } catch (error) {
      Alert.alert("Drug Library", error.message || "No verified data available.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDrugs();
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Drug Library</Text>
      <View style={styles.searchRow}>
        <TextInput style={styles.input} value={query} onChangeText={setQuery} placeholder="Search Metformin, Exenatide..." />
        <TouchableOpacity style={styles.button} onPress={() => loadDrugs(query.trim())}><Text style={styles.buttonText}>Search</Text></TouchableOpacity>
      </View>
      {loading && <ActivityIndicator color={COLORS.primary} />}
      {!loading && drugs.length === 0 && <Text style={styles.empty}>No verified data available.</Text>}
      {drugs.map((drug) => (
        <View key={drug.id || drug.name} style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{drug.name || "Not available"}</Text>
            <Badge tone={drug.status === "approved" ? "teal" : "amber"}>{drug.status || "Not available"}</Badge>
          </View>
          <Text style={styles.line}>Class: {drug.drugClass || "Not available"}</Text>
          <Text style={styles.line}>Primary target: {(drug.primaryTargets || [])[0]?.symbol || "Not available"}</Text>
          <Text style={styles.line}>Indication: {drug.indication || "Not available"}</Text>
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
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  cardTitle: { color: COLORS.navy, fontSize: 19, fontWeight: "900", flex: 1 },
  line: { color: COLORS.muted, marginTop: 8, lineHeight: 20 },
  empty: { color: COLORS.muted, textAlign: "center", marginTop: 20 },
});
