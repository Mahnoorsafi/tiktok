import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  TouchableOpacity, ActivityIndicator, Alert, Image, Platform,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { getAnalyticsSummary, getAnalyticsWeekly, getTikTokProfile, getTikTokConnectUrl } from "../api/client";
import * as WebBrowser from "expo-web-browser";
import { BASE_URL } from "../api/client";

export default function DashboardScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [summary, setSummary] = useState(null);
  const [weekly, setWeekly] = useState([]);
  const [tiktok, setTiktok] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [sRes, wRes, tRes] = await Promise.allSettled([
        getAnalyticsSummary(),
        getAnalyticsWeekly(),
        getTikTokProfile(),
      ]);
      if (sRes.status === "fulfilled") setSummary(sRes.value.data);
      if (wRes.status === "fulfilled") setWeekly(wRes.value.data.days || []);
      if (tRes.status === "fulfilled") setTiktok(tRes.value.data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function connectTikTok() {
    try {
      const res = await getTikTokConnectUrl();
      const authUrl = res.data.auth_url;
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.location.href = authUrl;
        return;
      }
      await WebBrowser.openBrowserAsync(authUrl);
      const ttRes = await getTikTokProfile();
      setTiktok(ttRes.data);
      if (ttRes.data?.connected) {
        Alert.alert("Connected!", `TikTok account @${ttRes.data.username} linked.`);
      }
    } catch (err) {
      Alert.alert("Error", "Could not open TikTok auth.");
    }
  }

  if (loading) {
    return (
      <View style={[S.flex, S.center]}>
        <ActivityIndicator color="#fe2c55" size="large" />
      </View>
    );
  }

  const maxCount = Math.max(...weekly.map((d) => d.count), 1);

  return (
    <ScrollView
      style={S.flex}
      contentContainerStyle={S.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fe2c55" />}
    >
      {/* Header */}
      <View style={S.header}>
        <View>
          <Text style={S.greeting}>Hey, {user?.name || user?.email?.split("@")[0]} 👋</Text>
          <Text style={S.subGreeting}>Your TikTok campaign dashboard</Text>
        </View>
        <TouchableOpacity onPress={logout} style={S.logoutBtn}>
          <Text style={S.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* TikTok Connection Card */}
      {tiktok?.connected ? (
        <View style={S.tiktokCard}>
          <View style={S.ttRow}>
            {tiktok.avatar ? (
              <Image source={{ uri: tiktok.avatar }} style={S.ttAvatar} />
            ) : (
              <View style={[S.ttAvatar, S.ttAvatarFallback]}>
                <Text style={S.ttAvatarText}>{(tiktok.username || "T")[0].toUpperCase()}</Text>
              </View>
            )}
            <Text style={S.tiktokUsername}>@{tiktok.username}</Text>
          </View>
          <View style={S.statRow}>
            <StatPill label="Followers" value={fmt(tiktok.followers)} />
            <StatPill label="Following" value={fmt(tiktok.following)} />
            <StatPill label="Likes" value={fmt(tiktok.likes)} />
            <StatPill label="Videos" value={fmt(tiktok.videos)} />
          </View>
        </View>
      ) : (
        <TouchableOpacity style={S.connectCard} onPress={connectTikTok}>
          <Text style={S.connectTitle}>Connect TikTok Account</Text>
          <Text style={S.connectSub}>Tap to link your TikTok and start posting</Text>
        </TouchableOpacity>
      )}

      {/* Post Status Summary */}
      {summary && (
        <View style={S.section}>
          <Text style={S.sectionTitle}>Post Status</Text>
          <View style={S.statGrid}>
            <StatusCard label="Scheduled" value={summary.scheduled_count} color="#f59e0b" />
            <StatusCard label="Published" value={summary.published_count} color="#22c55e" />
            <StatusCard label="Failed" value={summary.failed_count} color="#ef4444" />
            <StatusCard label="Drafts" value={summary.draft_count} color="#6366f1" />
          </View>
        </View>
      )}

      {/* Analytics Summary */}
      {summary && (
        <View style={S.section}>
          <Text style={S.sectionTitle}>Overall Performance</Text>
          <View style={S.statGrid}>
            <StatCard label="Views" value={fmt(summary.total_views)} icon="👁" />
            <StatCard label="Likes" value={fmt(summary.total_likes)} icon="❤️" />
            <StatCard label="Comments" value={fmt(summary.total_comments)} icon="💬" />
            <StatCard label="Shares" value={fmt(summary.total_shares)} icon="🔗" />
          </View>
          <View style={S.engRate}>
            <Text style={S.engLabel}>Engagement Rate</Text>
            <Text style={S.engValue}>{summary.engagement_rate}%</Text>
          </View>
        </View>
      )}

      {/* Weekly Bar Chart */}
      {weekly.length > 0 && (
        <View style={S.section}>
          <Text style={S.sectionTitle}>Posts This Week</Text>
          <View style={S.chart}>
            {weekly.map((d, i) => (
              <View key={i} style={S.barCol}>
                <Text style={S.barCount}>{d.count}</Text>
                <View
                  style={[
                    S.bar,
                    { height: Math.max(4, (d.count / maxCount) * 80) },
                  ]}
                />
                <Text style={S.barDay}>{d.day}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Quick Actions */}
      <View style={S.section}>
        <Text style={S.sectionTitle}>Quick Actions</Text>
        <View style={S.actionRow}>
          <TouchableOpacity style={S.actionBtn} onPress={() => navigation.navigate("Upload")}>
            <Text style={S.actionIcon}>⬆️</Text>
            <Text style={S.actionLabel}>Upload Video</Text>
          </TouchableOpacity>
          <TouchableOpacity style={S.actionBtn} onPress={() => navigation.navigate("Posts")}>
            <Text style={S.actionIcon}>📋</Text>
            <Text style={S.actionLabel}>My Posts</Text>
          </TouchableOpacity>
          <TouchableOpacity style={S.actionBtn} onPress={() => navigation.navigate("Analytics")}>
            <Text style={S.actionIcon}>📊</Text>
            <Text style={S.actionLabel}>Analytics</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

function StatPill({ label, value }) {
  return (
    <View style={S.pill}>
      <Text style={S.pillValue}>{value}</Text>
      <Text style={S.pillLabel}>{label}</Text>
    </View>
  );
}

function StatusCard({ label, value, color }) {
  return (
    <View style={[S.statusCard, { borderLeftColor: color }]}>
      <Text style={[S.statusValue, { color }]}>{value}</Text>
      <Text style={S.statusLabel}>{label}</Text>
    </View>
  );
}

function StatCard({ label, value, icon }) {
  return (
    <View style={S.statCard}>
      <Text style={S.statIcon}>{icon}</Text>
      <Text style={S.statValue}>{value}</Text>
      <Text style={S.statLabel}>{label}</Text>
    </View>
  );
}

function fmt(n) {
  if (!n) return "0";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

const S = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#010101" },
  center: { justifyContent: "center", alignItems: "center" },
  container: { padding: 16, paddingBottom: 40 },

  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  greeting: { fontSize: 20, fontWeight: "800", color: "#fff" },
  subGreeting: { fontSize: 12, color: "#888", marginTop: 2 },
  logoutBtn: { backgroundColor: "#222", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  logoutText: { color: "#fe2c55", fontSize: 13, fontWeight: "600" },

  tiktokCard: { backgroundColor: "#111", borderRadius: 16, padding: 16, marginBottom: 16 },
  ttRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  ttAvatar: { width: 44, height: 44, borderRadius: 22, marginRight: 10 },
  ttAvatarFallback: { backgroundColor: "#fe2c55", justifyContent: "center", alignItems: "center" },
  ttAvatarText: { color: "#fff", fontSize: 18, fontWeight: "800" },
  tiktokUsername: { fontSize: 17, fontWeight: "700", color: "#fff" },
  statRow: { flexDirection: "row", justifyContent: "space-between" },
  pill: { alignItems: "center" },
  pillValue: { fontSize: 16, fontWeight: "700", color: "#fe2c55" },
  pillLabel: { fontSize: 11, color: "#888", marginTop: 2 },

  connectCard: {
    backgroundColor: "#fe2c55", borderRadius: 16, padding: 20,
    alignItems: "center", marginBottom: 16,
  },
  connectTitle: { fontSize: 16, fontWeight: "800", color: "#fff" },
  connectSub: { fontSize: 12, color: "rgba(255,255,255,0.8)", marginTop: 4 },

  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#fff", marginBottom: 12 },

  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statusCard: {
    flex: 1, minWidth: "45%", backgroundColor: "#111", borderRadius: 12,
    padding: 14, borderLeftWidth: 4,
  },
  statusValue: { fontSize: 24, fontWeight: "800" },
  statusLabel: { fontSize: 12, color: "#888", marginTop: 2 },

  statCard: {
    flex: 1, minWidth: "45%", backgroundColor: "#111", borderRadius: 12,
    padding: 14, alignItems: "center",
  },
  statIcon: { fontSize: 22, marginBottom: 4 },
  statValue: { fontSize: 20, fontWeight: "800", color: "#fff" },
  statLabel: { fontSize: 12, color: "#888", marginTop: 2 },

  engRate: {
    backgroundColor: "#1a1a2e", borderRadius: 12, padding: 14,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8,
  },
  engLabel: { color: "#aaa", fontSize: 14 },
  engValue: { color: "#fe2c55", fontSize: 22, fontWeight: "800" },

  chart: { flexDirection: "row", justifyContent: "space-around", alignItems: "flex-end", height: 120 },
  barCol: { alignItems: "center", flex: 1 },
  barCount: { color: "#888", fontSize: 10, marginBottom: 4 },
  bar: { width: 28, backgroundColor: "#fe2c55", borderRadius: 4 },
  barDay: { color: "#888", fontSize: 11, marginTop: 4 },

  actionRow: { flexDirection: "row", gap: 10 },
  actionBtn: {
    flex: 1, backgroundColor: "#111", borderRadius: 14, padding: 16, alignItems: "center",
  },
  actionIcon: { fontSize: 26, marginBottom: 6 },
  actionLabel: { color: "#fff", fontSize: 12, fontWeight: "600" },
});
