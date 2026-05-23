import React from "react";
import { ActivityIndicator, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { useAuth } from "../context/AuthContext";

import LoginScreen from "../screens/LoginScreen";
import RegisterScreen from "../screens/RegisterScreen";
import DashboardScreen from "../screens/DashboardScreen";
import PostsScreen from "../screens/PostsScreen";
import UploadScreen from "../screens/UploadScreen";
import AnalyticsScreen from "../screens/AnalyticsScreen";
import EngagementScreen from "../screens/EngagementScreen";
import SettingsScreen from "../screens/SettingsScreen";
import ProfileScreen from "../screens/ProfileScreen";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const COLORS = {
  primary: "#fe2c55",
  bg: "#010101",
  card: "#111",
  text: "#fff",
  muted: "#888",
};

function TabIcon({ name, color, size }) {
  const icons = {
    Dashboard: "⊞",
    Posts: "▤",
    Upload: "⊕",
    Analytics: "◉",
    More: "☰",
  };
  return (
    <View style={{ alignItems: "center" }}>
      <Text style={{ fontSize: size, color }}>{icons[name] || "•"}</Text>
    </View>
  );
}

// Simple text-based icons using unicode — no icon library dependency
import { Text } from "react-native";

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarStyle: { backgroundColor: COLORS.bg, borderTopColor: "#222" },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.muted,
        headerStyle: { backgroundColor: COLORS.bg },
        headerTintColor: COLORS.text,
        headerTitleStyle: { fontWeight: "bold" },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          title: "Dashboard",
          tabBarLabel: "Home",
          tabBarIcon: ({ color, size }) => (
            <Text style={{ fontSize: size - 4, color }}>🏠</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Posts"
        component={PostsScreen}
        options={{
          title: "My Posts",
          tabBarLabel: "Posts",
          tabBarIcon: ({ color, size }) => (
            <Text style={{ fontSize: size - 4, color }}>📋</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Upload"
        component={UploadScreen}
        options={{
          title: "Upload Video",
          tabBarLabel: "Upload",
          tabBarIcon: ({ color, size }) => (
            <Text style={{ fontSize: size - 4, color }}>⬆️</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Analytics"
        component={AnalyticsScreen}
        options={{
          title: "Analytics",
          tabBarLabel: "Stats",
          tabBarIcon: ({ color, size }) => (
            <Text style={{ fontSize: size - 4, color }}>📊</Text>
          ),
        }}
      />
      <Tab.Screen
        name="More"
        component={MoreStack}
        options={{
          headerShown: false,
          tabBarLabel: "More",
          tabBarIcon: ({ color, size }) => (
            <Text style={{ fontSize: size - 4, color }}>☰</Text>
          ),
        }}
      />
    </Tab.Navigator>
  );
}

function MoreStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.bg },
        headerTintColor: COLORS.text,
      }}
    >
      <Stack.Screen name="Engagement" component={EngagementScreen} options={{ title: "Comments" }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: "Settings" }} />
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: "Profile" }} />
    </Stack.Navigator>
  );
}

function AuthStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.bg },
        headerTintColor: COLORS.text,
        headerShown: false,
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {user ? <MainTabs /> : <AuthStack />}
    </NavigationContainer>
  );
}
