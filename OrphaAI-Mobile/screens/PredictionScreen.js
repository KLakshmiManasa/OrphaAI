import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Linking,
} from "react-native";
import { apiRequest } from "../api";
import { Badge } from "../components";
import { COLORS, shadow } from "../theme";

function show(value) {
  if (!value) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map((v) => show(v)).join(", ");
  if (typeof value === "object") {
    return value.name || value.drug_name || value.label || value.title || "";
  }
  return String(value);
}

export default function PredictionScreen({ route, navigation }) {
  const { disease } = route.params;

  const [loading, setLoading] = useState(true);
  const [currentDrugs, setCurrentDrugs] = useState([]);
  const [repurposedDrugs, setRepurposedDrugs] = useState([]);
  const [resultDisease, setResultDisease] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    loadPredictions();
  }, []);

  const loadPredictions = async () => {
    try {
      const diseaseName = show(disease.name || disease.disease_name || disease.label || disease.title);
      const payload = await apiRequest("/predictions/run", {
        method: "POST",
        body: JSON.stringify({
          disease_name: diseaseName,
          model: "ensemble",
          top_n: 10,
          min_score: 0.15,
        }),
      }, navigation);

      const current =
        payload.currentTreatments ||
        payload.currentlyUsedDrugs ||
        payload.current_drugs ||
        payload.currentDrugs ||
        [];

      const repurposed =
        payload.repurposedPredictions ||
        payload.predictions ||
        payload.repurposed_drugs ||
        payload.results ||
        [];

      setResultDisease(payload.disease || null);
      setCurrentDrugs(Array.isArray(current) ? current : []);
      setRepurposedDrugs(Array.isArray(repurposed) ? repurposed : []);
      if (!current.length && !repurposed.length) {
        setError("No verified repurposing result available.");
      }
    } catch (error) {
      console.log("Prediction error:", error);
      setError("No verified repurposing result available.");
    } finally {
      setLoading(false);
    }
  };

  const diseaseName = show(resultDisease?.name || disease.name || disease.disease_name || disease.label || disease.title);

  const downloadReport = async () => {
    try {
      const pdf = makePredictionPdf(diseaseName, currentDrugs, repurposedDrugs);
      const uri = `data:application/pdf;base64,${base64Encode(pdf)}`;
      const canOpen = await Linking.canOpenURL(uri);
      if (!canOpen) {
        Alert.alert("PDF ready", "Expo Go could not open a local PDF on this device. Please use the website Download PDF Report button for file saving.");
        return;
      }
      await Linking.openURL(uri);
    } catch (error) {
      Alert.alert("Report unavailable", "Could not open the PDF report on this device.");
    }
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#00796B" />
        <Text style={styles.loadingText}>Analyzing repurposing data...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.mainTitle}>Potential Drug Repurposing Predictor</Text>

      <Text style={styles.resultTitle}>
        Results for {diseaseName}
      </Text>
      {(currentDrugs.length > 0 || repurposedDrugs.length > 0) && (
        <TouchableOpacity style={styles.reportButton} onPress={downloadReport}>
          <Text style={styles.reportButtonText}>Download PDF Report</Text>
        </TouchableOpacity>
      )}

      {error && currentDrugs.length === 0 && repurposedDrugs.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>{error}</Text>
        </View>
      ) : (
        <>
          <Text style={styles.sectionTitle}>Currently Used Drugs</Text>

          {currentDrugs.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No current drug data available.</Text>
            </View>
          ) : (
            currentDrugs.map((item, index) => {
              const drugName = show(item.name || item.drug_name || item.drug || item);

              return (
                <View key={index} style={styles.currentCard}>
                  <View style={styles.rxBox}>
                    <Text style={styles.rxText}>Rx</Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.drugName}>{drugName}</Text>
                    <Text style={styles.description}>
                      {show(item.reason) || `Current drug recorded for ${diseaseName} in fallback dataset.`}
                    </Text>
                  </View>

                  <Badge tone={item.isInLocalLibrary ? "teal" : "navy"}>{item.isInLocalLibrary ? "local library" : "standard care"}</Badge>
                </View>
              );
            })
          )}

          <Text style={styles.sectionTitle}>Repurposed Drug Candidates</Text>

          {repurposedDrugs.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No verified repurposing result available.</Text>
            </View>
          ) : (
            repurposedDrugs.map((item, index) => {
          const drugName = show(
            item.drug?.name ||
              item.drugName ||
              item.potential_repurposed_drug ||
              item.repurposed_drug ||
              item.drug_name ||
              item.name
          );

          const confidence = formatConfidence(item);

          const reason =
            item.rationale ||
            item.why_repurposed ||
            item.reason ||
            item.explanation ||
            item.mechanismOfAction ||
            item.mechanism ||
            item.indication;

          const evidence =
            item.algorithmicConfidence ||
            item["Evidence Strength"] ||
            item.evidence_strength ||
            item.evidenceLevel ||
            item.evidence;

          const interactionMode = item.actionType || item.interactionMode || "Dataset-supported repurposing hypothesis";
          const sourceLabel = formatSource(item.source);

          return (
            <View key={index} style={styles.repCard}>
              <View style={styles.repTopRow}>
                <View style={styles.scoreBox}>
                  <Text style={styles.scoreText}>{show(confidence)}</Text>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.repDrug}>{drugName}</Text>
                  <Text style={styles.repReason}>{show(reason)}</Text>
                </View>
              </View>

              <View style={styles.badgeRow}>
                <View style={styles.sourceBadge}>
                  <Text style={styles.sourceText}>{sourceLabel}</Text>
                </View>

                {!!evidence && (
                  <View style={styles.evidenceBadge}>
                    <Text style={styles.evidenceText}>{show(evidence)}</Text>
                  </View>
                )}
              </View>

              <View style={styles.modeBadge}>
                <Text style={styles.modeText}>
                  Predicted Interaction Mode: {show(interactionMode)}
                </Text>
              </View>

              {!!reason && (
                <Text style={styles.mechanism}>
                  Mechanism: {show(reason)}
                </Text>
              )}
            </View>
          );
            })
          )}
        </>
      )}
    </ScrollView>
  );
}

