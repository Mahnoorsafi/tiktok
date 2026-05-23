# SMCA — Social Media Campaign Automation (TikTok)
**Emerson University Multan · Faculty of Computing and Emerging Technologies**
Students: Muhammad Athar Ali (BSIT-22-16), Sheraz Umer (BSIT-22-27), Muhammad Awais Amin (BSIT-22-34)
Supervisor: Mr. Muhammad Manshah | Session 2022–2026

---

## What This System Does

SMCA lets you manage TikTok campaigns from a single dashboard:
- Upload videos and schedule them to post at a specific date/time
- Publish videos immediately to TikTok with one click
- View analytics (views, likes, comments, shares) for all posts
- Manage comments — read, like, and reply from the app
- Support multiple user accounts, each with their own TikTok connection

---

## System Architecture

```
Browser (localhost:8081)          Flask API (localhost:5000)
  React Native / Expo   <──────>   Python Backend + SQLite DB
        │                                    │
        │                              TikTok API
        │                         (open.tiktokapis.com)
        │
   TikTok OAuth
   (via ngrok tunnel → localhost:5000)
```

Three things must run simultaneously:
1. **Flask backend** — port 5000
2. **ngrok tunnel** — exposes port 5000 to the internet for TikTok OAuth callback
3. **Expo web app** — port 8081 (what you open in the browser)

---

## Prerequisites

### 1. Python 3.9 or higher
Download from https://www.python.org/downloads/
During install, check **"Add Python to PATH"**

Verify:
```
python --version
```

### 2. Node.js 18 or higher
Download from https://nodejs.org/
Choose the LTS version.

Verify:
```
node --version
npm --version
```

### 3. ngrok account + static domain
1. Sign up free at https://ngrok.com
2. Go to Dashboard → Domains → create a free static domain
3. Copy your static domain (e.g. `your-name.ngrok-free.app`)
4. Download ngrok and add your auth token:
   ```
   ngrok config add-authtoken YOUR_AUTHTOKEN
   ```

### 4. TikTok Developer App (Sandbox)
1. Go to https://developers.tiktok.com
2. Create an app → enable **Content Posting API** and **User Info Basic**
3. Set **Redirect URI** to:
   ```
   https://YOUR-NGROK-DOMAIN/auth/callback
   ```
4. Copy **Client Key** and **Client Secret**
5. Under **Sandbox**, add your test TikTok accounts (up to 5) — these are the accounts that can log in

---

## Installation

### Step 1 — Clone / extract the project
Place the project folder somewhere easy, e.g.:
```
C:\Users\YourName\smca\
```

### Step 2 — Install Python packages

Open a terminal in the project root folder:
```
cd C:\Users\YourName\smca
pip install flask flask-cors flask-sqlalchemy werkzeug apscheduler python-dotenv requests
```

All in one line:
```
pip install flask flask-cors flask-sqlalchemy werkzeug apscheduler python-dotenv requests
```

### Step 3 — Install Node packages for the mobile app
```
cd mobile
npm install
cd ..
```

### Step 4 — Configure environment variables

Copy the example file and fill in your values:
```
copy .env.example .env
```

Open `.env` and fill in:
```
SECRET_KEY=any-random-long-string-you-choose
DATABASE_URL=sqlite:///instance/smca_demo.db

TIKTOK_CLIENT_KEY=your_client_key_from_tiktok_developer_portal
TIKTOK_CLIENT_SECRET=your_client_secret_from_tiktok_developer_portal
TIKTOK_REDIRECT_URI=https://YOUR-NGROK-DOMAIN/auth/callback
```

**Important:** The `TIKTOK_REDIRECT_URI` must exactly match what you entered in the TikTok Developer Portal redirect URI.

---

## Running the System

Open **3 separate terminal windows**.

### Terminal 1 — Flask Backend
```
cd C:\Users\YourName\smca
python smca_flask_backend.py
```

You should see:
```
* Running on http://127.0.0.1:5000
```

### Terminal 2 — ngrok Tunnel
```
ngrok http --domain=YOUR-NGROK-DOMAIN 5000
```

Replace `YOUR-NGROK-DOMAIN` with your actual ngrok static domain, e.g.:
```
ngrok http --domain=agonizing-caress-unsaved.ngrok-free.dev 5000
```

You should see `Forwarding https://your-domain → http://localhost:5000`

### Terminal 3 — Expo Web App
```
cd C:\Users\YourName\smca\mobile
npx expo start --web
```

Then open your browser and go to:
```
http://localhost:8081
```

---

## First Time Setup

### 1. Register an account
- Go to `http://localhost:8081`
- Click **Sign up** → enter name, email, password → Create Account

### 2. Connect your TikTok account
- After logging in, click **Continue with TikTok** on the login screen
  OR go to **More → Profile → Connect TikTok**
- You will be redirected to TikTok's login page
- Log in with one of your **sandbox test accounts** (added in TikTok Developer Portal)
- You will be redirected back to the app automatically

> **Note:** Only TikTok accounts added as test users in your Developer Portal can log in while the app is in Sandbox mode.

