import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE, displayName } from "../api";
import { OrphaLogo } from "../components";
import { COLORS, shadow } from "../theme";

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState("demo@orphaai.com");
  const [password, setPassword] = useState("Demo1234");
  const [loading, setLoading] = useState(false);

  const login = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await response.json();
      const token = data.accessToken || data.access_token || data.token;

      if (!response.ok || !token) {
        Alert.alert("Login failed", data.error || "Please check your credentials.");
        return;
      }

      await AsyncStorage.setItem("accessToken", token);
      await AsyncStorage.setItem("userName", displayName(data.user));
      navigation.replace("Dashboard");
    } catch (error) {
      Alert.alert("Error", "Could not connect to OrphaAI backend.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <OrphaLogo />
        <Text style={styles.subtitle}>AI-Powered Drug Repurposing Platform</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Email</Text>
        <TextInput style={styles.input} placeholder="you@example.com" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <Text style={styles.label}>Password</Text>
        <TextInput style={styles.input} placeholder="StrongPass1!" secureTextEntry value={password} onChangeText={setPassword} />
        <TouchableOpacity style={styles.button} onPress={login} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign In</Text>}
        </TouchableOpacity>
        <Text style={styles.demo}>Demo: demo@orphaai.com / Demo1234</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: "center",
    padding: 24,
  },
  hero: {
    alignItems: "center",
    marginBottom: 28,
  },
  subtitle: {
    color: COLORS.muted,
    marginTop: 10,
    fontSize: 16,
    textAlign: "center",
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...shadow,
  },
  label: {
    color: COLORS.muted,
    fontWeight: "700",
    fontSize: 13,
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#fff",
    borderColor: COLORS.border,
    borderWidth: 1,
    padding: 14,
    borderRadius: 10,
    fontSize: 16,
    marginBottom: 14,
  },
  button: {
    backgroundColor: COLORS.primary,
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 4,
  },
  buttonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "800",
  },
  demo: {
    color: COLORS.muted,
    textAlign: "center",
    fontSize: 12,
    marginTop: 14,
  },
});
