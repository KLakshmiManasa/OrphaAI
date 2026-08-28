import React, { useState } from "react";
import {
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  View,
} from "react-native";
import { apiRequest } from "../api";
import { Badge } from "../components";
import { COLORS, shadow } from "../theme";

export default function DiseaseSearchScreen({ navigation }) {
  const [query, setQuery] = useState("");
  const [diseases, setDiseases] = useState([]);
  const [loading, setLoading] = useState(false);

  const searchDisease = async () => {
    if (!query.trim()) {
      Alert.alert("Enter disease name", "Please type a disease name first.");
      return;
    }
    setLoading(true);
    setDiseases([]);
    try {
      const payload = await apiRequest(`/diseases?per_page=50&q=${encodeURIComponent(query.trim())}`, {}, navigation);
      const results = payload.diseases || payload.results || payload.items || [];
      setDiseases(Array.isArray(results) && results.length ? results : [{ id: null, name: query.trim(), source: "typed-query" }]);
    } catch (error) {
      Alert.alert("Error", error.message || "Could not connect to OrphaAI backend.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Disease Search</Text>
      <Text style={styles.subtitle}>Search diseases and run the same verified prediction endpoint used by the website.</Text>

      <View style={styles.searchRow}>
        <TextInput style={styles.input} placeholder="Example: Parkinson's Disease" value={query} onChangeText={setQuery} />
        <TouchableOpacity style={styles.button} onPress={searchDisease}>
          <Text style={styles.buttonText}>Search</Text>
        </TouchableOpacity>
      </View>

      {loading && <ActivityIndicator size="large" color={COLORS.primary} />}

      {diseases.map((item, index) => (
        <TouchableOpacity key={`${item.id || item.name}-${index}`} style={styles.card} onPress={() => navigation.navigate("Prediction", { disease: item })}>
          <Text style={styles.cardTitle}>{item.name || item.disease_name || item.title || item.label || "Disease"}</Text>
          <View style={styles.badges}>
            <Badge tone="navy">ID: {item.id || item.disease_id || "Search term"}</Badge>
            {item.isRare || item.is_rare ? <Badge tone="amber">rare</Badge> : null}
          </View>
          <Text style={styles.tapText}>Tap to view repurposed drugs</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 20, paddingBottom: 36 },
  title: { fontSize: 30, fontWeight: "900", color: COLORS.navy, marginTop: 10 },
  subtitle: { fontSize: 15, color: COLORS.muted, marginTop: 6, marginBottom: 18, lineHeight: 22 },
  searchRow: { gap: 10, marginBottom: 20 },
  input: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, padding: 15, borderRadius: 10, fontSize: 16 },
  button: { backgroundColor: COLORS.primary, padding: 15, borderRadius: 10, alignItems: "center" },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "900" },
  card: { backgroundColor: COLORS.card, padding: 16, borderRadius: 14, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border, ...shadow },
  cardTitle: { fontSize: 19, fontWeight: "900", color: COLORS.navy },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  tapText: { fontSize: 14, color: COLORS.primary, fontWeight: "800", marginTop: 12 },
});
