import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from "react-native";
import { apiRequest } from "../api";
import { OrphaLogo } from "../components";
import { COLORS, shadow } from "../theme";

const quickPrompts = [
  "Suggest drugs for Parkinson's",
  "Why was Exenatide suggested?",
  "Explain drug repurposing",
  "What is ChEMBL?",
];

export default function ChatbotScreen({ navigation }) {
  const [messages, setMessages] = useState([
    { role: "assistant", text: "Hi, I'm Orpha - your drug repurposing research companion. Tell me about a disease, target, or mechanism and let's find candidates together." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const sendMessage = async (text = input) => {
    const current = text.trim();
    if (!current || loading) return;
    const history = messages.filter((m) => m.role === "user" || m.role === "assistant").map((m) => ({ role: m.role, content: m.text }));
    setMessages((prev) => [...prev, { role: "user", text: current }]);
    setInput("");
    setLoading(true);
    try {
      const payload = await apiRequest("/chat/message", {
        method: "POST",
        body: JSON.stringify({ message: current, history }),
      }, navigation);
      setMessages((prev) => [...prev, { role: "assistant", text: payload.content || payload.reply || "No response received." }]);
    } catch (error) {
      setMessages((prev) => [...prev, { role: "assistant", text: "I could not reach the OrphaAI assistant right now. Please try again shortly." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <OrphaLogo compact />
        <Text style={styles.title}>OrphaAI Biomedical Assistant</Text>
      </View>

      <ScrollView style={styles.chat} contentContainerStyle={styles.chatContent}>
        {messages.map((msg, index) => {
          const isUser = msg.role === "user";
          return (
            <View key={index} style={[styles.bubbleRow, isUser && styles.userRow]}>
              {!isUser && <View style={styles.botAvatar}><Text style={styles.botAvatarText}>O</Text></View>}
              <Text style={[styles.bubble, isUser ? styles.userBubble : styles.botBubble]}>{msg.text}</Text>
            </View>
          );
        })}
        {loading && <ActivityIndicator color={COLORS.primary} />}
      </ScrollView>

      <View style={styles.quickRow}>
        {quickPrompts.map((prompt) => (
          <TouchableOpacity key={prompt} style={styles.quickChip} onPress={() => sendMessage(prompt)}>
            <Text style={styles.quickText}>{prompt}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.inputRow}>
        <TextInput style={styles.input} value={input} onChangeText={setInput} placeholder="Ask about a drug, disease, or mechanism..." />
        <TouchableOpacity style={styles.sendButton} onPress={() => sendMessage()}>
          <Text style={styles.sendText}>Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, padding: 16 },
  header: { backgroundColor: COLORS.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: COLORS.border, ...shadow },
  title: { marginTop: 8, color: COLORS.navy, fontSize: 18, fontWeight: "900" },
  chat: { flex: 1, marginVertical: 12 },
  chatContent: { paddingBottom: 8 },
  bubbleRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 10 },
  userRow: { justifyContent: "flex-end" },
  botAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.tealBg, alignItems: "center", justifyContent: "center" },
  botAvatarText: { color: COLORS.primary, fontWeight: "900" },
  bubble: { maxWidth: "78%", padding: 12, borderRadius: 10, lineHeight: 20, overflow: "hidden" },
  botBubble: { backgroundColor: COLORS.card, color: COLORS.text, borderWidth: 1, borderColor: COLORS.border },
  userBubble: { backgroundColor: COLORS.primary, color: "#fff" },
  quickRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  quickChip: { backgroundColor: COLORS.navySoft, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8 },
  quickText: { color: COLORS.navy, fontSize: 12, fontWeight: "800" },
  inputRow: { flexDirection: "row", gap: 8 },
  input: { flex: 1, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 12 },
  sendButton: { backgroundColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 16, justifyContent: "center" },
  sendText: { color: "#fff", fontWeight: "900" },
});
