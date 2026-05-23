import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, Platform,
} from "react-native";
import { getPosts, deletePost, publishNow } from "../api/client";

const STATUS_COLOR = {
  scheduled: "#f59e0b",
  published: "#22c55e",
  failed:    "#ef4444",
  draft:     "#6366f1",
  publishing:"#3b82f6",
};

export default function PostsScreen() {
  const [posts,        setPosts]        = useState([]);
  const [filter,       setFilter]       = useState("all");
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [publishingId, setPublishingId] = useState(null);
  const [toast,        setToast]        = useState(null); // { type:"success"|"error", msg }
  const toastTimer = useRef(null);

  function showToast(type, msg) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ type, msg });
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  }

  const load = useCallback(async () => {
    try {
      const params = filter !== "all" ? { status: filter } : {};
      const res = await getPosts(params);
      setPosts(res.data.posts || []);
    } catch {
      // keep existing list on network error
    }
  }, [filter]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function doPublish(id) {
    setPublishingId(id);
    try {
      const res = await publishNow(id);
      const updated = res.data?.post;
      setPosts((prev) =>
        prev.map((p) => p.id === id ? { ...p, ...(updated || {}), status: "published" } : p)
      );
      setFilter("published");
      showToast("success", "Published! Your video is live on TikTok.");
    } catch (err) {
      const isTimeout = err.code === "ECONNABORTED";
      const msg =
        err.response?.data?.error ||
        (isTimeout ? "Request timed out — reloading to check status…" : null) ||
        err.message ||
        "Publish failed.";
      showToast(isTimeout ? "success" : "error", msg);
      if (isTimeout) {
        setTimeout(() => load(), 4000);
      }
    } finally {
      setPublishingId(null);
    }
  }

  // Auto-refresh every 8 s while any post is in "publishing" state
  const hasPending = useMemo(() => posts.some((p) => p.status === "publishing"), [posts]);
  useEffect(() => {
    if (!hasPending) return;
    const t = setInterval(() => load(), 8000);
    return () => clearInterval(t);
  }, [hasPending, load]);

  function handlePublishNow(id) {
    if (publishingId) return;
    if (Platform.OS === "web") {
      if (window.confirm("Publish this post immediately to TikTok?")) doPublish(id);
    } else {
      const { Alert } = require("react-native");
      Alert.alert("Publish Now", "Publish this post immediately to TikTok?", [
        { text: "Cancel", style: "cancel" },
        { text: "Publish", onPress: () => doPublish(id) },
      ]);
    }
  }

  function handleDelete(id) {
    const run = () =>
      deletePost(id)
        .then(() => setPosts((p) => p.filter((x) => x.id !== id)))
        .catch(() => showToast("error", "Could not delete post."));

    if (Platform.OS === "web") {
      if (window.confirm("Delete this post?")) run();
    } else {
      const { Alert } = require("react-native");
      Alert.alert("Delete", "Are you sure?", [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: run },
      ]);
    }
  }

  const FILTERS = ["all", "scheduled", "published", "failed", "draft"];

  function renderPost({ item }) {
    const color       = STATUS_COLOR[item.status] || "#888";
    const isPublishing = publishingId === item.id;
    return (
      <View style={S.card}>
        <View style={S.cardHeader}>
          <View style={[S.badge, { backgroundColor: color + "22", borderColor: color }]}>
            <Text style={[S.badgeText, { color }]}>{item.status}</Text>
          </View>
          <Text style={S.dateText}>
            {item.scheduled_at
              ? new Date(item.scheduled_at).toLocaleString()
              : item.published_at
              ? new Date(item.published_at).toLocaleString()
              : "No date"}
          </Text>
        </View>

        <Text style={S.caption} numberOfLines={2}>
          {item.caption || <Text style={S.noCaption}>No caption</Text>}
        </Text>

        {item.hashtags?.length > 0 && (
          <Text style={S.hashtags} numberOfLines={1}>{item.hashtags.join(" ")}</Text>
        )}

        {item.status === "failed" && item.error_message && (
          <Text style={S.error} numberOfLines={3}>⚠ {item.error_message}</Text>
        )}

        {item.analytics && (
          <View style={S.analyticsRow}>
            <Text style={S.analStat}>👁 {item.analytics.views}</Text>
            <Text style={S.analStat}>❤️ {item.analytics.likes}</Text>
            <Text style={S.analStat}>💬 {item.analytics.comments}</Text>
            <Text style={S.analStat}>🔗 {item.analytics.shares}</Text>
          </View>
        )}

        <View style={S.actions}>
          {(item.status === "draft" || item.status === "scheduled") && (
            <TouchableOpacity
              style={[S.actBtn, isPublishing && S.actBtnDisabled]}
              onPress={() => handlePublishNow(item.id)}
              disabled={isPublishing}
            >
              {isPublishing ? (
                <View style={S.row}>
                  <ActivityIndicator size="small" color="#fe2c55" />
                  <Text style={[S.actBtnText, { marginLeft: 6 }]}>Publishing…</Text>
                </View>
              ) : (
                <Text style={S.actBtnText}>Publish Now</Text>
              )}
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[S.actBtn, S.deleteBtn]}
            onPress={() => handleDelete(item.id)}
            disabled={isPublishing}
          >
            <Text style={[S.actBtnText, { color: "#ef4444" }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={S.flex}>
      {/* Filter tabs */}
      <View style={S.filters}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f}
            style={[S.filterBtn, filter === f && S.filterActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[S.filterText, filter === f && S.filterTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={S.center}><ActivityIndicator color="#fe2c55" size="large" /></View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(i) => String(i.id)}
          renderItem={renderPost}
          contentContainerStyle={S.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fe2c55" />}
          ListEmptyComponent={
            <View style={S.empty}>
              <Text style={S.emptyIcon}>📭</Text>
              <Text style={S.emptyText}>No posts found</Text>
            </View>
          }
        />
      )}

      {/* Publishing overlay */}
      {publishingId && (
        <View style={S.overlay}>
          <ActivityIndicator color="#fe2c55" size="large" />
          <Text style={S.overlayTitle}>Publishing to TikTok…</Text>
          <Text style={S.overlaySub}>This can take up to 2 minutes</Text>
        </View>
      )}

      {/* In-app toast — never blocked by browser */}
      {toast && (
        <View style={[S.toast, toast.type === "success" ? S.toastSuccess : S.toastError]}>
          <Text style={S.toastIcon}>{toast.type === "success" ? "✓" : "✕"}</Text>
          <Text style={S.toastMsg} numberOfLines={4}>{toast.msg}</Text>
          <TouchableOpacity onPress={() => setToast(null)} style={S.toastClose}>
            <Text style={S.toastCloseText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const S = StyleSheet.create({
  flex:   { flex: 1, backgroundColor: "#010101" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  filters: { flexDirection: "row", paddingHorizontal: 12, paddingVertical: 10, gap: 8, flexWrap: "wrap" },
  filterBtn:       { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: "#1a1a1a" },
  filterActive:    { backgroundColor: "#fe2c55" },
  filterText:      { color: "#888", fontSize: 13 },
  filterTextActive:{ color: "#fff", fontWeight: "700" },
  list: { padding: 12, paddingBottom: 100 },
  card: { backgroundColor: "#111", borderRadius: 16, padding: 16, marginBottom: 12 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  badge:    { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  badgeText:{ fontSize: 12, fontWeight: "600", textTransform: "capitalize" },
  dateText: { color: "#666", fontSize: 12 },
  caption:  { color: "#fff", fontSize: 15, marginBottom: 6 },
  noCaption:{ color: "#555", fontStyle: "italic" },
  hashtags: { color: "#4493f8", fontSize: 13, marginBottom: 8 },
  error:    { color: "#ef4444", fontSize: 12, backgroundColor: "#3f0000", borderRadius: 8, padding: 8, marginBottom: 8 },
  analyticsRow: { flexDirection: "row", gap: 12, marginBottom: 10 },
  analStat: { color: "#aaa", fontSize: 13 },
  actions:  { flexDirection: "row", gap: 8, marginTop: 4 },
  actBtn:   { flex: 1, backgroundColor: "#1a1a1a", borderRadius: 10, padding: 10, alignItems: "center" },
  actBtnDisabled: { opacity: 0.5 },
  deleteBtn:{ backgroundColor: "transparent", borderWidth: 1, borderColor: "#3a0000" },
  actBtnText:{ color: "#fe2c55", fontWeight: "600", fontSize: 14 },
  row: { flexDirection: "row", alignItems: "center" },
  empty:    { alignItems: "center", marginTop: 80 },
  emptyIcon:{ fontSize: 48, marginBottom: 12 },
  emptyText:{ color: "#666", fontSize: 16 },
  overlay:  {
    position: "absolute", bottom: 20, left: 20, right: 20,
    backgroundColor: "#111", borderRadius: 16, padding: 20,
    alignItems: "center", borderWidth: 1, borderColor: "#333",
  },
  overlayTitle: { color: "#fff", fontSize: 16, fontWeight: "700", marginTop: 12 },
  overlaySub:   { color: "#888", fontSize: 12, marginTop: 4 },
  toast: {
    position: "absolute", bottom: 24, left: 16, right: 16,
    borderRadius: 14, padding: 14, flexDirection: "row",
    alignItems: "center", gap: 10, elevation: 8,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8,
  },
  toastSuccess: { backgroundColor: "#052e16", borderWidth: 1, borderColor: "#22c55e" },
  toastError:   { backgroundColor: "#3f0000", borderWidth: 1, borderColor: "#ef4444" },
  toastIcon:    { fontSize: 18, fontWeight: "900", color: "#fff" },
  toastMsg:     { flex: 1, color: "#fff", fontSize: 13, lineHeight: 18 },
  toastClose:   { padding: 4 },
  toastCloseText:{ color: "#888", fontSize: 14 },
});
