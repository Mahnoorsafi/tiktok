"""
SMCA â€” Social Media Campaign Automation (TikTok)
Flask Backend â€” FIXED VERSION with Supabase
Emerson University Multan Â· Faculty of Computing and Emerging Technologies
Students: Muhammad Athar Ali (BSIT-22-16), Sheraz Umer (BSIT-22-27),
          Muhammad Awais Amin (BSIT-22-34)
Supervisor: Mr. Muhammad Manshah | Session: 2022-2026
"""

import os, json, uuid, logging, hashlib, secrets, base64, math
from datetime import datetime
from functools import wraps
from urllib.parse import urlencode, quote

from flask import Flask, request, jsonify, session, redirect, send_from_directory
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from apscheduler.schedulers.background import BackgroundScheduler
from dotenv import load_dotenv
import requests as req

# â”€â”€ Optional proxy for regions where TikTok API is blocked â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# Set HTTPS_PROXY in your .env to route TikTok API calls through a proxy
# Example: HTTPS_PROXY=http://127.0.0.1:1080  (if you have a local SOCKS/HTTP proxy)
_TT_PROXIES = None
if os.environ.get("HTTPS_PROXY"):
    _TT_PROXIES = {"https": os.environ["HTTPS_PROXY"], "http": os.environ["HTTPS_PROXY"]}

# â”€â”€ .env file load karo â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
load_dotenv()

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
log = logging.getLogger(__name__)

# â”€â”€ Database URL fix â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
_BASE_DIR = os.path.dirname(os.path.abspath(__file__))

DATABASE_URL = os.getenv("DATABASE_URL", "")

# Resolve relative sqlite paths relative to script directory so the
# backend works regardless of the working directory it's launched from.
if DATABASE_URL.startswith("sqlite:///") and not DATABASE_URL.startswith("sqlite:////"):
    rel = DATABASE_URL[len("sqlite:///"):]
    if not os.path.isabs(rel):
        abs_path = os.path.join(_BASE_DIR, rel).replace("\\", "/")
        DATABASE_URL = f"sqlite:///{abs_path}"
        log.info(f"[db] resolved sqlite path â†’ {abs_path}")

if not DATABASE_URL:
    DATABASE_URL = f"sqlite:///{_BASE_DIR}/instance/smca_demo.db".replace("\\", "/")
    log.warning(f"[db] no DATABASE_URL in .env, using default: {DATABASE_URL}")

# PostgreSQL URL fix â€” agar @ password mein hai toh encode karo
# Example: D3479@gmail -> D3479%40gmail
if "postgresql" in DATABASE_URL and "@" in DATABASE_URL:
    # Check karo ke URL sahi format mein hai ya nahi
    try:
        from urllib.parse import urlparse
        parsed = urlparse(DATABASE_URL)
        if parsed.scheme in ("postgresql", "postgres"):
            log.info(f"Database: {parsed.scheme}://{parsed.hostname}")
    except Exception:
        pass

# â”€â”€ Flask app â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "smca_default_secret_change_in_production_2026")

app.config.update(
    SQLALCHEMY_DATABASE_URI=DATABASE_URL,
    SQLALCHEMY_TRACK_MODIFICATIONS=False,
    SQLALCHEMY_ENGINE_OPTIONS={
        "pool_pre_ping": True,       # Connection alive check
        "pool_recycle": 300,         # 5 min mein connection refresh
        "connect_args": {
            "connect_timeout": 10,   # 10 sec timeout
        } if "postgresql" in DATABASE_URL else {},
    },
    UPLOAD_FOLDER="uploads/",
    MAX_CONTENT_LENGTH=300 * 1024 * 1024,  # 300 MB
    SESSION_COOKIE_SAMESITE="None",
    SESSION_COOKIE_SECURE=False,  # False so localhost HTTP also works
)

_ngrok_origin = os.getenv("TIKTOK_REDIRECT_URI", "").split("/auth/")[0]
_allowed_origins = [
    "http://localhost:5000", "http://127.0.0.1:5000",
    "http://localhost:3000", "http://localhost:5500", "http://127.0.0.1:5500",
    "http://localhost:8081", "http://127.0.0.1:8081",
]
if _ngrok_origin:
    _allowed_origins.append(_ngrok_origin)
CORS(app, supports_credentials=True, origins=_allowed_origins)

db = SQLAlchemy(app)
os.makedirs("uploads", exist_ok=True)

# â”€â”€ TikTok config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
TT_CLIENT_KEY    = os.getenv("TIKTOK_CLIENT_KEY", "")
TT_CLIENT_SECRET = os.getenv("TIKTOK_CLIENT_SECRET", "")
TT_REDIRECT_URI  = os.getenv("TIKTOK_REDIRECT_URI", "http://localhost:5000/auth/tiktok/callback")
TT_API           = "https://open.tiktokapis.com/v2"
TT_PUBLIC_BASE   = TT_REDIRECT_URI.split("/auth/")[0] if "/auth/" in TT_REDIRECT_URI else "http://localhost:5000"

# Requests session â€” routes through proxy if HTTPS_PROXY is set in .env
_tt_session = req.Session()
if _TT_PROXIES:
    _tt_session.proxies.update(_TT_PROXIES)

# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# DATABASE MODELS
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

class User(db.Model):
    __tablename__ = "users"
    id                   = db.Column(db.Integer, primary_key=True)
    email                = db.Column(db.String(120), unique=True, nullable=False)
    password_hash        = db.Column(db.String(256), nullable=False)
    name                 = db.Column(db.String(100))
    role                 = db.Column(db.String(20), default="user")
    tiktok_username      = db.Column(db.String(100))
    tiktok_open_id       = db.Column(db.String(100))
    tiktok_access_token  = db.Column(db.Text)
    tiktok_refresh_token = db.Column(db.Text)
    tiktok_avatar_url    = db.Column(db.String(500))
    tiktok_followers     = db.Column(db.Integer, default=0)
    tiktok_following     = db.Column(db.Integer, default=0)
    tiktok_likes         = db.Column(db.Integer, default=0)
    tiktok_video_count   = db.Column(db.Integer, default=0)
    # Mobile auth token â€” sent as X-Auth-Token header by the app
    api_token            = db.Column(db.String(64), unique=True)
    created_at           = db.Column(db.DateTime, default=datetime.utcnow)

    posts     = db.relationship("Post",         backref="user",     lazy="dynamic")
    campaigns = db.relationship("Campaign",     backref="user",     lazy="dynamic")
    settings  = db.relationship("AutoSettings", backref="user",     uselist=False)

    def to_dict(self):
        return {
            "id":               self.id,
            "email":            self.email,
            "name":             self.name,
            "role":             self.role,
            "api_token":        self.api_token,
            "tiktok_username":  self.tiktok_username,
            "tiktok_connected": bool(self.tiktok_access_token),
            "tiktok_avatar":    self.tiktok_avatar_url or "",
            "tiktok_followers": self.tiktok_followers or 0,
            "tiktok_following": self.tiktok_following or 0,
            "tiktok_likes":     self.tiktok_likes or 0,
            "tiktok_videos":    self.tiktok_video_count or 0,
        }


