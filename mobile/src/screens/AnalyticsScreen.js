import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, FlatList, StyleSheet, RefreshControl,
  ActivityIndicator, TouchableOpacity, Alert, Image, ScrollView,
} from "react-native";
import { getAnalyticsSummary, getAnalyticsPosts, syncPostAnalytics, getTikTokVideos } from "../api/client";

export default function AnalyticsScreen() {
  const [summary, setSummary] = useState(null);
  const [posts, setPosts] = useState([]);
  const [ttVideos, setTtVideos] = useState([]);
  const [tab, setTab] = useState("posts"); // "posts" | "tiktok"
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [sRes, pRes, ttRes] = await Promise.allSettled([
        getAnalyticsSummary(),
        getAnalyticsPosts(),
        getTikTokVideos(),
      ]);
      if (sRes.status === "fulfilled") setSummary(sRes.value.data);
      if (pRes.status === "fulfilled") setPosts(pRes.value.data.posts || []);
      if (ttRes.status === "fulfilled") setTtVideos(ttRes.value.data.videos || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function handleSync(id) {
    try {
      await syncPostAnalytics(id);
      Alert.alert("Synced", "Analytics updated from TikTok.");
      load();
    } catch {
      Alert.alert("Error", "Could not sync analytics. Make sure TikTok is connected.");
    }
  }

  if (loading) {
    return <View style={S.center}><ActivityIndicator color="#fe2c55" size="large" /></View>;
  }

  const STATUS_COLOR = {
    scheduled: "#f59e0b", published: "#22c55e",
    failed: "#ef4444", draft: "#6366f1", publishing: "#3b82f6",
  };

  function renderPost({ item }) {
    const a = item.analytics;
    const color = STATUS_COLOR[item.status] || "#888";
    const dateLabel = item.published_at
      ? "Published " + new Date(item.published_at).toLocaleDateString()
      : item.scheduled_at
      ? "Scheduled " + new Date(item.scheduled_at).toLocaleString()
      : "No date";
    return (
      <View style={S.card}>
        <View style={S.cardTop}>
          <View style={[S.statusBadge, { backgroundColor: color + "22", borderColor: color }]}>
            <Text style={[S.statusText, { color }]}>{item.status}</Text>
          </View>
          <Text style={S.date}>{dateLabel}</Text>
        </View>
        <Text style={S.caption} numberOfLines={2}>{item.caption || "No caption"}</Text>
        {a ? (
          <View style={S.statsRow}>
            <StatBadge icon="👁" label="Views" value={a.views} />
            <StatBadge icon="❤️" label="Likes" value={a.likes} />
            <StatBadge icon="💬" label="Comments" value={a.comments} />
            <StatBadge icon="🔗" label="Shares" value={a.shares} />
          </View>
        ) : (
          <Text style={S.noStats}>
            {item.status === "published" ? "No analytics yet — tap Sync" : "Stats available after publishing"}
          </Text>
        )}
        {item.status === "published" && item.tiktok_video_id && (
          <TouchableOpacity style={S.syncBtn} onPress={() => handleSync(item.id)}>
            <Text style={S.syncBtnText}>↻ Sync Stats</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  function renderTikTokVideo({ item }) {
    return (
      <View style={S.card}>
        <View style={S.ttVidRow}>
          {item.cover_image_url ? (
            <Image source={{ uri: item.cover_image_url }} style={S.ttThumb} />
          ) : (
            <View style={[S.ttThumb, { backgroundColor: "#222", justifyContent: "center", alignItems: "center" }]}>
              <Text style={{ fontSize: 24 }}>🎬</Text>
            </View>
          )}
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={S.caption} numberOfLines={2}>{item.title || "Untitled"}</Text>
            <Text style={S.date}>{item.create_time ? new Date(item.create_time * 1000).toLocaleDateString() : ""}</Text>
          </View>
        </View>
        <View style={S.statsRow}>
          <StatBadge icon="👁" label="Views" value={item.view_count || 0} />
          <StatBadge icon="❤️" label="Likes" value={item.like_count || 0} />
          <StatBadge icon="💬" label="Comments" value={item.comment_count || 0} />
          <StatBadge icon="🔗" label="Shares" value={item.share_count || 0} />
        </View>
      </View>
    );
  }

  return (
    <View style={S.flex}>
      {/* Summary cards */}
      {summary && (
        <View style={S.summaryBox}>
          <View style={S.summaryRow}>
            <SummaryCard label="Total Views" value={fmt(summary.total_views)} color="#3b82f6" />
            <SummaryCard label="Total Likes" value={fmt(summary.total_likes)} color="#fe2c55" />
          </View>
          <View style={S.summaryRow}>
            <SummaryCard label="Comments" value={fmt(summary.total_comments)} color="#8b5cf6" />
            <SummaryCard label="Engagement" value={`${summary.engagement_rate}%`} color="#22c55e" />
          </View>
        </View>
      )}

      {/* Tabs */}
      <View style={S.tabs}>
        <TouchableOpacity style={[S.tab, tab === "posts" && S.tabActive]} onPress={() => setTab("posts")}>
          <Text style={[S.tabText, tab === "posts" && S.tabTextActive]}>📋 All Posts ({posts.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[S.tab, tab === "tiktok" && S.tabActive]} onPress={() => setTab("tiktok")}>
          <Text style={[S.tabText, tab === "tiktok" && S.tabTextActive]}>🎵 TikTok Videos ({ttVideos.length})</Text>
        </TouchableOpacity>
      </View>

      {tab === "posts" ? (
        <FlatList
          data={posts}
          keyExtractor={(i) => String(i.id)}
          renderItem={renderPost}
          contentContainerStyle={S.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fe2c55" />}
          ListEmptyComponent={
            <View style={S.empty}>
              <Text style={S.emptyIcon}>📊</Text>
              <Text style={S.emptyText}>No posts yet</Text>
              <Text style={S.emptySub}>Upload a video to get started</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={ttVideos}
          keyExtractor={(i) => String(i.id)}
          renderItem={renderTikTokVideo}
          contentContainerStyle={S.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fe2c55" />}
          ListEmptyComponent={
            <View style={S.empty}>
              <Text style={S.emptyIcon}>🎵</Text>
              <Text style={S.emptyText}>No TikTok videos found</Text>
              <Text style={S.emptySub}>Connect TikTok in Profile to see your videos</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

function emptySub() { return null; }

function SummaryCard({ label, value, color }) {
  return (
    <View style={[S.sumCard, { borderTopColor: color }]}>
      <Text style={[S.sumValue, { color }]}>{value}</Text>
      <Text style={S.sumLabel}>{label}</Text>
    </View>
  );
}

function StatBadge({ icon, label, value }) {
  return (
    <View style={S.statBadge}>
      <Text style={S.statIcon}>{icon}</Text>
      <Text style={S.statValue}>{fmt(value)}</Text>
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
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#010101" },
  summaryBox: { padding: 12, gap: 8 },
  summaryRow: { flexDirection: "row", gap: 8 },
  sumCard: {
    flex: 1, backgroundColor: "#111", borderRadius: 14, padding: 14,
    borderTopWidth: 3,
  },
  sumValue: { fontSize: 22, fontWeight: "800" },
  sumLabel: { color: "#888", fontSize: 12, marginTop: 2 },
  list: { padding: 12, paddingBottom: 40 },
  card: { backgroundColor: "#111", borderRadius: 16, padding: 16, marginBottom: 12 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  statusText: { fontSize: 11, fontWeight: "700", textTransform: "capitalize" },
  caption: { color: "#fff", fontSize: 15, fontWeight: "500", marginBottom: 8 },
  date: { color: "#666", fontSize: 11 },
  statsRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  statBadge: { alignItems: "center" },
  statIcon: { fontSize: 18 },
  statValue: { color: "#fff", fontWeight: "700", fontSize: 15, marginTop: 2 },
  statLabel: { color: "#666", fontSize: 11 },
  noStats: { color: "#555", fontStyle: "italic", marginBottom: 8 },
  syncBtn: { backgroundColor: "#1a1a1a", borderRadius: 10, padding: 8, alignItems: "center" },
  syncBtnText: { color: "#fe2c55", fontWeight: "600" },
  tabs: { flexDirection: "row", paddingHorizontal: 12, paddingBottom: 8, gap: 8 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 20, backgroundColor: "#1a1a1a", alignItems: "center" },
  tabActive: { backgroundColor: "#fe2c55" },
  tabText: { color: "#888", fontSize: 13, fontWeight: "600" },
  tabTextActive: { color: "#fff" },
  ttVidRow: { flexDirection: "row", marginBottom: 10 },
  ttThumb: { width: 72, height: 96, borderRadius: 8 },
  empty: { alignItems: "center", marginTop: 60, paddingHorizontal: 30 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: "#666", fontSize: 16, marginBottom: 6 },
  emptySub: { color: "#444", fontSize: 13, textAlign: "center" },
});
