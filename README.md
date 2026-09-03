<p align="center">
  <img src="https://img.shields.io/badge/version-0.0.67-blueviolet?style=for-the-badge" alt="Version">
  <img src="https://img.shields.io/badge/Node.js-16+-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/discord.js--selfbot--v13-3.7.1-7289DA?style=for-the-badge&logo=discord&logoColor=white" alt="Discord.js">
  <img src="https://img.shields.io/badge/made%20by-thecrewx-ff69b4?style=for-the-badge" alt="Made by thecrewx">
  <img src="https://img.shields.io/badge/for-vishal%20babe-cyan?style=for-the-badge" alt="For vishal babe">
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge" alt="License">
</p>

<h1 align="center">⚡ VC Selfbot <code>v0.0.67</code></h1>

<p align="center">
  <b>Premium multi-token Discord voice channel selfbot</b><br>
  Control unlimited accounts. Auto-join. 24/7 crash recovery. 25+ commands.<br><br>
  <i>made by <b>thecrewx</b> · for <b>vishal babe</b></i>
</p>

---

## 📋 Requirements

- **Node.js** v16 or higher → [nodejs.org](https://nodejs.org)
- npm (bundled with Node.js)
- One or more Discord account tokens

```bash
node -v   # must be v16+
npm -v
```

---

## ⚙️ Setup

```bash
# 1. Clone
git clone https://github.com/thecrewx/vc-selfbot.git
cd vc-selfbot

# 2. Install dependencies
npm install

# 3. Create config
cp .env.example .env

# 4. Edit .env — add your tokens, commands, owner ID
nano .env      # Linux/Mac
notepad .env   # Windows

# 5. Run
npm start
```

---

## 🔧 Configuration (`.env`)

```env
# One token per account, comma-separated
TOKENS=token1,token2,token3

# One command name per token (same order)
COMMANDS=bot1,bot2,bot3

# Prefix
PREFIX=!

# Your Discord user ID (who can control bots)
OWNER_ID=123456789012345678

# ── Optional: Auto-join a VC 24/7 ──────────────
AUTO_JOIN_GUILD_ID=
AUTO_JOIN_VC_ID=

# ── Optional: Presence ─────────────────────────
STATUS=online
ACTIVITY_TEXT=
ACTIVITY_TYPE=PLAYING

# ── Optional: Tweaks ───────────────────────────
KEEPALIVE_MS=12000
JOIN_DELAY_MS=1200
DELETE_COMMANDS=false
DELETE_DELAY_MS=3000
AFK_REPLY=💤 AFK — brb

# ── Optional: File logging ─────────────────────
LOG_TO_FILE=false
LOG_FILE=logs/bot.log
```

> 💡 Enable **Developer Mode** in Discord (Settings → Advanced → Developer Mode), then right-click your username to copy your User ID.

---

## 🚀 Running

| Method | Command | Notes |
|--------|---------|-------|
| **24/7 with crash recovery** | `npm start` | Recommended |
| Direct (no crash recovery) | `node src/index.js` | Dev/testing |
| PM2 (server / always-on) | `npm run pm2` | Best for VPS |

### PM2 setup (server)
```bash
npm install -g pm2
npm run pm2
pm2 save
pm2 startup   # auto-start on reboot
pm2 logs vc-selfbot
```

---

## 💬 Commands

All commands are typed in any Discord text channel the bots can see.

### 🔊 Voice
| Command | Aliases | Description |
|---------|---------|-------------|
| `!join` | `!j` `!connect` `!vc` | All bots join your current VC |
| `!joinid <id>` | `!ji` `!vcid` | All bots join VC by channel ID |
| `!leave` | `!l` `!dc` `!disconnect` | All bots leave VC |
| `!moveall <id>` | `!ma` `!move` | Move all bots to another VC instantly |
| `!copycat <n>` | `!cc` | Only bot #N joins your VC |
| `!mute` | `!selfmute` | Self-mute all bots currently in VC |
| `!vcstatus` | `!vs` `!vcinfo` | Table showing VC status of all bots |

### 🎮 Presence
| Command | Aliases | Description |
|---------|---------|-------------|
| `!setstatus <s>` | `!ss` | Set status: online / idle / dnd / invisible |
| `!setactivity <text>` | `!sa` `!playing` | Set "Playing ..." |
| `!setstreaming <text>` | `!stream` | Set streaming status |
| `!setlistening <text>` | `!listen` | Set "Listening to ..." |
| `!setwatching <text>` | `!watch` | Set "Watching ..." |
| `!clearactivity` | `!ca` | Remove activity from all bots |

### 💬 Chat
| Command | Aliases | Description |
|---------|---------|-------------|
| `!say <text>` | `!echo` | Send message, auto-delete command |
| `!purge <n>` | `!clear` `!prune` | Delete your last N messages (max 100) |
| `!snipe` | `!sn` | Show last deleted message in this channel |
| `!afk [reason]` | — | Toggle AFK — bots auto-reply when you're mentioned |

### 🛠️ Info
| Command | Aliases | Description |
|---------|---------|-------------|
| `!ping` | `!p` `!latency` | Ping of all bots |
| `!uptime` | `!up` | Uptime, join count, kicks per bot |
| `!stats` | `!info` `!botinfo` | Full dashboard (RAM, CPU, all bots) |
| `!serverlist` | `!sl` `!guilds` | All servers the bots are in |
| `!serverinfo` | `!si` `!guild` | Current server info |
| `!userinfo [@u]` | `!ui` `!whois` | User info card |
| `!avatar [@u]` | `!av` `!pfp` | Full-size avatar URL |
| `!token` | `!tokeninfo` | Show your masked token |

### 🔧 System
| Command | Aliases | Description |
|---------|---------|-------------|
| `!resetkicks` | `!rk` | Reset kick counters on all bots |
| `!help` | `!h` `!cmds` | Show full command list |

### 🎯 Per-bot
| Command | Description |
|---------|-------------|
| `!bot1` | Only bot 1 joins your VC |
| `!bot2` | Only bot 2 joins your VC |
| `!botN` | Only bot N joins your VC |

---

## ✨ Features

| Feature | Details |
|---------|---------|
| 🔊 **Gateway VC join** | Silent presence — no UDP/audio, prevents 15s timeout kicks |
| 💓 **Keepalive** | Re-asserts VC presence every 12s (configurable) |
| ⚡ **Auto-rejoin** | Detects kicks via raw gateway, rejoins with exponential backoff |
| 🔄 **Crash recovery** | `start.js` restarts bot on any crash with cooldown on rapid failures |
| 🎨 **Rich console UI** | Gradient banner, colored tables, timestamped logs |
| 🗑️ **Snipe** | Logs every deleted message; `!snipe` shows the last one per channel |
| 💤 **AFK mode** | Bots auto-reply to mentions when you're AFK, toggle on/off |
| 🔀 **Move all** | `!moveall` moves every bot to a new VC in one command |
| 🎯 **Copycat** | `!copycat <n>` makes just one specific bot follow you |
| 📊 **Full stats** | Per-bot: ping, uptime, VC join count, kick count, AFK state, RAM |
| 🔒 **Owner-only** | All commands gated to your Discord ID(s) |
| 🧠 **Cooldowns** | Purge and join commands have debounce to prevent spam |
| 📝 **File logging** | Mirror all output to `logs/bot.log` (optional) |
| ✅ **Config validation** | Startup fails fast with clear plain-English error messages |
| 🏷️ **Credits** | `made by thecrewx  •  for vishal babe` |

---

## 🛠️ Troubleshooting

| Problem | Fix |
|---------|-----|
| `Missing required env var: TOKENS` | `.env` file missing or empty — check it exists |
| `TOKENS count must match COMMANDS count` | Add one command name per token |
| `OWNER_ID looks invalid` | Use your real numeric Discord user ID |
| Bot doesn't respond to commands | Check prefix in `.env` and that you're listed in `OWNER_ID` |
| Bots won't join VC | You must be inside a voice channel before typing `!join` |
| Bots getting kicked repeatedly | Normal — auto-rejoin handles it. Increase `KEEPALIVE_MS` if needed |
| Token invalid on login | Tokens expire. Get a fresh one from your Discord account |
| `Cannot read properties of undefined` | Usually a stale token — re-login on that account and grab a new token |

---

## 📁 Project Structure

```
vc-selfbot/
├── src/
│   ├── index.js       ← Entry point — creates bots, handles shutdown
│   ├── bot.js         ← BotInstance class (login, VC, keepalive, AFK)
│   ├── commands.js    ← All 25+ command handlers
│   ├── config.js      ← Loads + validates .env
│   ├── logger.js      ← Colored console + file logging
│   └── banner.js      ← Startup UI (banner, config table)
├── start.js           ← 24/7 crash recovery wrapper
├── .env.example       ← Config template (copy to .env)
├── .gitignore
├── package.json
└── README.md
```

---

## ⚠️ Disclaimer

Selfbots violate [Discord's Terms of Service](https://discord.com/terms). Accounts may be suspended or banned. This project is provided for **educational purposes only**. Use at your own risk. Never share your tokens.

---

<p align="center">
  ⚡ <b>VC Selfbot v0.0.67</b><br>
  made with ❤️ by <b>thecrewx</b> · for <b>vishal babe</b>
</p>
