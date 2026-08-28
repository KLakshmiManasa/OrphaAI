import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLORS, shadow } from "../theme";

export default function InteractionNetworkScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Interaction Network</Text>
        <Text style={styles.text}>
          The mobile interaction network viewer is available as a placeholder in Expo Go. Use the website for the full SVG network with tooltip, confidence filter, and layout switcher.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, padding: 20, justifyContent: "center" },
  card: { backgroundColor: COLORS.card, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, padding: 20, ...shadow },
  title: { color: COLORS.navy, fontSize: 24, fontWeight: "900", marginBottom: 10 },
  text: { color: COLORS.muted, fontSize: 15, lineHeight: 22 },
});
