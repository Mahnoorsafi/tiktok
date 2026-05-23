import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, Image, Platform,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import { useAuth } from "../context/AuthContext";
import { getTikTokProfile, getTikTokConnectUrl, getMe, disconnectTikTok } from "../api/client";

export default function ProfileScreen() {
  const { user, logout, refreshUser } = useAuth();
  const [tiktok, setTiktok] = useState(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    Promise.allSettled([getTikTokProfile(), getMe()])
      .then(([ttRes, meRes]) => {
        if (ttRes.status === "fulfilled") setTiktok(ttRes.value.data);
        if (meRes.status === "fulfilled") refreshUser(meRes.value.data.user);
      })
      .finally(() => setLoading(false));
  }, []);

  async function connectTikTok() {
    try {
      const res = await getTikTokConnectUrl();
      const authUrl = res.data.auth_url;
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.location.href = authUrl;
        return;
      }
      await WebBrowser.openBrowserAsync(authUrl);
      const [ttRes, meRes] = await Promise.allSettled([getTikTokProfile(), getMe()]);
      if (ttRes.status === "fulfilled") setTiktok(ttRes.value.data);
      if (meRes.status === "fulfilled") refreshUser(meRes.value.data.user);
      if (ttRes.value?.data?.connected) {
        Alert.alert("Connected!", `TikTok @${ttRes.value.data.username} linked successfully.`);
      }
    } catch {
      Alert.alert("Error", "Could not open TikTok auth.");
    }
  }

  async function doDisconnect() {
    setDisconnecting(true);
    try {
      await disconnectTikTok();
      setTiktok({ connected: false });
      refreshUser({ ...user, tiktok_connected: false });
    } catch {
      if (Platform.OS === "web") {
        window.alert("Could not disconnect TikTok. Try again.");
      } else {
        Alert.alert("Error", "Could not disconnect TikTok. Try again.");
      }
    } finally {
      setDisconnecting(false);
    }
  }

  function handleDisconnect() {
    if (Platform.OS === "web") {
      if (window.confirm("Disconnect your TikTok account? You can reconnect anytime.")) doDisconnect();
    } else {
      Alert.alert("Disconnect TikTok", "Disconnect your TikTok account? You can reconnect anytime.", [
        { text: "Cancel", style: "cancel" },
        { text: "Disconnect", style: "destructive", onPress: doDisconnect },
      ]);
    }
  }

  function handleChangeAccount() {
    if (Platform.OS === "web") {
      if (window.confirm("This will disconnect the current TikTok account and open TikTok login. Continue?")) {
        doDisconnect().then(() => connectTikTok());
      }
    } else {
      Alert.alert("Change TikTok Account", "This will disconnect the current account and open TikTok login.", [
        { text: "Cancel", style: "cancel" },
        { text: "Continue", onPress: () => doDisconnect().then(() => connectTikTok()) },
      ]);
    }
  }

  if (loading) {
    return <View style={S.center}><ActivityIndicator color="#fe2c55" size="large" /></View>;
  }

  return (
    <ScrollView style={S.flex} contentContainerStyle={S.container}>
      {/* Account Info */}
      <View style={S.avatarBox}>
        <View style={S.avatar}>
          <Text style={S.avatarText}>{(user?.name || user?.email || "?")[0].toUpperCase()}</Text>
        </View>
        <Text style={S.userName}>{user?.name || "User"}</Text>
        <Text style={S.userEmail}>{user?.email}</Text>
        <View style={[S.roleBadge, user?.role === "admin" && S.adminBadge]}>
          <Text style={S.roleText}>{user?.role || "user"}</Text>
        </View>
      </View>

      {/* TikTok Section */}
      <Text style={S.sectionTitle}>TikTok Account</Text>
      {tiktok?.connected ? (
        <View style={S.tiktokCard}>
          <View style={S.ttHeader}>
            {tiktok.avatar ? (
              <Image source={{ uri: tiktok.avatar }} style={S.ttAvatar} />
            ) : (
              <View style={[S.ttAvatar, S.ttAvatarFallback]}>
                <Text style={S.ttAvatarText}>{(tiktok.username || "T")[0].toUpperCase()}</Text>
              </View>
            )}
            <View style={{ marginLeft: 12 }}>
              <Text style={S.ttHandle}>@{tiktok.username}</Text>
              <View style={S.connectedBadge}>
                <Text style={S.connectedText}>✓ Connected</Text>
              </View>
            </View>
          </View>
          <View style={S.statGrid}>
            <TikTokStat label="Followers" value={tiktok.followers} />
            <TikTokStat label="Following" value={tiktok.following} />
            <TikTokStat label="Likes" value={tiktok.likes} />
            <TikTokStat label="Videos" value={tiktok.videos} />
          </View>
        </View>
      ) : (
        <TouchableOpacity style={S.connectCard} onPress={connectTikTok}>
          <Text style={S.connectIcon}>🔗</Text>
          <Text style={S.connectTitle}>Connect TikTok</Text>
          <Text style={S.connectSub}>Link your TikTok account to start posting</Text>
        </TouchableOpacity>
      )}

      {tiktok?.connected && (
        <View style={S.ttActions}>
          <TouchableOpacity style={S.changeBtn} onPress={handleChangeAccount} disabled={disconnecting}>
            <Text style={S.changeBtnText}>Change Account</Text>
          </TouchableOpacity>
          <TouchableOpacity style={S.disconnectBtn} onPress={handleDisconnect} disabled={disconnecting}>
            {disconnecting ? (
              <ActivityIndicator color="#ef4444" size="small" />
            ) : (
              <Text style={S.disconnectBtnText}>Disconnect</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* App Info */}
      <Text style={S.sectionTitle}>App Info</Text>
      <View style={S.infoCard}>
        <InfoRow label="API Token" value={user?.api_token ? "••••" + user.api_token.slice(-6) : "None"} />
        <InfoRow label="TikTok Connected" value={user?.tiktok_connected ? "Yes" : "No"} />
        <InfoRow label="App Version" value="1.0.0" last />
      </View>

      {/* Logout */}
      <TouchableOpacity style={S.logoutBtn} onPress={() => {
        if (Platform.OS === "web") {
          if (window.confirm("Are you sure you want to logout?")) logout();
        } else {
          Alert.alert("Logout", "Are you sure you want to logout?", [
            { text: "Cancel", style: "cancel" },
            { text: "Logout", style: "destructive", onPress: logout },
          ]);
        }
      }}>
        <Text style={S.logoutText}>Logout</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function TikTokStat({ label, value }) {
  const fmt = (n) => {
    if (!n) return "0";
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
    if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
    return String(n);
  };
  return (
    <View style={S.ttStat}>
      <Text style={S.ttStatValue}>{fmt(value)}</Text>
      <Text style={S.ttStatLabel}>{label}</Text>
    </View>
  );
}

function InfoRow({ label, value, last }) {
  return (
    <View style={[S.infoRow, !last && S.infoBorder]}>
      <Text style={S.infoLabel}>{label}</Text>
      <Text style={S.infoValue}>{value}</Text>
    </View>
  );
}

const S = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#010101" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#010101" },
  container: { padding: 20, paddingBottom: 60 },
  avatarBox: { alignItems: "center", marginBottom: 28 },
  avatar: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: "#fe2c55",
    justifyContent: "center", alignItems: "center", marginBottom: 12,
  },
  avatarText: { color: "#fff", fontSize: 36, fontWeight: "800" },
  userName: { color: "#fff", fontSize: 22, fontWeight: "800", marginBottom: 4 },
  userEmail: { color: "#888", fontSize: 14, marginBottom: 8 },
  roleBadge: { backgroundColor: "#1a1a1a", paddingHorizontal: 14, paddingVertical: 4, borderRadius: 20 },
  adminBadge: { backgroundColor: "#fe2c5522" },
  roleText: { color: "#aaa", fontSize: 12, textTransform: "capitalize" },
  sectionTitle: { color: "#fe2c55", fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 },
  tiktokCard: { backgroundColor: "#111", borderRadius: 16, padding: 16, marginBottom: 12 },
  ttHeader: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  ttAvatar: { width: 60, height: 60, borderRadius: 30 },
  ttAvatarFallback: { backgroundColor: "#fe2c55", justifyContent: "center", alignItems: "center" },
  ttAvatarText: { color: "#fff", fontSize: 24, fontWeight: "800" },
  ttHandle: { color: "#fff", fontSize: 17, fontWeight: "700", marginBottom: 6 },
  statGrid: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  ttStat: { alignItems: "center" },
  ttStatValue: { color: "#fe2c55", fontSize: 18, fontWeight: "800" },
  ttStatLabel: { color: "#888", fontSize: 11, marginTop: 2 },
  connectedBadge: { backgroundColor: "#052e16", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, alignSelf: "flex-start" },
  connectedText: { color: "#22c55e", fontWeight: "700", fontSize: 12 },
  connectCard: {
    backgroundColor: "#111", borderRadius: 16, padding: 24,
    alignItems: "center", marginBottom: 12,
  },
  connectIcon: { fontSize: 32, marginBottom: 8 },
  connectTitle: { color: "#fff", fontSize: 16, fontWeight: "700", marginBottom: 4 },
  connectSub: { color: "#888", fontSize: 13, textAlign: "center" },
  ttActions: { flexDirection: "row", gap: 10, marginBottom: 20 },
  changeBtn: {
    flex: 1, borderWidth: 1, borderColor: "#fe2c55", borderRadius: 12,
    padding: 12, alignItems: "center",
  },
  changeBtnText: { color: "#fe2c55", fontWeight: "600", fontSize: 14 },
  disconnectBtn: {
    flex: 1, borderWidth: 1, borderColor: "#500", borderRadius: 12,
    padding: 12, alignItems: "center",
  },
  disconnectBtnText: { color: "#ef4444", fontWeight: "600", fontSize: 14 },
  infoCard: { backgroundColor: "#111", borderRadius: 16, paddingHorizontal: 16, marginBottom: 20 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14 },
  infoBorder: { borderBottomWidth: 1, borderBottomColor: "#1a1a1a" },
  infoLabel: { color: "#aaa", fontSize: 14 },
  infoValue: { color: "#fff", fontSize: 14, fontWeight: "600" },
  logoutBtn: {
    backgroundColor: "#1a0000", borderWidth: 1, borderColor: "#500",
    borderRadius: 14, padding: 16, alignItems: "center",
  },
  logoutText: { color: "#ef4444", fontWeight: "700", fontSize: 16 },
});
