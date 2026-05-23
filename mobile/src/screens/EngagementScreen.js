import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  Alert, RefreshControl, ActivityIndicator, TextInput, Modal, Platform,
} from "react-native";
import { getComments, syncComments, replyComment, likeComment } from "../api/client";

export default function EngagementScreen({ navigation }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [replyModal, setReplyModal] = useState(null); // { id, commenterName }
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await getComments();
      setComments(res.data.comments || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await syncComments();
      const msg = res.data?.message || "Sync complete.";
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert("Synced", msg);
      load();
    } catch (err) {
      const msg = err.response?.data?.error || "Could not sync. Make sure TikTok is connected and VPN is on.";
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert("Sync Failed", msg);
    } finally {
      setSyncing(false);
    }
  }

  async function handleLike(id) {
    try {
      await likeComment(id);
      setComments((prev) =>
        prev.map((c) => (c.id === id ? { ...c, auto_liked: true } : c))
      );
    } catch {
      Alert.alert("Error", "Could not like comment.");
    }
  }

  async function handleReply() {
    if (!replyText.trim()) return;
    setSending(true);
    try {
      await replyComment(replyModal.id, replyText.trim());
      setComments((prev) =>
        prev.map((c) => (c.id === replyModal.id ? { ...c, auto_replied: true } : c))
      );
      setReplyModal(null);
      setReplyText("");
      Alert.alert("Sent", "Reply sent to TikTok!");
    } catch {
      Alert.alert("Error", "Could not send reply.");
    } finally {
      setSending(false);
    }
  }

  function renderComment({ item }) {
    return (
      <View style={S.card}>
        <View style={S.cardHeader}>
          <View style={S.avatar}>
            <Text style={S.avatarText}>{(item.commenter_name || "?")[0].toUpperCase()}</Text>
          </View>
          <View style={S.headerInfo}>
            <Text style={S.name}>{item.commenter_name}</Text>
            <Text style={S.date}>{new Date(item.created_at).toLocaleDateString()}</Text>
          </View>
          <View style={S.badges}>
            {item.auto_liked && <Text style={S.badge}>❤️</Text>}
            {item.auto_replied && <Text style={S.badge}>💬</Text>}
          </View>
        </View>

        <Text style={S.commentText}>{item.text}</Text>

        <View style={S.actions}>
          {!item.auto_liked && (
            <TouchableOpacity style={S.actBtn} onPress={() => handleLike(item.id)}>
              <Text style={S.actBtnText}>❤️ Like</Text>
            </TouchableOpacity>
          )}
          {!item.auto_replied && (
            <TouchableOpacity
              style={[S.actBtn, S.replyBtn]}
              onPress={() => { setReplyModal({ id: item.id, commenterName: item.commenter_name }); setReplyText(""); }}
            >
              <Text style={[S.actBtnText, { color: "#fff" }]}>💬 Reply</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={S.flex}>
      {/* Nav + Sync row */}
      <View style={S.navRow}>
        <TouchableOpacity style={S.navBtn} onPress={() => navigation.navigate("Settings")}>
          <Text style={S.navBtnText}>⚙️ Settings</Text>
        </TouchableOpacity>
        <TouchableOpacity style={S.navBtn} onPress={() => navigation.navigate("Profile")}>
          <Text style={S.navBtnText}>👤 Profile</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[S.navBtn, S.syncBtn, syncing && { opacity: 0.6 }]}
          onPress={handleSync}
          disabled={syncing}
        >
          {syncing
            ? <ActivityIndicator color="#fe2c55" size="small" />
            : <Text style={S.navBtnText}>↻ Sync</Text>}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={S.center}><ActivityIndicator color="#fe2c55" size="large" /></View>
      ) : (
        <FlatList
          data={comments}
          keyExtractor={(i) => String(i.id)}
          renderItem={renderComment}
          contentContainerStyle={S.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fe2c55" />}
          ListEmptyComponent={
            <View style={S.empty}>
              <Text style={S.emptyIcon}>💬</Text>
              <Text style={S.emptyText}>No comments yet</Text>
              <Text style={S.emptySub}>Comments from your TikTok posts will appear here</Text>
            </View>
          }
        />
      )}

      {/* Reply Modal */}
      <Modal visible={!!replyModal} transparent animationType="slide">
        <View style={S.modalOverlay}>
          <View style={S.modal}>
            <Text style={S.modalTitle}>Reply to @{replyModal?.commenterName}</Text>
            <TextInput
              style={S.replyInput}
              placeholder="Type your reply..."
              placeholderTextColor="#555"
              value={replyText}
              onChangeText={setReplyText}
              multiline
              autoFocus
            />
            <View style={S.modalActions}>
              <TouchableOpacity style={S.cancelBtn} onPress={() => setReplyModal(null)}>
                <Text style={S.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[S.sendBtn, sending && { opacity: 0.6 }]} onPress={handleReply} disabled={sending}>
                {sending ? <ActivityIndicator color="#fff" /> : <Text style={S.sendBtnText}>Send Reply</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const S = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#010101" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  navRow: { flexDirection: "row", gap: 10, padding: 12 },
  navBtn: { flex: 1, backgroundColor: "#111", borderRadius: 12, padding: 12, alignItems: "center" },
  syncBtn: { borderWidth: 1, borderColor: "#fe2c55" },
  navBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  list: { padding: 12, paddingBottom: 40 },
  card: { backgroundColor: "#111", borderRadius: 16, padding: 14, marginBottom: 10 },
  cardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  avatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: "#fe2c55",
    justifyContent: "center", alignItems: "center", marginRight: 10,
  },
  avatarText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  headerInfo: { flex: 1 },
  name: { color: "#fff", fontWeight: "600", fontSize: 14 },
  date: { color: "#666", fontSize: 12 },
  badges: { flexDirection: "row", gap: 4 },
  badge: { fontSize: 18 },
  commentText: { color: "#ddd", fontSize: 14, lineHeight: 20, marginBottom: 10 },
  actions: { flexDirection: "row", gap: 8 },
  actBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: "#1a1a1a" },
  replyBtn: { backgroundColor: "#fe2c55" },
  actBtnText: { color: "#fe2c55", fontWeight: "600", fontSize: 13 },
  empty: { alignItems: "center", marginTop: 80, paddingHorizontal: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: "#fff", fontSize: 18, fontWeight: "700", marginBottom: 8 },
  emptySub: { color: "#666", fontSize: 14, textAlign: "center" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.8)", justifyContent: "flex-end" },
  modal: { backgroundColor: "#111", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle: { color: "#fff", fontSize: 17, fontWeight: "700", marginBottom: 16 },
  replyInput: {
    backgroundColor: "#1a1a1a", color: "#fff", borderRadius: 12, padding: 14,
    fontSize: 15, minHeight: 100, textAlignVertical: "top", borderWidth: 1, borderColor: "#333",
  },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 16 },
  cancelBtn: { flex: 1, backgroundColor: "#1a1a1a", borderRadius: 12, padding: 14, alignItems: "center" },
  cancelBtnText: { color: "#888", fontWeight: "600" },
  sendBtn: { flex: 1, backgroundColor: "#fe2c55", borderRadius: 12, padding: 14, alignItems: "center" },
  sendBtnText: { color: "#fff", fontWeight: "700" },
});