### 3. Upload and schedule a video
- Go to the **Upload** tab
- Select a video file (MP4, under 64 MB for sandbox)
- Add a caption and hashtags
- Set privacy to **Private** (required for sandbox)
- Enter a schedule date/time (format: `2026-06-01T14:30`) or enable **Publish Now toggle**
- Click **Schedule Post** or **Upload as Draft**

### 4. Publish a post
- Go to the **Posts** tab
- Find a draft or scheduled post
- Click **Publish Now** → confirm
- The post uploads to TikTok and status changes to **Published** within ~30 seconds

---

## Using the App

### Posts Tab
| Status | Meaning |
|--------|---------|
| Draft | Uploaded but not yet sent to TikTok |
| Scheduled | Will auto-publish at the scheduled date/time |
| Publishing | Being uploaded to TikTok right now |
| Published | Live on TikTok |
| Failed | Upload failed — check error message on the card |

### Analytics Tab (Stats)
- Shows **all posts** with their current status
- Published posts show Views, Likes, Comments, Shares
- Click **↻ Sync Stats** on a published post to fetch latest numbers from TikTok

### Comments Tab (More → Comments)
- Shows comments from your TikTok videos
- Click **↻ Sync** to fetch latest comments from TikTok
- You can **Like** or **Reply** to any comment directly from the app

### Profile Tab (More → Profile)
- Shows your connected TikTok account info
- **Change Account** — disconnect current account and connect a different one
- **Disconnect** — remove TikTok connection without reconnecting

---

## Switching Between Test Accounts

To demonstrate with a different TikTok test account:
1. Go to **More → Profile**
2. Click **Change Account**
3. Confirm → TikTok login page opens in the same tab
4. Log in with a different test account
5. You are redirected back with the new account connected

---

## Network / ISP Issues (TikTok API Blocked)

In some countries (e.g. Pakistan), ISPs block `open.tiktokapis.com`. If you see:
```
Failed to resolve 'open.tiktokapis.com'
```

You need a VPN or proxy. Options:

**Option A — System VPN (easiest)**
Turn on any VPN on your Windows machine. All Python requests will route through it automatically.

**Option B — Cloudflare WARP (free)**
Download from https://1.1.1.1/ — free VPN/DNS resolver. Enable it, restart Flask.

**Option C — Local proxy**
If you have a proxy (e.g. Shadowsocks, Clash, V2Ray) running locally, add to `.env`:
```
HTTPS_PROXY=http://127.0.0.1:YOUR_PROXY_PORT
```
Then restart Flask.

---

## Troubleshooting

### "TikTok not connected" when publishing
→ Go to Profile → Connect TikTok and reconnect your account.

### "Video file not found" when publishing
→ The uploaded video file was deleted or the path changed. Re-upload the video.

### Posts screen shows old data after publishing
→ Hard refresh the browser: **Ctrl + Shift + R**

### TikTok OAuth redirects to wrong place
→ Make sure ngrok is running in Terminal 2. Check that `TIKTOK_REDIRECT_URI` in `.env` matches your ngrok domain exactly.

### Flask restarts and users get logged out
→ This is normal. The session cookie changes on restart. Users just need to log in again. TikTok OAuth works fine because the state is encoded in the URL.

### "401 Unauthorized" errors
→ Log out and log back in. The API token is stored in browser storage and refreshes on login.

### Comments not showing
→ Comments require TikTok API access. Make sure VPN is on, then click **↻ Sync** in the Comments tab.

### Scheduled posts not auto-publishing
→ Check the Flask terminal for `[job_publish]` logs every minute. Make sure **Auto Publish** is enabled in **More → Settings**.

---

## Project Structure

```
smca/
├── smca_flask_backend.py     # Flask API server (all backend logic)
├── .env                      # Your configuration (never share this)
├── .env.example              # Template for .env
├── instance/
│   └── smca_demo.db          # SQLite database (auto-created on first run)
├── uploads/                  # Uploaded video files (auto-created)
└── mobile/                   # React Native / Expo frontend
    ├── App.js
    ├── package.json
    └── src/
        ├── api/
        │   └── client.js     # All API calls to Flask
        ├── context/
        │   └── AuthContext.js
        ├── navigation/
        │   └── AppNavigator.js
        └── screens/
            ├── LoginScreen.js
            ├── RegisterScreen.js
            ├── DashboardScreen.js
            ├── PostsScreen.js
            ├── UploadScreen.js
            ├── AnalyticsScreen.js
            ├── EngagementScreen.js
            ├── SettingsScreen.js
            └── ProfileScreen.js
```

---

## Quick Start Cheat Sheet

```
# Terminal 1 — Flask
cd C:\path\to\smca
python smca_flask_backend.py

# Terminal 2 — ngrok
ngrok http --domain=YOUR-NGROK-DOMAIN 5000

# Terminal 3 — Expo
cd C:\path\to\smca\mobile
npx expo start --web

# Browser
http://localhost:8081
```

---

*SMCA — TikTok Campaign Automation | Emerson University Multan | 2022–2026*
