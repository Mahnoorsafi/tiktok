import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Change this to your Flask backend URL
// For Android emulator: http://10.0.2.2:5000
// For physical device: use your PC's local IP, e.g. http://192.168.1.x:5000
// For ngrok: https://your-ngrok-url.ngrok-free.app
export const BASE_URL = "http://localhost:5000";

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});

// Attach X-Auth-Token header on every request
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem("api_token");
  if (token) {
    config.headers["X-Auth-Token"] = token;
  }
  return config;
});

// ── Auth ──────────────────────────────────────────────────────────────
export const register = (email, password, name) =>
  api.post("/api/auth/register", { email, password, name });

export const login = (email, password) =>
  api.post("/api/auth/login", { email, password });

export const logout = () => api.post("/api/auth/logout");

export const getMe = () => api.get("/api/auth/me");

// ── TikTok ────────────────────────────────────────────────────────────
export const getTikTokConnectUrl = () => api.get("/auth/tiktok");
export const getTikTokSignupUrl = () => api.get("/auth/tiktok/signup");
export const getTikTokLoginMobileUrl = () => api.get("/auth/tiktok/login-mobile");
export const getTikTokProfile = () => api.get("/api/tiktok/profile");
export const getTikTokVideos = () => api.get("/api/tiktok/videos");
export const disconnectTikTok = () => api.post("/api/tiktok/disconnect");

// ── Campaigns ─────────────────────────────────────────────────────────
export const getCampaigns = () => api.get("/api/campaigns");
export const createCampaign = (name, description) =>
  api.post("/api/campaigns", { name, description });
export const updateCampaign = (id, data) => api.put(`/api/campaigns/${id}`, data);
export const deleteCampaign = (id) => api.delete(`/api/campaigns/${id}`);

// ── Posts ──────────────────────────────────────────────────────────────
export const getPosts = (params) => api.get("/api/posts", { params });
export const createPost = (data) => api.post("/api/posts", data);
export const updatePost = (id, data) => api.put(`/api/posts/${id}`, data);
export const deletePost = (id) => api.delete(`/api/posts/${id}`);
export const publishNow = (id) => api.post(`/api/posts/${id}/publish-now`, {}, { timeout: 150000 });

export const uploadVideo = async (file, meta) => {
  const form = new FormData();

  // expo-document-picker returns .file (actual File object) on web, uri on native
  if (file.file) {
    // Web browser
    form.append("video", file.file, file.name || "video.mp4");
  } else {
    // React Native native
    form.append("video", {
      uri: file.uri,
      name: file.name || "video.mp4",
      type: file.mimeType || "video/mp4",
    });
  }

  Object.entries(meta).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") form.append(k, String(v));
  });

  const token = await AsyncStorage.getItem("api_token");
  return axios.post(`${BASE_URL}/api/posts/upload`, form, {
    headers: {
      "Content-Type": "multipart/form-data",
      ...(token ? { "X-Auth-Token": token } : {}),
    },
    timeout: 120000,
  });
};

// ── Analytics ─────────────────────────────────────────────────────────
export const getAnalyticsSummary = () => api.get("/api/analytics/summary");
export const getAnalyticsPosts = () => api.get("/api/analytics/posts");
export const getAnalyticsWeekly = () => api.get("/api/analytics/weekly");
export const syncPostAnalytics = (id) =>
  api.post(`/api/analytics/sync/${id}`);

// ── Engagement ────────────────────────────────────────────────────────
export const getComments = () => api.get("/api/comments");
export const syncComments = () => api.post("/api/comments/sync");
export const replyComment = (id, text) =>
  api.post(`/api/comments/${id}/reply`, { text });
export const likeComment = (id) => api.post(`/api/comments/${id}/like`);

// ── Settings ──────────────────────────────────────────────────────────
export const getSettings = () => api.get("/api/settings");
export const updateSettings = (data) => api.put("/api/settings", data);

// ── Health ─────────────────────────────────────────────────────────────
export const healthCheck = () => api.get("/api/health");
