import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { clearSession } from "../api";
import { OrphaLogo } from "../components";
import { COLORS, shadow } from "../theme";

const features = [
  ["Predict / Disease Search", "Search diseases and run verified repurposing predictions.", "Disease Search", "Rx"],
  ["Interaction Network", "Explore drug-target interaction networks.", "Interaction Network", "Nt"],
  ["AI Chatbot", "Ask Orpha biomedical and repurposing questions.", "Chatbot", "AI"],
  ["Drug Library", "Browse approved and investigational drug records.", "Drug Library", "Db"],
  ["Disease Library", "Browse disease records, types, and rare disease status.", "Disease Library", "Ds"],
];

export default function DashboardScreen({ navigation }) {
  const [name, setName] = useState("Dr. Demo Researcher");

  useEffect(() => {
    AsyncStorage.getItem("userName").then((value) => value && setName(value));
  }, []);

  const logout = async () => {
    await clearSession(navigation);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <OrphaLogo compact />
        <View style={styles.profile}>
          <View style={styles.avatar}><Text style={styles.avatarText}>D</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{name}</Text>
            <TouchableOpacity onPress={logout}><Text style={styles.logout}>Logout</Text></TouchableOpacity>
          </View>
        </View>
      </View>

      <Text style={styles.title}>Research Dashboard</Text>
      <Text style={styles.subtitle}>Live public-database lookups, verified dataset fallback, and interpretable repurposing results.</Text>

      <View style={styles.grid}>
        {features.map(([title, body, route, icon]) => (
          <TouchableOpacity key={title} style={styles.card} onPress={() => navigation.navigate(route)}>
            <View style={styles.cardIcon}><Text style={styles.cardIconText}>{icon}</Text></View>
            <Text style={styles.cardTitle}>{title}</Text>
            <Text style={styles.cardText}>{body}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 20, paddingBottom: 36 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 26 },
  profile: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1, justifyContent: "flex-end" },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontWeight: "900" },
  name: { color: COLORS.text, fontWeight: "700", fontSize: 13, textAlign: "right" },
  logout: { color: COLORS.muted, fontWeight: "800", fontSize: 12, textAlign: "right", marginTop: 2 },
  title: { fontSize: 30, fontWeight: "900", color: COLORS.navy },
  subtitle: { fontSize: 15, color: COLORS.muted, lineHeight: 22, marginTop: 6, marginBottom: 18 },
  grid: { gap: 14 },
  card: { backgroundColor: COLORS.card, borderRadius: 14, padding: 18, borderWidth: 1, borderColor: COLORS.border, ...shadow },
  cardIcon: { width: 46, height: 46, borderRadius: 10, backgroundColor: COLORS.tealBg, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  cardIconText: { color: COLORS.primary, fontWeight: "900", fontSize: 17 },
  cardTitle: { fontSize: 19, fontWeight: "900", color: COLORS.navy, marginBottom: 6 },
  cardText: { fontSize: 14, color: COLORS.muted, lineHeight: 20 },
});