class Campaign(db.Model):
    __tablename__ = "campaigns"
    id          = db.Column(db.Integer, primary_key=True)
    user_id     = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    name        = db.Column(db.String(150))
    description = db.Column(db.Text)
    status      = db.Column(db.String(30), default="active")
    created_at  = db.Column(db.DateTime, default=datetime.utcnow)
    posts       = db.relationship("Post", backref="campaign", lazy="dynamic")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "status": self.status,
            "post_count": self.posts.count(),
            "created_at": self.created_at.isoformat(),
        }


class Post(db.Model):
    __tablename__ = "posts"
    id              = db.Column(db.Integer, primary_key=True)
    user_id         = db.Column(db.Integer, db.ForeignKey("users.id"),     nullable=False)
    campaign_id     = db.Column(db.Integer, db.ForeignKey("campaigns.id"), nullable=True)
    caption         = db.Column(db.Text)
    hashtags        = db.Column(db.Text, default="[]")
    video_path      = db.Column(db.String(300))
    scheduled_at    = db.Column(db.DateTime)
    published_at    = db.Column(db.DateTime)
    status          = db.Column(db.String(30), default="draft")
    privacy         = db.Column(db.String(40), default="PUBLIC_TO_EVERYONE")
    allow_comments  = db.Column(db.Boolean,    default=True)
    allow_duet      = db.Column(db.Boolean,    default=True)
    allow_stitch    = db.Column(db.Boolean,    default=True)
    tiktok_video_id = db.Column(db.String(100))
    retry_count     = db.Column(db.Integer,    default=0)
    error_message   = db.Column(db.Text)
    created_at      = db.Column(db.DateTime,   default=datetime.utcnow)

    analytics = db.relationship("PostAnalytics", backref="post", lazy="dynamic",
                                cascade="all, delete-orphan")
    comments  = db.relationship("Comment",       backref="post", lazy="dynamic",
                                cascade="all, delete-orphan")

    def to_dict(self):
        latest = self.analytics.order_by(PostAnalytics.fetched_at.desc()).first()
        return {
            "id": self.id,
            "campaign_id": self.campaign_id,
            "caption": self.caption,
            "hashtags": json.loads(self.hashtags) if self.hashtags else [],
            "scheduled_at": self.scheduled_at.isoformat() if self.scheduled_at else None,
            "published_at": self.published_at.isoformat() if self.published_at else None,
            "status": self.status,
            "privacy": self.privacy,
            "allow_comments": self.allow_comments,
            "tiktok_video_id": self.tiktok_video_id,
            "error_message": self.error_message,
            "created_at": self.created_at.isoformat(),
            "analytics": {
                "views":    latest.views,
                "likes":    latest.likes,
                "comments": latest.comments,
                "shares":   latest.shares,
            } if latest else None,
        }


class PostAnalytics(db.Model):
    __tablename__ = "post_analytics"
    id             = db.Column(db.Integer, primary_key=True)
    post_id        = db.Column(db.Integer, db.ForeignKey("posts.id"), nullable=False)
    views          = db.Column(db.Integer, default=0)
    likes          = db.Column(db.Integer, default=0)
    comments       = db.Column(db.Integer, default=0)
    shares         = db.Column(db.Integer, default=0)
    profile_visits = db.Column(db.Integer, default=0)
    follows        = db.Column(db.Integer, default=0)
    fetched_at     = db.Column(db.DateTime, default=datetime.utcnow)


class Comment(db.Model):
    __tablename__ = "comments"
    id                = db.Column(db.Integer, primary_key=True)
    post_id           = db.Column(db.Integer, db.ForeignKey("posts.id"), nullable=False)
    user_id           = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    tiktok_comment_id = db.Column(db.String(100), unique=True)
    commenter_name    = db.Column(db.String(100))
    commenter_avatar  = db.Column(db.String(300))
    text              = db.Column(db.Text)
    auto_replied      = db.Column(db.Boolean, default=False)
    auto_liked        = db.Column(db.Boolean, default=False)
    created_at        = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "post_id": self.post_id,
            "commenter_name": self.commenter_name,
            "commenter_avatar": self.commenter_avatar,
            "text": self.text,
            "auto_replied": self.auto_replied,
            "auto_liked": self.auto_liked,
            "created_at": self.created_at.isoformat(),
        }


class AutoSettings(db.Model):
    __tablename__ = "auto_settings"
    id                   = db.Column(db.Integer, primary_key=True)
    user_id              = db.Column(db.Integer, db.ForeignKey("users.id"), unique=True)
    auto_publish         = db.Column(db.Boolean, default=True)
    auto_reply           = db.Column(db.Boolean, default=True)
    auto_like_comments   = db.Column(db.Boolean, default=False)
    auto_follow_back     = db.Column(db.Boolean, default=False)
    smart_reply          = db.Column(db.Boolean, default=True)
    reply_template_1     = db.Column(db.Text, default="Thanks for watching! Follow for more!")
    reply_template_2     = db.Column(db.Text, default="Love your support! Stay tuned!")
    reply_template_3     = db.Column(db.Text, default="You are awesome! More coming soon!")
    retry_on_fail        = db.Column(db.Boolean, default=True)
    analytics_digest     = db.Column(db.Boolean, default=True)
    default_privacy      = db.Column(db.String(40), default="PUBLIC_TO_EVERYONE")
    default_caption_tmpl = db.Column(db.Text, default="#fyp #viral #trending")
    timezone             = db.Column(db.String(50), default="Asia/Karachi")
    reply_index          = db.Column(db.Integer, default=0)

    def next_reply(self):
        templates = [self.reply_template_1, self.reply_template_2, self.reply_template_3]
        t = templates[self.reply_index % 3]
        self.reply_index = (self.reply_index + 1) % 3
        db.session.commit()
        return t

    def to_dict(self):
        return {
            "auto_publish":         self.auto_publish,
            "auto_reply":           self.auto_reply,
            "auto_like_comments":   self.auto_like_comments,
            "auto_follow_back":     self.auto_follow_back,
            "smart_reply":          self.smart_reply,
            "reply_template_1":     self.reply_template_1,
            "reply_template_2":     self.reply_template_2,
            "reply_template_3":     self.reply_template_3,
            "retry_on_fail":        self.retry_on_fail,
            "analytics_digest":     self.analytics_digest,
            "default_privacy":      self.default_privacy,
            "default_caption_tmpl": self.default_caption_tmpl,
            "timezone":             self.timezone,
        }


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# AUTH HELPERS
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

