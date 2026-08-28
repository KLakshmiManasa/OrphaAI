import React from "react";
import { Text, View, StyleSheet } from "react-native";
import { COLORS } from "./theme";

export function OrphaLogo({ compact = false }) {
  return (
    <View style={styles.logoRow}>
      <View style={styles.logoIcon}>
        <View style={[styles.dot, styles.dotA]} />
        <View style={[styles.dot, styles.dotB]} />
        <View style={[styles.dot, styles.dotC]} />
        <View style={styles.linkA} />
        <View style={styles.linkB} />
        <View style={styles.linkC} />
      </View>
      <Text style={[styles.logoText, compact && styles.logoTextCompact]}>
        Orpha<Text style={styles.logoTextDark}>AI</Text>
      </Text>
    </View>
  );
}

export function Badge({ children, tone = "teal" }) {
  const map = {
    teal: [COLORS.tealBg, COLORS.primary],
    navy: [COLORS.navySoft, COLORS.navy],
    amber: [COLORS.amberBg, COLORS.amber],
    purple: [COLORS.purpleBg, COLORS.purple],
  };
  const [bg, fg] = map[tone] || map.teal;
  return <Text style={[styles.badge, { backgroundColor: bg, color: fg }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logoIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.primary,
    position: "relative",
  },
  dot: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#fff",
    opacity: 0.95,
  },
  dotA: { left: 10, top: 12 },
  dotB: { right: 10, top: 12 },
  dotC: { left: 17, bottom: 9 },
  linkA: { position: "absolute", left: 15, top: 15, width: 13, height: 2, backgroundColor: "#fff", opacity: 0.65 },
  linkB: { position: "absolute", left: 15, top: 21, width: 12, height: 2, backgroundColor: "#fff", opacity: 0.65, transform: [{ rotate: "55deg" }] },
  linkC: { position: "absolute", right: 15, top: 21, width: 12, height: 2, backgroundColor: "#fff", opacity: 0.65, transform: [{ rotate: "-55deg" }] },
  logoText: {
    fontSize: 30,
    fontWeight: "800",
    color: COLORS.primary,
  },
  logoTextCompact: {
    fontSize: 22,
  },
  logoTextDark: {
    color: COLORS.text,
  },
  badge: {
    overflow: "hidden",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    fontSize: 11,
    fontWeight: "800",
  },
});
