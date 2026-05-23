import React, { createContext, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getMe, login as apiLogin, logout as apiLogout, register as apiRegister } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    restoreSession();
  }, []);

  async function restoreSession() {
    try {
      // On web: check URL for ?token= from TikTok OAuth callback redirect
      if (Platform.OS === "web" && typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const urlToken = params.get("token");
        // Accept any of: tiktok_login, connected, signup — or just a bare ?token=
        const isTikTokCallback =
          params.get("tiktok_login") ||
          params.get("connected") ||
          params.get("signup") ||
          (urlToken && params.get("name")); // fallback: token + name = TikTok redirect

        if (urlToken && isTikTokCallback) {
          await AsyncStorage.setItem("api_token", urlToken);
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }

      const token = await AsyncStorage.getItem("api_token");
      if (token) {
        const res = await getMe();
        setUser(res.data.user);
      }
    } catch (err) {
      // Only clear token on auth failures (4xx), not on network errors
      const status = err.response?.status;
      if (status === 401 || status === 403) {
        await AsyncStorage.removeItem("api_token");
      }
    } finally {
      setLoading(false);
    }
  }

  async function loginWithToken(token) {
    await AsyncStorage.setItem("api_token", token);
    const res = await getMe();
    setUser(res.data.user);
    return res.data.user;
  }

  async function login(email, password) {
    const res = await apiLogin(email, password);
    const u = res.data.user;
    await AsyncStorage.setItem("api_token", u.api_token);
    setUser(u);
    return u;
  }

  async function register(email, password, name) {
    const res = await apiRegister(email, password, name);
    const u = res.data.user;
    await AsyncStorage.setItem("api_token", u.api_token);
    setUser(u);
    return u;
  }

  async function logout() {
    try { await apiLogout(); } catch { /* ignore */ }
    await AsyncStorage.removeItem("api_token");
    setUser(null);
  }

  function refreshUser(updatedUser) {
    setUser(updatedUser);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser, loginWithToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