def _resolve_user_from_request():
    """Return user from Flask session OR X-Auth-Token header."""
    if "user_id" in session:
        return User.query.get(session["user_id"])
    token = request.headers.get("X-Auth-Token")
    if token:
        user = User.query.filter_by(api_token=token).first()
        if user:
            session["user_id"] = user.id   # cache for this request
            return user
    return None

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not _resolve_user_from_request():
            return jsonify({"error": "Authentication required"}), 401
        return f(*args, **kwargs)
    return decorated

def get_user():
    return _resolve_user_from_request()


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# TIKTOK API HELPERS
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

def get_or_create_user_from_tiktok(tok_data):
    """Create or fetch existing user using TikTok open_id (for OAuth signup flow)."""
    open_id = tok_data.get("open_id")
    if not open_id:
        return None, "No open_id returned from TikTok"

    user = User.query.filter_by(tiktok_open_id=open_id).first()
    access_token = tok_data.get("access_token")

    if user:
        user.tiktok_access_token  = access_token
        user.tiktok_refresh_token = tok_data.get("refresh_token")
        if not user.api_token:
            user.api_token = uuid.uuid4().hex
        _tt_refresh_profile(user)
        db.session.commit()
        return user, None

    # Fetch display name + avatar from TikTok
    display_name, avatar_url = f"tiktok_{open_id[:8]}", ""
    followers = following = likes = video_count = 0
    try:
        hdrs = {"Authorization": f"Bearer {access_token}"}
        resp = _tt_session.get(
            f"{TT_API}/user/info/",
            headers=hdrs,
            params={"fields": "open_id,union_id,avatar_url,display_name,follower_count,following_count,likes_count,video_count"},
            timeout=8,
        )
        u = resp.json().get("data", {}).get("user", {})
        display_name = u.get("display_name", display_name)
        avatar_url   = u.get("avatar_url", "")
        followers    = u.get("follower_count", 0)
        following    = u.get("following_count", 0)
        likes        = u.get("likes_count", 0)
        video_count  = u.get("video_count", 0)
    except Exception as e:
        log.warning(f"[tt_signup] Could not fetch TikTok profile: {e}")

    email = f"{open_id}@tiktok.smca.local"
    if User.query.filter_by(email=email).first():
        email = f"{open_id}_{uuid.uuid4().hex[:6]}@tiktok.smca.local"

    user = User(
        email=email,
        password_hash=generate_password_hash(uuid.uuid4().hex),
        name=display_name,
        role="user",
        tiktok_open_id=open_id,
        tiktok_username=display_name,
        tiktok_access_token=access_token,
        tiktok_refresh_token=tok_data.get("refresh_token"),
        tiktok_avatar_url=avatar_url,
        tiktok_followers=followers,
        tiktok_following=following,
        tiktok_likes=likes,
        tiktok_video_count=video_count,
        api_token=uuid.uuid4().hex,
    )
    db.session.add(user)
    db.session.flush()
    db.session.add(AutoSettings(user_id=user.id))
    db.session.commit()
    return user, None


def _tt_refresh_profile(user):
    """Refresh TikTok profile data for an existing user (best-effort)."""
    if not user.tiktok_access_token:
        return
    try:
        hdrs = {"Authorization": f"Bearer {user.tiktok_access_token}"}
        # Try full fields first, fall back to basic if stats scope not approved
        for fields in [
            "open_id,union_id,avatar_url,display_name,follower_count,following_count,likes_count,video_count",
            "open_id,union_id,avatar_url,display_name",
        ]:
            resp = _tt_session.get(
                f"{TT_API}/user/info/",
                headers=hdrs,
                params={"fields": fields},
                timeout=8,
            )
            d = resp.json()
            log.info(f"[tt_profile] fields={fields.split(',')[0]}â€¦ resp={d}")
            if d.get("error", {}).get("code") in ("access_token_invalid", "scope_not_authorized"):
                continue
            u = d.get("data", {}).get("user", {})
            if u:
                if u.get("display_name"):
                    user.tiktok_username = u["display_name"]
                    user.name = user.name or u["display_name"]
                if u.get("avatar_url"):
                    user.tiktok_avatar_url = u["avatar_url"]
                if u.get("follower_count") is not None:
                    user.tiktok_followers = u["follower_count"]
                if u.get("following_count") is not None:
                    user.tiktok_following = u["following_count"]
                if u.get("likes_count") is not None:
                    user.tiktok_likes = u["likes_count"]
                if u.get("video_count") is not None:
                    user.tiktok_video_count = u["video_count"]
                break
    except Exception as e:
        log.warning(f"[tt_profile] refresh failed: {e}")


# Server-side PKCE store â€” keyed by state, survives cross-domain redirects
_pkce_store = {}

def _pkce_pair():
    verifier  = base64.urlsafe_b64encode(secrets.token_bytes(32)).rstrip(b"=").decode()
    challenge = base64.urlsafe_b64encode(
        hashlib.sha256(verifier.encode()).digest()
    ).rstrip(b"=").decode()
    return verifier, challenge

def tt_auth_url(api_token=None, from_rn=False):
    scope = "user.info.basic,user.info.profile,user.info.stats,video.upload,video.publish,video.list"
    # Prefix state with "rn_" or "web_" so the callback can detect from_rn even if
    # _pkce_store is lost due to a Flask restart between auth and callback.
    prefix = "rn" if from_rn else "web"
    state = f"{prefix}_{uuid.uuid4().hex}"
    verifier, challenge = _pkce_pair()
    _pkce_store[state] = {"verifier": verifier, "api_token": api_token, "from_rn": from_rn}
    params = urlencode({
        "client_key":           TT_CLIENT_KEY,
        "response_type":        "code",
        "scope":                scope,
        "redirect_uri":         TT_REDIRECT_URI,
        "state":                state,
        "code_challenge":       challenge,
        "code_challenge_method":"S256",
    })
    return f"https://www.tiktok.com/v2/auth/authorize/?{params}"

def tt_exchange_code(code, state=None):
    stored    = _pkce_store.pop(state, {}) if state else {}
    verifier  = stored.get("verifier")  if isinstance(stored, dict) else stored
    api_token = stored.get("api_token") if isinstance(stored, dict) else None
    # Fallback: detect from_rn from state prefix in case _pkce_store was lost (Flask restart)
    from_rn_fallback = (state or "").startswith("rn_")
    from_rn   = stored.get("from_rn", from_rn_fallback) if isinstance(stored, dict) else from_rn_fallback
    payload  = {
        "client_key":    TT_CLIENT_KEY,
        "client_secret": TT_CLIENT_SECRET,
        "code":          code,
        "grant_type":    "authorization_code",
        "redirect_uri":  TT_REDIRECT_URI,
    }
    if verifier:
        payload["code_verifier"] = verifier
    r = _tt_session.post(f"{TT_API}/oauth/token/", data=payload)
    return r.json(), api_token, from_rn

