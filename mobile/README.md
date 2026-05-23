# SMCA Mobile — React Native App

TikTok Social Media Campaign Automation — React Native (Expo) client for the Flask backend.

## Prerequisites
- Node.js 18+
- Expo Go app on your phone (for testing) — install from App Store / Play Store
- The Flask backend running (`smca_flask_backend.py`)

## Setup

### 1. Install dependencies
```bash
cd mobile
npm install
```

### 2. Set your backend URL
Edit `src/api/client.js` and update `BASE_URL`:

| Scenario | URL |
|---|---|
| Android Emulator | `http://10.0.2.2:5000` |
| Physical Device (same WiFi) | `http://192.168.x.x:5000` (your PC's local IP) |
| ngrok tunnel | `https://your-ngrok-url.ngrok-free.app` |

### 3. Add placeholder assets (required by Expo)
Place these images in `mobile/assets/`:
- `icon.png` — 1024×1024 app icon
- `splash.png` — 1284×2778 splash screen
- `adaptive-icon.png` — 1024×1024 Android adaptive icon
- `favicon.png` — 48×48 favicon

Or run: `npx expo install expo-asset` and let Expo use defaults.

### 4. Start the app
```bash
npx expo start
```

Then:
- **Android emulator**: press `a`
- **iOS simulator**: press `i`
- **Physical device**: scan the QR code with Expo Go

## Screens

| Screen | Description |
|---|---|
| Login / Register | Email & password auth |
| Dashboard | Analytics summary, TikTok profile, quick actions |
| Posts | List all posts with filter tabs (scheduled/published/failed/draft) |
| Upload | Pick a video, add caption/hashtags, set schedule time |
| Analytics | Per-post stats with sync button |
| Comments | Auto-reply and auto-like TikTok comments |
| Settings | Toggle auto-publish, auto-reply, reply templates, timezone |
| Profile | TikTok connection, account info, logout |

## Features from smca_flask_backend.py

- User registration + login (stored in SQLAlchemy DB)
- TikTok OAuth via in-app browser (`expo-web-browser`)
- Post scheduling → auto-published by the Flask APScheduler every minute
- Campaign management (via API — no dedicated screen yet)
- Auto-engagement: reply + like comments
- Analytics with weekly chart on Dashboard
- Settings: auto_publish, auto_reply, smart reply templates

## Architecture

```
mobile/
├── App.js                   ← entry point, wraps AuthProvider + AppNavigator
├── src/
│   ├── api/client.js        ← axios API calls to Flask backend
│   ├── context/AuthContext.js  ← login/register/logout state
│   ├── navigation/AppNavigator.js  ← bottom tabs + auth stack
│   └── screens/
│       ├── LoginScreen.js
│       ├── RegisterScreen.js
│       ├── DashboardScreen.js
│       ├── PostsScreen.js
│       ├── UploadScreen.js
│       ├── AnalyticsScreen.js
│       ├── EngagementScreen.js
│       ├── SettingsScreen.js
│       └── ProfileScreen.js
```
