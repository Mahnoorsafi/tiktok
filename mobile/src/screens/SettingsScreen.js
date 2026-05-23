import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, Switch, TextInput,
  TouchableOpacity, Alert, ActivityIndicator,
} from "react-native";
import { getSettings, updateSettings } from "../api/client";

export default function SettingsScreen() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSettings()
      .then((r) => setSettings(r.data))
      .catch(() => Alert.alert("Error", "Could not load settings."))
      .finally(() => setLoading(false));
  }, []);

  function set(key, val) {
    setSettings((prev) => ({ ...prev, [key]: val }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateSettings(settings);
      Alert.alert("Saved", "Settings updated successfully.");
    } catch {
      Alert.alert("Error", "Could not save settings.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <View style={S.center}><ActivityIndicator color="#fe2c55" size="large" /></View>;
  }

  if (!settings) return null;

  return (
    <ScrollView style={S.flex} contentContainerStyle={S.container}>
      {/* Automation */}
      <SectionHeader title="Automation" />
      <View style={S.card}>
        <ToggleRow label="Auto Publish Scheduled Posts" value={settings.auto_publish} onChange={(v) => set("auto_publish", v)} />
        <ToggleRow label="Auto Reply to Comments" value={settings.auto_reply} onChange={(v) => set("auto_reply", v)} />
        <ToggleRow label="Auto Like Comments" value={settings.auto_like_comments} onChange={(v) => set("auto_like_comments", v)} />
        <ToggleRow label="Auto Follow Back" value={settings.auto_follow_back} onChange={(v) => set("auto_follow_back", v)} last />
      </View>

      {/* Smart Reply */}
      <SectionHeader title="Smart Replies" />
      <View style={S.card}>
        <ToggleRow label="Smart Reply (rotate templates)" value={settings.smart_reply} onChange={(v) => set("smart_reply", v)} last />
      </View>

      <Text style={S.label}>Reply Template 1</Text>
      <TextInput style={S.input} value={settings.reply_template_1} onChangeText={(v) => set("reply_template_1", v)} placeholderTextColor="#555" />

      <Text style={S.label}>Reply Template 2</Text>
      <TextInput style={S.input} value={settings.reply_template_2} onChangeText={(v) => set("reply_template_2", v)} placeholderTextColor="#555" />

      <Text style={S.label}>Reply Template 3</Text>
      <TextInput style={S.input} value={settings.reply_template_3} onChangeText={(v) => set("reply_template_3", v)} placeholderTextColor="#555" />

      {/* Defaults */}
      <SectionHeader title="Defaults" />
      <Text style={S.label}>Default Caption Template</Text>
      <TextInput
        style={[S.input, S.multiline]}
        value={settings.default_caption_tmpl}
        onChangeText={(v) => set("default_caption_tmpl", v)}
        multiline
        numberOfLines={2}
        placeholderTextColor="#555"
      />

      <Text style={S.label}>Timezone</Text>
      <TextInput style={S.input} value={settings.timezone} onChangeText={(v) => set("timezone", v)} placeholderTextColor="#555" />

      {/* Other */}
      <SectionHeader title="Other" />
      <View style={S.card}>
        <ToggleRow label="Retry on Fail (up to 3 attempts)" value={settings.retry_on_fail} onChange={(v) => set("retry_on_fail", v)} />
        <ToggleRow label="Analytics Digest" value={settings.analytics_digest} onChange={(v) => set("analytics_digest", v)} last />
      </View>

      <TouchableOpacity style={[S.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={S.saveBtnText}>Save Settings</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

function SectionHeader({ title }) {
  return <Text style={S.sectionHeader}>{title}</Text>;
}

function ToggleRow({ label, value, onChange, last }) {
  return (
    <View style={[S.toggleRow, !last && S.toggleBorder]}>
      <Text style={S.toggleLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: "#333", true: "#fe2c55" }}
        thumbColor={value ? "#fff" : "#666"}
      />
    </View>
  );
}

const S = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#010101" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#010101" },
  container: { padding: 20, paddingBottom: 60 },
  sectionHeader: { color: "#fe2c55", fontSize: 13, fontWeight: "700", textTransform: "uppercase", marginTop: 20, marginBottom: 8, letterSpacing: 1 },
  card: { backgroundColor: "#111", borderRadius: 16, paddingHorizontal: 16, marginBottom: 4 },
  toggleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14 },
  toggleBorder: { borderBottomWidth: 1, borderBottomColor: "#1a1a1a" },
  toggleLabel: { color: "#ddd", fontSize: 15, flex: 1, marginRight: 10 },
  label: { color: "#aaa", fontSize: 13, marginBottom: 6, marginTop: 14 },
  input: {
    backgroundColor: "#111", color: "#fff", borderRadius: 12,
    padding: 14, fontSize: 15, borderWidth: 1, borderColor: "#222",
  },
  multiline: { height: 70, textAlignVertical: "top" },
  saveBtn: {
    backgroundColor: "#fe2c55", borderRadius: 14, padding: 18,
    alignItems: "center", marginTop: 28,
  },
  saveBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