_TT_SANDBOX_MAX = 64 * 1024 * 1024   # TikTok sandbox: 1 chunk, max 64 MB

class TikTokAccountError(Exception):
    """Raised for account-level config issues (not transient) â€” scheduler should not count as failure."""
    pass

def _tt_refresh_access_token(user):
    """Refresh TikTok access token using the stored refresh_token. Returns True on success."""
    if not user.tiktok_refresh_token:
        log.warning(f"[tt_token] No refresh_token for user {user.id}")
        return False
    try:
        r = _tt_session.post(f"{TT_API}/oauth/token/", data={
            "client_key":     TT_CLIENT_KEY,
            "client_secret":  TT_CLIENT_SECRET,
            "grant_type":     "refresh_token",
            "refresh_token":  user.tiktok_refresh_token,
        })
        tok = r.json()
        new_access = tok.get("access_token")
        if new_access:
            user.tiktok_access_token  = new_access
            user.tiktok_refresh_token = tok.get("refresh_token", user.tiktok_refresh_token)
            db.session.commit()
            log.info(f"[tt_token] Token refreshed for user {user.id}")
            return True
        log.warning(f"[tt_token] Refresh failed: {tok}")
    except Exception as e:
        log.warning(f"[tt_token] Refresh error: {e}")
    return False

def tt_publish_video(user, post):
    import time as _time

    # Proactively refresh token â€” TikTok sandbox tokens expire every 24 h
    _tt_refresh_access_token(user)

    hdrs_json = {
        "Authorization": f"Bearer {user.tiktok_access_token}",
        "Content-Type": "application/json; charset=UTF-8",
    }

    if not post.video_path or not os.path.exists(post.video_path):
        raise RuntimeError(f"Video file not found: {post.video_path}")

    file_size = os.path.getsize(post.video_path)

    def _build_post_info(privacy_override=None):
        return {
            "title":                     (post.caption or "TikTok video")[:150],
            "privacy_level":             privacy_override or post.privacy or "SELF_ONLY",
            "disable_comment":           not post.allow_comments,
            "disable_duet":              not post.allow_duet,
            "disable_stitch":            not post.allow_stitch,
            "video_cover_timestamp_ms":  0,
            "brand_content_toggle":      False,
            "brand_organic_toggle":      False,
        }

    def _do_init(post_info, source_info):
        r = _tt_session.post(f"{TT_API}/post/publish/video/init/", headers=hdrs_json,
                     json={"post_info": post_info, "source_info": source_info})
        d = r.json()
        log.info(f"[tt_publish] init response: {d}")
        err_code = d.get("error", {}).get("code", "ok")
        if err_code in ("access_token_invalid", "access_token_expired"):
            # Token expired between refresh attempt and now â€” retry refresh once
            if _tt_refresh_access_token(user):
                hdrs_json["Authorization"] = f"Bearer {user.tiktok_access_token}"
                r = _tt_session.post(f"{TT_API}/post/publish/video/init/", headers=hdrs_json,
                             json={"post_info": post_info, "source_info": source_info})
                d = r.json()
                log.info(f"[tt_publish] init after token refresh: {d}")
                err_code = d.get("error", {}).get("code", "ok")
        if err_code == "unaudited_client_can_only_post_to_private_accounts":
            log.warning("[tt_publish] Unaudited app â€” retrying with SELF_ONLY privacy")
            post_info["privacy_level"] = "SELF_ONLY"
            r = _tt_session.post(f"{TT_API}/post/publish/video/init/", headers=hdrs_json,
                         json={"post_info": post_info, "source_info": source_info})
            d = r.json()
            log.info(f"[tt_publish] init SELF_ONLY retry: {d}")
            err_code = d.get("error", {}).get("code", "ok")
        if err_code == "unaudited_client_can_only_post_to_private_accounts":
            raise TikTokAccountError(
                "TikTok account must be set to Private. "
                "Open TikTok â†’ Settings & Privacy â†’ Privacy â†’ enable Private Account."
            )
        if err_code not in ("ok",):
            msg = d.get("error", {}).get("message", "") or str(d)
            raise RuntimeError(f"TikTok error [{err_code}]: {msg}")
        return d, err_code

    if file_size <= _TT_SANDBOX_MAX:
        # â”€â”€ FILE_UPLOAD: single chunk (works in sandbox, no domain needed) â”€â”€
        log.info(f"[tt_publish] FILE_UPLOAD single-chunk size={file_size}")
        source_info = {
            "source":            "FILE_UPLOAD",
            "video_size":        file_size,
            "chunk_size":        file_size,
            "total_chunk_count": 1,
        }
        init_d, _ = _do_init(_build_post_info(), source_info)

        upload_url = init_d["data"]["upload_url"]
        publish_id = init_d["data"]["publish_id"]

        with open(post.video_path, "rb") as f:
            video_bytes = f.read()
        up_hdrs = {
            "Content-Range":  f"bytes 0-{file_size - 1}/{file_size}",
            "Content-Type":   "video/mp4",
            "Content-Length": str(file_size),
        }
        up_r = _tt_session.put(upload_url, headers=up_hdrs, data=video_bytes, timeout=300)
        log.info(f"[tt_publish] upload â†’ HTTP {up_r.status_code} body={up_r.text[:200]}")
        if up_r.status_code not in (200, 201, 206):
            raise RuntimeError(f"TikTok video upload failed: HTTP {up_r.status_code} â€” {up_r.text[:300]}")

    else:
        # â”€â”€ PULL_FROM_URL: TikTok fetches from our public ngrok URL â”€â”€â”€â”€â”€â”€
        video_url = f"{TT_PUBLIC_BASE}/api/video/{post.id}"
        log.info(f"[tt_publish] PULL_FROM_URL size={file_size//1024//1024}MB url={video_url}")
        source_info = {"source": "PULL_FROM_URL", "video_url": video_url}
        init_d, err_code = _do_init(_build_post_info(), source_info)
        if err_code == "url_ownership_unverified":
            raise RuntimeError(
                f"Video is {file_size//1024//1024} MB (>64 MB sandbox limit). "
                "TikTok requires domain verification for PULL_FROM_URL. "
                "Go to developers.tiktok.com â†’ your app â†’ Content Posting API â†’ "
                "add 'agonizing-caress-unsaved.ngrok-free.dev' to URL Ownership."
            )
        publish_id = init_d["data"]["publish_id"]

    # Return immediately â€” job_publish scheduler will poll for PUBLISH_COMPLETE
    # in the background every minute and finalize the status then.
    log.info(f"[tt_publish] upload accepted â€” returning publish_id={publish_id} for background check")
    return publish_id, ""

