import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import { useAuth } from "../context/AuthContext";
import { getTikTokLoginMobileUrl } from "../api/client";

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ttLoading, setTtLoading] = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Error", "Please enter email and password.");
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      const msg = err.response?.data?.error || "Login failed. Check your credentials.";
      Alert.alert("Login Failed", msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleTikTokLogin() {
    setTtLoading(true);
    try {
      const res = await getTikTokLoginMobileUrl();
      const authUrl = res.data?.auth_url;
      if (!authUrl) {
        Alert.alert("Error", "Backend did not return a TikTok URL. Restart Flask.");
        return;
      }
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.location.href = authUrl;
        return;
      }
      await WebBrowser.openBrowserAsync(authUrl);
    } catch (err) {
      const status = err.response?.status;
      const msg =
        status === 404
          ? "TikTok login endpoint not found.\n\nRestart Flask:\npython smca_flask_backend.py"
          : status === 401 || status === 403
          ? "Auth error. Restart Flask and try again."
          : err.message?.includes("Network")
          ? "Cannot reach Flask backend.\nMake sure it is running on port 5000."
          : `Error ${status || ""}: ${err.response?.data?.error || err.message || "Unknown error"}`;
      Alert.alert("TikTok Login Failed", msg);
    } finally {
      setTtLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={S.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={S.container} keyboardShouldPersistTaps="handled">
        <Text style={S.logo}>SMCA</Text>
        <Text style={S.subtitle}>TikTok Campaign Automation</Text>

        {/* TikTok Login Button */}
        <TouchableOpacity
          style={[S.tiktokBtn, ttLoading && S.btnDisabled]}
          onPress={handleTikTokLogin}
          disabled={ttLoading}
        >
          {ttLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={S.tiktokIcon}>♪</Text>
              <Text style={S.tiktokBtnText}>Continue with TikTok</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Divider */}
        <View style={S.divider}>
          <View style={S.dividerLine} />
          <Text style={S.dividerText}>or sign in with email</Text>
          <View style={S.dividerLine} />
        </View>

        <View style={S.card}>
          <Text style={S.label}>Email</Text>
          <TextInput
            style={S.input}
            placeholder="you@example.com"
            placeholderTextColor="#555"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />

          <Text style={S.label}>Password</Text>
          <TextInput
            style={S.input}
            placeholder="••••••••"
            placeholderTextColor="#555"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <TouchableOpacity
            style={[S.btn, loading && S.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={S.btnText}>Sign In</Text>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => navigation.navigate("Register")}>
          <Text style={S.link}>Don't have an account? <Text style={S.linkAccent}>Sign up</Text></Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const S = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#010101" },
  container: { flexGrow: 1, justifyContent: "center", padding: 24 },
  logo: { fontSize: 42, fontWeight: "900", color: "#fe2c55", textAlign: "center", marginBottom: 4 },
  subtitle: { fontSize: 13, color: "#888", textAlign: "center", marginBottom: 32 },

  tiktokBtn: {
    backgroundColor: "#010101", borderWidth: 2, borderColor: "#fe2c55",
    borderRadius: 14, padding: 16, flexDirection: "row",
    alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 20,
  },
  tiktokIcon: { fontSize: 22, color: "#fe2c55", fontWeight: "900" },
  tiktokBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },

  divider: { flexDirection: "row", alignItems: "center", marginBottom: 20, gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#222" },
  dividerText: { color: "#555", fontSize: 12 },

  card: { backgroundColor: "#111", borderRadius: 16, padding: 24, marginBottom: 24 },
  label: { color: "#aaa", fontSize: 13, marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: "#1a1a1a", color: "#fff", borderRadius: 10,
    padding: 14, fontSize: 15, borderWidth: 1, borderColor: "#333",
  },
  btn: {
    backgroundColor: "#fe2c55", borderRadius: 12, padding: 16,
    alignItems: "center", marginTop: 24,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  link: { color: "#888", textAlign: "center", fontSize: 14 },
  linkAccent: { color: "#fe2c55", fontWeight: "600" },
});