function formatConfidence(item) {
  const raw =
    item.confidencePct ??
    item.confidence ??
    item.score ??
    item.prediction_score ??
    item.scores?.ensemble;
  if (raw === undefined || raw === null || raw === "") return "N/A";
  if (typeof raw === "string") return raw.includes("%") ? raw : `${raw}%`;
  const value = raw <= 1 ? raw * 100 : raw;
  return `${Math.round(value)}%`;
}

function formatSource(source) {
  if (source === "chembl-api") return "ChEMBL API";
  if (source === "open-targets-api") return "Open Targets API";
  if (source === "dataset-fallback") return "Local fallback";
  return source ? show(source) : "Local fallback";
}

function wrapLine(text, max = 78) {
  const words = String(text || "").split(/\s+/);
  const lines = [];
  let line = "";
  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (next.length > max) {
      if (line) lines.push(line);
      line = word;
    } else {
      line = next;
    }
  });
  if (line) lines.push(line);
  return lines;
}

function escapePdfText(text) {
  return String(text || "").replace(/[()\\]/g, "\\$&");
}

function makePdf(lines) {
  const visibleLines = lines.flatMap((line) => wrapLine(line)).slice(0, 48);
  const textOps = visibleLines.map((line, index) => `BT /F1 10 Tf 50 ${770 - index * 15} Td (${escapePdfText(line)}) Tj ET`).join("\n");
  const stream = `${textOps}\n`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}endstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((obj, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return pdf;
}

function makePredictionPdf(diseaseName, currentDrugs, repurposedDrugs) {
  const lines = [
    "OrphaAI Drug Repurposing Report",
    `Disease: ${diseaseName}`,
    `Generated: ${new Date().toLocaleString()}`,
    "",
    "Methodology: Ensemble score using molecular similarity, gene/target network overlap, pathway overlap, and deterministic GNN proxy.",
    "",
    "Currently Used / Standard Drugs:",
    ...(currentDrugs.length ? currentDrugs.map((item, index) => `${index + 1}. ${show(item.name || item.drug_name || item.drug || item)} - ${show(item.reason) || "Current/standard treatment"}`) : ["No current-treatment mapping found in the local curated set."]),
    "",
    "Top Candidate Drugs:",
    ...repurposedDrugs.flatMap((item, index) => [
      `${index + 1}. ${show(item.drug?.name || item.drugName || item.name)} - Confidence ${formatConfidence(item)} - Evidence ${show(item.evidenceLevel || item.algorithmicConfidence || "low")}`,
      `   Molecular weight: ${show(item.drug?.molecularWeight) || "N/A"}; Drug class: ${show(item.drug?.drugClass) || "N/A"}`,
      `   Rationale: ${show(item.rationale || item.mechanismOfAction) || "N/A"}`,
      "",
    ]),
  ];
  return makePdf(lines);
}

function base64Encode(input) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  let output = "";
  let i = 0;
  while (i < input.length) {
    const chr1 = input.charCodeAt(i++);
    const chr2 = input.charCodeAt(i++);
    const chr3 = input.charCodeAt(i++);
    const enc1 = chr1 >> 2;
    const enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
    let enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
    let enc4 = chr3 & 63;
    if (Number.isNaN(chr2)) {
      enc3 = enc4 = 64;
    } else if (Number.isNaN(chr3)) {
      enc4 = 64;
    }
    output += chars.charAt(enc1) + chars.charAt(enc2) + chars.charAt(enc3) + chars.charAt(enc4);
  }
  return output;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: 16,
  },

  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  loadingText: {
    marginTop: 12,
    color: "#555",
    fontSize: 15,
  },

  mainTitle: {
    fontSize: 25,
    fontWeight: "900",
    color: COLORS.navy,
    textAlign: "center",
    marginTop: 10,
    marginBottom: 20,
  },

  resultTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: COLORS.navy,
    marginBottom: 15,
  },
  reportButton: {
    alignSelf: "flex-start",
    borderColor: COLORS.primary,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
    backgroundColor: COLORS.card,
  },
  reportButtonText: {
    color: COLORS.primary,
    fontWeight: "900",
  },

  sectionTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: COLORS.navy,
    textAlign: "center",
    marginTop: 15,
    marginBottom: 10,
  },

  currentCard: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    ...shadow,
  },

  rxBox: {
    backgroundColor: COLORS.navySoft,
    padding: 10,
    borderRadius: 8,
    marginRight: 12,
  },

  rxText: {
    color: COLORS.navy,
    fontWeight: "900",
  },

  drugName: {
    fontSize: 16,
    fontWeight: "900",
    color: COLORS.navy,
  },

  description: {
    fontSize: 13,
    color: "#666",
    marginTop: 5,
  },

  repCard: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...shadow,
  },

  repTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  scoreBox: {
    backgroundColor: COLORS.tealBg,
    padding: 12,
    borderRadius: 8,
    marginRight: 12,
  },

  scoreText: {
    color: COLORS.primary,
    fontWeight: "900",
  },

  repDrug: {
    fontSize: 18,
    fontWeight: "900",
    color: COLORS.navy,
  },

  repReason: {
    fontSize: 13,
    color: "#555",
    marginTop: 5,
  },

  badgeRow: {
    flexDirection: "row",
    marginTop: 12,
    gap: 8,
  },

  sourceBadge: {
    backgroundColor: COLORS.purpleBg,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },

  sourceText: {
    color: COLORS.purple,
    fontSize: 11,
    fontWeight: "bold",
  },

  evidenceBadge: {
    backgroundColor: COLORS.amberBg,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },

  evidenceText: {
    color: COLORS.amber,
    fontSize: 11,
    fontWeight: "bold",
  },

  modeBadge: {
    backgroundColor: COLORS.tealBg,
    padding: 8,
    borderRadius: 6,
    marginTop: 12,
  },

  modeText: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: "bold",
    textAlign: "center",
  },

  mechanism: {
    marginTop: 10,
    fontSize: 12,
    color: "#555",
    textAlign: "center",
  },

  emptyCard: {
    backgroundColor: COLORS.card,
    padding: 18,
    borderRadius: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...shadow,
  },

  emptyTitle: {
    fontSize: 17,
    fontWeight: "bold",
    color: "#D32F2F",
    marginBottom: 6,
  },

  emptyText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },
});