def tt_get_video_stats(user, video_id):
    r = _tt_session.get(f"{TT_API}/video/query/",
        headers={"Authorization": f"Bearer {user.tiktok_access_token}"},
        params={
            "fields":  "like_count,comment_count,share_count,view_count,profile_deep_view_count",
            "filters": json.dumps({"video_ids": [video_id]}),
        })
    videos = r.json().get("data", {}).get("videos", [])
    return videos[0] if videos else {}

def tt_get_comments(user, video_id):
    r = _tt_session.get(f"{TT_API}/video/comment/list/",
        headers={"Authorization": f"Bearer {user.tiktok_access_token}"},
        params={"video_id": video_id,
                "fields": "id,text,create_time,like_count,username,avatar_url"})
    return r.json().get("data", {}).get("comments", [])

def tt_reply_comment(user, video_id, comment_id, text):
    return _tt_session.post(f"{TT_API}/video/comment/reply/",
        headers={"Authorization": f"Bearer {user.tiktok_access_token}"},
        json={"video_id": video_id, "comment_id": comment_id, "text": text}).json()

def tt_like_comment(user, video_id, comment_id):
    return _tt_session.post(f"{TT_API}/video/comment/like/",
        headers={"Authorization": f"Bearer {user.tiktok_access_token}"},
        json={"video_id": video_id, "comment_id": comment_id}).json()


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# BACKGROUND SCHEDULER JOBS
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

scheduler = BackgroundScheduler(timezone="UTC")

def job_publish():
    with app.app_context():
        now = datetime.utcnow()

        # â”€â”€ 1. Finalize posts stuck in "publishing" â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        pending = Post.query.filter_by(status="publishing").all()
        for post in pending:
            if not post.tiktok_video_id:
                continue
            user = User.query.get(post.user_id)
            if not user or not user.tiktok_access_token:
                continue
            try:
                hdrs = {
                    "Authorization": f"Bearer {user.tiktok_access_token}",
                    "Content-Type": "application/json; charset=UTF-8",
                }
                st_r = _tt_session.post(f"{TT_API}/post/publish/status/fetch/",
                                headers=hdrs,
                                json={"publish_id": post.tiktok_video_id},
                                timeout=8)
                st_d    = st_r.json()
                pstatus = st_d.get("data", {}).get("status", "")
                vid_id  = st_d.get("data", {}).get("video_id", "")
                log.info(f"[publish] status-check post {post.id}: {pstatus} vid={vid_id}")
                if pstatus == "PUBLISH_COMPLETE" or vid_id:
                    post.status          = "published"
                    post.tiktok_video_id = vid_id or post.tiktok_video_id
                    db.session.commit()
                    log.info(f"[publish] Post {post.id} confirmed published â†’ {vid_id}")
                elif pstatus == "FAILED":
                    fail_reason = st_d.get("data", {}).get("fail_reason", str(st_d))
                    post.status        = "failed"
                    post.error_message = f"TikTok: {fail_reason}"
                    db.session.commit()
                    log.error(f"[publish] Post {post.id} failed: {fail_reason}")
                # else still PROCESSING â€” leave as "publishing", retry next minute
            except Exception as exc:
                log.warning(f"[publish] status-check post {post.id}: {exc}")

        # â”€â”€ 2. Auto-publish newly due scheduled posts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        posts = Post.query.filter(
            Post.status == "scheduled",
            Post.scheduled_at <= now
        ).all()
        for post in posts:
            user = User.query.get(post.user_id)
            settings = user.settings
            if not settings or not settings.auto_publish:
                continue
            try:
                pub_id, vid_id = tt_publish_video(user, post)
                post.status          = "published"
                post.published_at    = datetime.utcnow()
                post.tiktok_video_id = vid_id or pub_id
                post.retry_count     = 0
                post.error_message   = None
                db.session.commit()
                log.info(f"[publish] Post {post.id} published (pub_id={pub_id} vid={vid_id})")
            except TikTokAccountError as exc:
                post.error_message = str(exc)
                db.session.commit()
                log.warning(f"[publish] Post {post.id} skipped (account config): {exc}")
            except Exception as exc:
                post.retry_count  += 1
                post.error_message = str(exc)
                if post.retry_count >= 3:
                    post.status = "failed"
                db.session.commit()
                log.error(f"[publish] Post {post.id} error (attempt {post.retry_count}): {exc}")

def job_analytics():
    with app.app_context():
        posts = Post.query.filter_by(status="published").filter(
            Post.tiktok_video_id.isnot(None)).all()
        for post in posts:
            user = User.query.get(post.user_id)
            try:
                stats = tt_get_video_stats(user, post.tiktok_video_id)
                rec = PostAnalytics(
                    post_id=post.id,
                    views=stats.get("view_count", 0),
                    likes=stats.get("like_count", 0),
                    comments=stats.get("comment_count", 0),
                    shares=stats.get("share_count", 0),
                    profile_visits=stats.get("profile_deep_view_count", 0),
                )
                db.session.add(rec)
                db.session.commit()
            except Exception as exc:
                log.error(f"[analytics] Post {post.id}: {exc}")

def job_engage():
    with app.app_context():
        posts = Post.query.filter_by(status="published").filter(
            Post.tiktok_video_id.isnot(None)).all()
        for post in posts:
            user     = User.query.get(post.user_id)
            settings = user.settings
            if not settings:
                continue
            try:
                raw = tt_get_comments(user, post.tiktok_video_id)
                for c in raw:
                    if Comment.query.filter_by(tiktok_comment_id=c["id"]).first():
                        continue
                    nc = Comment(
                        post_id=post.id, user_id=user.id,
                        tiktok_comment_id=c["id"],
                        commenter_name=c.get("username", "User"),
                        commenter_avatar=c.get("avatar_url", ""),
                        text=c.get("text", ""),
                    )
                    db.session.add(nc)
                    db.session.flush()
                    if settings.auto_like_comments:
                        tt_like_comment(user, post.tiktok_video_id, c["id"])
                        nc.auto_liked = True
                    if settings.auto_reply:
                        tmpl = settings.next_reply() if settings.smart_reply else settings.reply_template_1
                        tt_reply_comment(user, post.tiktok_video_id, c["id"], tmpl)
                        nc.auto_replied = True
                    db.session.commit()
            except Exception as exc:
                log.error(f"[engage] Post {post.id}: {exc}")

scheduler.add_job(job_publish,   "interval", minutes=1,  id="publish")
scheduler.add_job(job_analytics, "interval", hours=1,    id="analytics")
scheduler.add_job(job_engage,    "interval", minutes=15, id="engage")
scheduler.start()


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# AUTH ROUTES
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

