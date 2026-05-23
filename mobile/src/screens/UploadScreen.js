import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, Switch, ActivityIndicator, Platform,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { useNavigation } from "@react-navigation/native";
import { uploadVideo, createPost } from "../api/client";

const PRIVACY_OPTIONS = [
  { label: "Public", value: "PUBLIC_TO_EVERYONE" },
  { label: "Friends", value: "MUTUAL_FOLLOW_FRIENDS" },
  { label: "Followers", value: "FOLLOWER_OF_FOLLOWER" },
  { label: "Private", value: "SELF_ONLY" },
];

export default function UploadScreen() {
  const navigation = useNavigation();
  const [file, setFile] = useState(null);
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("#fyp #viral");
  const [privacy, setPrivacy] = useState("SELF_ONLY");
  const [scheduledAt, setScheduledAt] = useState("");
  const [allowComments, setAllowComments] = useState(true);
  const [allowDuet, setAllowDuet] = useState(true);
  const [allowStitch, setAllowStitch] = useState(true);
  const [publishNow, setPublishNow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState("idle"); // idle | uploading | scheduling

  async function pickVideo() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "video/*",
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.length > 0) {
        setFile(result.assets[0]);
      }
    } catch {
      Alert.alert("Error", "Could not open file picker.");
    }
  }

  async function handleSubmit() {
    if (!file) {
      Alert.alert("No video", "Please select a video file first.");
      return;
    }
    if (!publishNow && !scheduledAt) {
      Alert.alert("Schedule time required", "Enter a schedule date/time or enable Publish Now.");
      return;
    }

    setLoading(true);
    setStep("uploading");
    try {
      // 1. Upload video file
      const upRes = await uploadVideo(file, {});
      const videoPath = upRes.data.video_path;

      // 2. Create post
      setStep("scheduling");
      const hashArr = hashtags
        .split(/\s+/)
        .filter((h) => h.startsWith("#"))
        .map((h) => h.trim());

      await createPost({
        caption,
        hashtags: hashArr,
        video_path: videoPath,
        scheduled_at: publishNow ? null : scheduledAt,
        status: publishNow ? "draft" : "scheduled",
        privacy,
        allow_comments: allowComments,
        allow_duet: allowDuet,
        allow_stitch: allowStitch,
      });

      const successMsg = publishNow ? "Video saved as draft." : "Video scheduled successfully!";
      if (Platform.OS === "web") {
        window.alert(successMsg);
      } else {
        Alert.alert("Success", successMsg);
      }
      // Reset form
      setFile(null);
      setCaption("");
      setHashtags("#fyp #viral");
      setScheduledAt("");
      setPublishNow(false);
      // Navigate to Posts so user can see the new entry
      navigation.navigate("Posts");
    } catch (err) {
      const msg = err.response?.data?.error || err.message || "Upload failed.";
      if (Platform.OS === "web") {
        window.alert("Error: " + msg);
      } else {
        Alert.alert("Error", msg);
      }
    } finally {
      setLoading(false);
      setStep("idle");
    }
  }

  return (
    <ScrollView style={S.flex} contentContainerStyle={S.container} keyboardShouldPersistTaps="handled">
      {/* Video Picker */}
      <Text style={S.sectionTitle}>Video File</Text>
      <TouchableOpacity style={S.picker} onPress={pickVideo}>
        {file ? (
          <View>
            <Text style={S.fileName} numberOfLines={1}>{file.name}</Text>
            <Text style={S.fileSize}>{(file.size / 1024 / 1024).toFixed(1)} MB</Text>
          </View>
        ) : (
          <>
            <Text style={S.pickerIcon}>🎬</Text>
            <Text style={S.pickerText}>Tap to select a video</Text>
            <Text style={S.pickerSub}>MP4, MOV, up to 300 MB</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Caption */}
      <Text style={S.label}>Caption</Text>
      <TextInput
        style={[S.input, S.multiline]}
        placeholder="What's this video about?"
        placeholderTextColor="#555"
        multiline
        numberOfLines={3}
        value={caption}
        onChangeText={setCaption}
        maxLength={2200}
      />
      <Text style={S.charCount}>{caption.length}/2200</Text>

      {/* Hashtags */}
      <Text style={S.label}>Hashtags</Text>
      <TextInput
        style={S.input}
        placeholder="#fyp #viral #trending"
        placeholderTextColor="#555"
        value={hashtags}
        onChangeText={setHashtags}
      />

      {/* Privacy */}
      <Text style={S.label}>Privacy</Text>
      <View style={S.privacyRow}>
        {PRIVACY_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[S.privBtn, privacy === opt.value && S.privBtnActive]}
            onPress={() => setPrivacy(opt.value)}
          >
            <Text style={[S.privBtnText, privacy === opt.value && S.privBtnTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Toggles */}
      <View style={S.toggles}>
        <ToggleRow label="Allow Comments" value={allowComments} onChange={setAllowComments} />
        <ToggleRow label="Allow Duet" value={allowDuet} onChange={setAllowDuet} />
        <ToggleRow label="Allow Stitch" value={allowStitch} onChange={setAllowStitch} />
        <ToggleRow label="Publish Now (no schedule)" value={publishNow} onChange={setPublishNow} accent />
      </View>

      {/* Schedule Time */}
      {!publishNow && (
        <>
          <Text style={S.label}>Schedule Date & Time</Text>
          <TextInput
            style={S.input}
            placeholder="YYYY-MM-DDTHH:MM  e.g. 2026-06-01T14:30"
            placeholderTextColor="#555"
            value={scheduledAt}
            onChangeText={setScheduledAt}
          />
        </>
      )}

      {/* Submit */}
      <TouchableOpacity
        style={[S.submitBtn, loading && S.submitDisabled]}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading ? (
          <>
            <ActivityIndicator color="#fff" />
            <Text style={[S.submitText, { marginLeft: 10 }]}>
              {step === "uploading" ? "Uploading video..." : "Scheduling..."}
            </Text>
          </>
        ) : (
          <Text style={S.submitText}>{publishNow ? "Upload as Draft" : "Schedule Post"}</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

function ToggleRow({ label, value, onChange, accent }) {
  return (
    <View style={S.toggleRow}>
      <Text style={S.toggleLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: "#333", true: accent ? "#fe2c55" : "#4ade80" }}
        thumbColor={value ? "#fff" : "#666"}
      />
    </View>
  );
}

const S = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#010101" },
  container: { padding: 20, paddingBottom: 60 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#fff", marginBottom: 12 },
  label: { color: "#aaa", fontSize: 13, marginBottom: 6, marginTop: 16 },
  input: {
    backgroundColor: "#111", color: "#fff", borderRadius: 12,
    padding: 14, fontSize: 15, borderWidth: 1, borderColor: "#222",
  },
  multiline: { height: 90, textAlignVertical: "top" },
  charCount: { color: "#555", fontSize: 12, textAlign: "right", marginTop: 4 },

  picker: {
    backgroundColor: "#111", borderRadius: 16, borderWidth: 2,
    borderColor: "#333", borderStyle: "dashed", padding: 32,
    alignItems: "center", marginBottom: 8,
  },
  pickerIcon: { fontSize: 40, marginBottom: 8 },
  pickerText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  pickerSub: { color: "#666", fontSize: 12, marginTop: 4 },
  fileName: { color: "#22c55e", fontWeight: "600", fontSize: 15, textAlign: "center" },
  fileSize: { color: "#888", fontSize: 12, textAlign: "center", marginTop: 4 },

  privacyRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  privBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: "#1a1a1a" },
  privBtnActive: { backgroundColor: "#fe2c55" },
  privBtnText: { color: "#888", fontSize: 13 },
  privBtnTextActive: { color: "#fff", fontWeight: "700" },

  toggles: { backgroundColor: "#111", borderRadius: 16, padding: 8, marginTop: 16, marginBottom: 4 },
  toggleRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 12, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: "#1a1a1a",
  },
  toggleLabel: { color: "#ddd", fontSize: 15 },

  submitBtn: {
    backgroundColor: "#fe2c55", borderRadius: 14, padding: 18,
    alignItems: "center", flexDirection: "row", justifyContent: "center", marginTop: 28,
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