@app.route("/api/auth/register", methods=["POST"])
def register():
    d = request.get_json()
    if not d.get("email") or not d.get("password"):
        return jsonify({"error": "Email and password required"}), 400
    if User.query.filter_by(email=d["email"]).first():
        return jsonify({"error": "Email already registered"}), 409
    user = User(
        email=d["email"],
        password_hash=generate_password_hash(d["password"]),
        name=d.get("name", ""),
        role=d.get("role", "user"),
        api_token=uuid.uuid4().hex,
    )
    db.session.add(user)
    db.session.flush()
    db.session.add(AutoSettings(user_id=user.id))
    db.session.commit()
    session["user_id"] = user.id
    return jsonify({"user": user.to_dict()}), 201

@app.route("/api/auth/login", methods=["POST"])
def login():
    d = request.get_json()
    user = User.query.filter_by(email=d.get("email")).first()
    if not user or not check_password_hash(user.password_hash, d.get("password", "")):
        return jsonify({"error": "Invalid email or password"}), 401
    if not user.api_token:
        user.api_token = uuid.uuid4().hex
        db.session.commit()
    session["user_id"] = user.id
    return jsonify({"user": user.to_dict()})

@app.route("/api/auth/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"message": "Logged out"})

@app.route("/api/auth/me")
@login_required
def me():
    return jsonify({"user": get_user().to_dict()})


# â”€â”€ TikTok OAuth â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

@app.route("/auth/tiktok/signup")
def tiktok_signup():
    """TikTok login/signup from web HTML â€” no session required."""
    return jsonify({"auth_url": tt_auth_url()})

@app.route("/auth/tiktok/login-mobile")
def tiktok_login_mobile():
    """TikTok login/signup from React Native app â€” sets from_rn=True so token is returned in redirect."""
    return jsonify({"auth_url": tt_auth_url(from_rn=True)})

@app.route("/auth/tiktok")
def tiktok_connect():
    """Connect TikTok to an existing account â€” embeds api_token + from_rn in state."""
    user = _resolve_user_from_request()
    api_token = user.api_token if user else None
    from_rn = bool(request.headers.get("X-Auth-Token") or request.args.get("from_rn"))
    return jsonify({"auth_url": tt_auth_url(api_token=api_token, from_rn=from_rn)})

@app.route("/auth/callback")
@app.route("/auth/tiktok/callback")
def tiktok_callback():
    """
    TikTok redirects here after user authorises.
    Priority for finding the user to link:
      1. api_token embedded in OAuth state (React Native / cross-domain)
      2. Flask session (same-domain web app)
      3. Signup â€” create new user by open_id
    """
    error_param = request.args.get("error")
    if error_param:
        return redirect(f"/?error={quote(error_param)}")

    code  = request.args.get("code")
    state = request.args.get("state")
    if not code:
        return redirect("/?error=missing_code")

    tok, state_api_token, from_rn = tt_exchange_code(code, state)
    err_info = tok.get("error", {})
    if isinstance(err_info, dict) and err_info.get("code", "ok") != "ok":
        base = "http://localhost:8081" if from_rn else ""
        return redirect(f"{base}/?error={quote(str(err_info.get('message', 'token_error')))}")

    # Find existing user: try state api_token first, then Flask session
    existing_user = None
    if state_api_token:
        existing_user = User.query.filter_by(api_token=state_api_token).first()
    if not existing_user:
        existing_user = _resolve_user_from_request()

    rn_app_base = "http://localhost:8081"
    base = rn_app_base if from_rn else ""

    if existing_user:
        # Connect TikTok to existing account
        existing_user.tiktok_access_token  = tok.get("access_token")
        existing_user.tiktok_refresh_token = tok.get("refresh_token")
        existing_user.tiktok_open_id       = tok.get("open_id")
        if not existing_user.api_token:
            existing_user.api_token = uuid.uuid4().hex
        _tt_refresh_profile(existing_user)
        db.session.commit()
        name = quote(existing_user.tiktok_username or existing_user.name or "User")
        token_param = f"&token={existing_user.api_token}" if from_rn else ""
        return redirect(f"{base}/?connected=1&name={name}{token_param}")
    else:
        # Signup / login via TikTok â€” create or find user by open_id
        user, err = get_or_create_user_from_tiktok(tok)
        if err or not user:
            return redirect(f"{base}/?error={quote(str(err or 'signup_failed'))}")
        session["user_id"] = user.id
        name = quote(user.tiktok_username or user.name or "User")
        token_param = f"&token={user.api_token}" if from_rn else ""
        return redirect(f"{base}/?tiktok_login=1&name={name}{token_param}")

@app.route("/api/tiktok/profile")
@login_required
def tiktok_profile():
    user = get_user()
    if user.tiktok_access_token:
        _tt_refresh_profile(user)
        db.session.commit()
    return jsonify({
        "connected":  bool(user.tiktok_access_token),
        "username":   user.tiktok_username or "",
        "avatar":     user.tiktok_avatar_url or "",
        "followers":  user.tiktok_followers or 0,
        "following":  user.tiktok_following or 0,
        "likes":      user.tiktok_likes or 0,
        "videos":     user.tiktok_video_count or 0,
    })

@app.route("/api/tiktok/videos")
@login_required
def tiktok_videos():
    """Fetch the user's published TikTok videos from TikTok API."""
    user = get_user()
    if not user.tiktok_access_token:
        return jsonify({"videos": []})
    try:
        hdrs = {"Authorization": f"Bearer {user.tiktok_access_token}"}
        r = _tt_session.post(
            f"{TT_API}/video/list/",
            headers=hdrs,
            params={"fields": "id,title,cover_image_url,share_url,view_count,like_count,comment_count,share_count,create_time"},
            json={"max_count": 20},
            timeout=10,
        )
        d = r.json()
        log.info(f"[tt_videos] response: {d}")
        videos = d.get("data", {}).get("videos", [])
        return jsonify({"videos": videos})
    except Exception as e:
        log.warning(f"[tt_videos] failed: {e}")
        return jsonify({"videos": [], "error": str(e)})


@app.route("/api/tiktok/disconnect", methods=["POST"])
@login_required
def tiktok_disconnect():
    """Clear all TikTok credentials so the user can connect a different account."""
    user = get_user()
    user.tiktok_access_token  = None
    user.tiktok_refresh_token = None
    user.tiktok_open_id       = None
    user.tiktok_username      = None
    user.tiktok_avatar_url    = None
    db.session.commit()
    return jsonify({"ok": True, "message": "TikTok account disconnected."})


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# CAMPAIGN ROUTES
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

@app.route("/api/campaigns", methods=["GET"])
@login_required
def list_campaigns():
    camps = Campaign.query.filter_by(user_id=session["user_id"]).order_by(
        Campaign.created_at.desc()).all()
    return jsonify({"campaigns": [c.to_dict() for c in camps]})

@app.route("/api/campaigns", methods=["POST"])
@login_required
def create_campaign():
    d = request.get_json()
    c = Campaign(user_id=session["user_id"],
                 name=d["name"], description=d.get("description", ""))
    db.session.add(c); db.session.commit()
    return jsonify({"campaign": c.to_dict()}), 201

@app.route("/api/campaigns/<int:cid>", methods=["PUT"])
@login_required
def update_campaign(cid):
    c = Campaign.query.filter_by(id=cid, user_id=session["user_id"]).first_or_404()
    d = request.get_json()
    for k in ("name", "description", "status"):
        if k in d: setattr(c, k, d[k])
    db.session.commit()
    return jsonify({"campaign": c.to_dict()})

@app.route("/api/campaigns/<int:cid>", methods=["DELETE"])
@login_required
def delete_campaign(cid):
    c = Campaign.query.filter_by(id=cid, user_id=session["user_id"]).first_or_404()
    db.session.delete(c); db.session.commit()
    return jsonify({"message": "Campaign deleted"})


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# POST ROUTES
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

@app.route("/api/posts", methods=["GET"])
@login_required
def list_posts():
    status = request.args.get("status")
    cid    = request.args.get("campaign_id")
    q = Post.query.filter_by(user_id=session["user_id"])
    if status: q = q.filter_by(status=status)
    if cid:    q = q.filter_by(campaign_id=cid)
    posts = q.order_by(Post.created_at.desc()).all()
    return jsonify({"posts": [p.to_dict() for p in posts]})

@app.route("/api/posts", methods=["POST"])
@login_required
def create_post():
    d = request.get_json()
    sched = None
    if d.get("scheduled_at"):
        raw = d["scheduled_at"].strip().replace(" ", "T")
        if len(raw) == 16:  # YYYY-MM-DDTHH:MM â€” add seconds for Python <3.11
            raw += ":00"
        sched = datetime.fromisoformat(raw)
    p = Post(
        user_id=session["user_id"],
        campaign_id=d.get("campaign_id"),
        caption=d.get("caption", ""),
        hashtags=json.dumps(d.get("hashtags", [])),
        video_path=d.get("video_path"),
        scheduled_at=sched,
        status="scheduled" if sched else "draft",
        privacy=d.get("privacy", "PUBLIC_TO_EVERYONE"),
        allow_comments=d.get("allow_comments", True),
        allow_duet=d.get("allow_duet", True),
        allow_stitch=d.get("allow_stitch", True),
    )
    db.session.add(p); db.session.commit()
    return jsonify({"post": p.to_dict()}), 201

@app.route("/api/posts/<int:pid>", methods=["PUT"])
@login_required
def update_post(pid):
    p = Post.query.filter_by(id=pid, user_id=session["user_id"]).first_or_404()
    d = request.get_json()
    for k in ("caption", "status", "privacy", "allow_comments", "allow_duet", "allow_stitch"):
        if k in d: setattr(p, k, d[k])
    if "hashtags" in d:
        p.hashtags = json.dumps(d["hashtags"])
    if "scheduled_at" in d:
        p.scheduled_at = datetime.fromisoformat(d["scheduled_at"]) if d["scheduled_at"] else None
    db.session.commit()
    return jsonify({"post": p.to_dict()})

@app.route("/api/posts/<int:pid>", methods=["DELETE"])
@login_required
def delete_post(pid):
    p = Post.query.filter_by(id=pid, user_id=session["user_id"]).first_or_404()
    db.session.delete(p); db.session.commit()
    return jsonify({"message": "Post deleted"})

@app.route("/api/video/<int:pid>")
def serve_video_public(pid):
    """Public endpoint so TikTok can pull the video via PULL_FROM_URL."""
    p = Post.query.get(pid)
    if not p or not p.video_path or not os.path.exists(p.video_path):
        return "Video not found", 404
    directory = os.path.dirname(os.path.abspath(p.video_path))
    filename  = os.path.basename(p.video_path)
    return send_from_directory(directory, filename, mimetype="video/mp4")

# â”€â”€ TikTok domain ownership verification â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# TikTok serves a HEAD/GET request to this path to verify domain ownership.
# Set TIKTOK_DOMAIN_VERIFY_TOKEN in .env once you get it from the dev portal.
@app.route("/.well-known/tiktok-domain-verification.txt")
@app.route("/tiktok-domain-verification.txt")
def tiktok_domain_verify():
    token = os.getenv("TIKTOK_DOMAIN_VERIFY_TOKEN", "")
    if not token:
        return "tiktok-domain-verification: pending-setup", 200
    return token, 200, {"Content-Type": "text/plain"}

@app.route("/api/posts/upload", methods=["POST"])
@login_required
def upload_video():
    if "video" not in request.files:
        return jsonify({"error": "No video file in request"}), 400
    f = request.files["video"]
    if not f.filename:
        return jsonify({"error": "Empty filename"}), 400
    fname = secure_filename(f"{session['user_id']}_{uuid.uuid4().hex}_{f.filename}")
    path  = os.path.join(app.config["UPLOAD_FOLDER"], fname)
    f.save(path)
    return jsonify({"video_path": path, "filename": fname})

@app.route("/api/posts/<int:pid>/publish-now", methods=["POST"])
@login_required
def publish_now(pid):
    p    = Post.query.filter_by(id=pid, user_id=session["user_id"]).first_or_404()
    user = get_user()
    if not user.tiktok_access_token:
        return jsonify({"error": "TikTok not connected"}), 400
    if not p.video_path or not os.path.exists(p.video_path):
        return jsonify({"error": "Video file not found"}), 400
    try:
        pub_id, vid_id = tt_publish_video(user, p)
        p.status          = "published"
        p.published_at    = datetime.utcnow()
        p.tiktok_video_id = vid_id or pub_id
        p.error_message   = None
        db.session.commit()
        return jsonify({"message": "Published", "post": p.to_dict()})
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# ANALYTICS ROUTES
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

@app.route("/api/analytics/summary")
@login_required
def analytics_summary():
    uid = session["user_id"]
    posts = Post.query.filter_by(user_id=uid, status="published").all()
    views = likes = comments = shares = 0
    for p in posts:
        rec = PostAnalytics.query.filter_by(post_id=p.id).order_by(
            PostAnalytics.fetched_at.desc()).first()
        if rec:
            views    += rec.views
            likes    += rec.likes
            comments += rec.comments
            shares   += rec.shares
    return jsonify({
        "total_views":     views,
        "total_likes":     likes,
        "total_comments":  comments,
        "total_shares":    shares,
        "engagement_rate": round((likes + comments + shares) / max(views, 1) * 100, 2),
        "scheduled_count": Post.query.filter_by(user_id=uid, status="scheduled").count(),
        "published_count": Post.query.filter_by(user_id=uid, status="published").count(),
        "failed_count":    Post.query.filter_by(user_id=uid, status="failed").count(),
        "draft_count":     Post.query.filter_by(user_id=uid, status="draft").count(),
    })

@app.route("/api/analytics/posts")
@login_required
def analytics_posts():
    # Return ALL posts so scheduled/draft appear in the analytics page too
    posts = Post.query.filter_by(user_id=session["user_id"]).order_by(Post.created_at.desc()).all()
    return jsonify({"posts": [p.to_dict() for p in posts]})

@app.route("/api/analytics/weekly")
@login_required
def analytics_weekly():
    from datetime import timedelta
    uid = session["user_id"]
    now = datetime.utcnow()
    result = []
    for i in range(6, -1, -1):
        day_start = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        day_end   = day_start + timedelta(days=1)
        count = Post.query.filter(
            Post.user_id == uid,
            Post.created_at >= day_start,
            Post.created_at < day_end
        ).count()
        result.append({"day": day_start.strftime("%a"), "count": count})
    return jsonify({"days": result})

@app.route("/api/analytics/all-posts")
@login_required
def analytics_all_posts():
    posts = Post.query.filter_by(user_id=session["user_id"]).order_by(Post.created_at.desc()).all()
    return jsonify({"posts": [p.to_dict() for p in posts]})

@app.route("/api/analytics/sync/<int:pid>", methods=["POST"])
@login_required
def sync_post_analytics(pid):
    p    = Post.query.filter_by(id=pid, user_id=session["user_id"]).first_or_404()
    user = get_user()
    if not p.tiktok_video_id:
        return jsonify({"error": "No TikTok video ID"}), 400
    stats = tt_get_video_stats(user, p.tiktok_video_id)
    rec = PostAnalytics(
        post_id=p.id,
        views=stats.get("view_count", 0),
        likes=stats.get("like_count", 0),
        comments=stats.get("comment_count", 0),
        shares=stats.get("share_count", 0),
    )
    db.session.add(rec); db.session.commit()
    return jsonify({"message": "Analytics synced"})


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# ENGAGEMENT ROUTES
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

@app.route("/api/comments")
@login_required
def list_comments():
    cmts = Comment.query.filter_by(user_id=session["user_id"]).order_by(
        Comment.created_at.desc()).limit(100).all()
    return jsonify({"comments": [c.to_dict() for c in cmts]})

@app.route("/api/comments/sync", methods=["POST"])
@login_required
def sync_comments():
    """Manually trigger a comment fetch from TikTok for all published posts."""
    uid  = session["user_id"]
    user = get_user()
    if not user.tiktok_access_token:
        return jsonify({"error": "TikTok not connected"}), 400
    posts = Post.query.filter_by(user_id=uid, status="published").filter(
        Post.tiktok_video_id.isnot(None)).all()
    fetched = 0
    for post in posts:
        try:
            raw = tt_get_comments(user, post.tiktok_video_id)
            for c in raw:
                if Comment.query.filter_by(tiktok_comment_id=c["id"]).first():
                    continue
                cmt = Comment(
                    post_id=post.id, user_id=uid,
                    tiktok_comment_id=c["id"],
                    commenter_name=c.get("username", "user"),
                    commenter_avatar=c.get("avatar_url", ""),
                    text=c.get("text", ""),
                )
                db.session.add(cmt)
                fetched += 1
            db.session.commit()
        except Exception as exc:
            log.warning(f"[sync_comments] post {post.id}: {exc}")
    return jsonify({"fetched": fetched, "message": f"Synced {fetched} new comment(s)."})

@app.route("/api/comments/<int:cid>/reply", methods=["POST"])
@login_required
def reply_to_comment(cid):
    cmt  = Comment.query.filter_by(id=cid, user_id=session["user_id"]).first_or_404()
    d    = request.get_json()
    post = Post.query.get(cmt.post_id)
    user = get_user()
    tt_reply_comment(user, post.tiktok_video_id, cmt.tiktok_comment_id, d["text"])
    cmt.auto_replied = True
    db.session.commit()
    return jsonify({"message": "Reply sent"})

@app.route("/api/comments/<int:cid>/like", methods=["POST"])
@login_required
def like_comment(cid):
    cmt  = Comment.query.filter_by(id=cid, user_id=session["user_id"]).first_or_404()
    post = Post.query.get(cmt.post_id)
    user = get_user()
    tt_like_comment(user, post.tiktok_video_id, cmt.tiktok_comment_id)
    cmt.auto_liked = True
    db.session.commit()
    return jsonify({"message": "Comment liked"})


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# SETTINGS ROUTES
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

@app.route("/api/settings", methods=["GET"])
@login_required
def get_settings():
    s = AutoSettings.query.filter_by(user_id=session["user_id"]).first()
    if not s:
        return jsonify({"error": "Settings not found"}), 404
    return jsonify(s.to_dict())

@app.route("/api/settings", methods=["PUT"])
@login_required
def update_settings():
    s = AutoSettings.query.filter_by(user_id=session["user_id"]).first()
    d = request.get_json()
    allowed = ["auto_publish","auto_reply","auto_like_comments","auto_follow_back",
               "smart_reply","reply_template_1","reply_template_2","reply_template_3",
               "retry_on_fail","analytics_digest","default_privacy",
               "default_caption_tmpl","timezone"]
    for k in allowed:
        if k in d:
            setattr(s, k, d[k])
    db.session.commit()
    return jsonify({"message": "Settings updated", "settings": s.to_dict()})


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# HEALTH CHECK
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

@app.route("/")
def index():
    return send_from_directory(os.path.dirname(os.path.abspath(__file__)), "smca_web_app.html")


@app.route("/api/health")
def health():
    db_ok = False
    db_type = "unknown"
    try:
        db.session.execute(db.text("SELECT 1"))
        db_ok   = True
        db_type = "supabase/postgresql" if "postgresql" in DATABASE_URL else "sqlite (demo)"
    except Exception as e:
        log.error(f"DB health check failed: {e}")

    return jsonify({
        "status":            "ok" if db_ok else "db_error",
        "database":          db_type,
        "database_connected": db_ok,
        "scheduler_running": scheduler.running,
        "jobs":              [j.id for j in scheduler.get_jobs()],
        "timestamp":         datetime.utcnow().isoformat(),
    })


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# STARTUP
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

if __name__ == "__main__":
    with app.app_context():
        try:
            db.create_all()
            log.info("=" * 50)
            log.info("SMCA Backend started successfully!")
            log.info(f"Database: {'Supabase' if 'postgresql' in DATABASE_URL else 'SQLite (demo)'}")
            log.info("API: http://localhost:5000")
            log.info("Health: http://localhost:5000/api/health")
            log.info("=" * 50)
        except Exception as e:
            log.error(f"Database setup failed: {e}")
            log.error("Check your DATABASE_URL in .env file")
            raise

    app.run(debug=True, port=5000, use_reloader=False)

