<p align="center">
  <img src="https://img.shields.io/badge/version-0.0.67-blueviolet?style=for-the-badge" />
  <img src="https://img.shields.io/badge/node.js-16+-339933?style=for-the-badge&logo=node.js&logoColor=white" />
  <img src="https://img.shields.io/badge/discord.js--selfbot--v13-3.7.1-5865F2?style=for-the-badge&logo=discord&logoColor=white" />
  <img src="https://img.shields.io/badge/made%20by-thecrewx-ff69b4?style=for-the-badge" />
  <img src="https://img.shields.io/badge/for-vishal%20babe-00bcd4?style=for-the-badge" />
</p>

<h1 align="center">⚡ vc-selfbot</h1>
<p align="center">premium multi-token discord voice channel selfbot · 24/7 · guard system</p>
<p align="center"><i>made by <b>thecrewx</b> · for <b>vishal babe</b></i></p>

---

## setup

```bash
git clone https://github.com/yourusername/vc-selfbot
cd vc-selfbot
npm install
cp .env.example .env
# edit .env
npm start
```

---

## .env

```env
TOKENS=token1,token2,token3
COMMANDS=bot1,bot2,bot3
PREFIX=!
OWNER_ID=your_discord_user_id

AUTO_JOIN_GUILD_ID=
AUTO_JOIN_VC_ID=

STATUS=online
ACTIVITY_TEXT=
ACTIVITY_TYPE=PLAYING

KEEPALIVE_MS=12000
JOIN_DELAY_MS=1200
DELETE_COMMANDS=false
DELETE_DELAY_MS=3000
AFK_REPLY=💤 AFK — brb

LOG_TO_FILE=false
LOG_FILE=logs/bot.log

GUARD_ENABLED=false
GUARD_VC_ID=
GUARD_GUILD_ID=
GUARD_DUMP_VC_ID=
GUARD_WHITELIST=
GUARD_MSG=true
```

---

## run

| | |
|---|---|
| 24/7 crash recovery | `npm start` |
| direct | `node src/index.js` |
| pm2 | `npm run pm2` |

---

## commands

### voice
| cmd | alias | |
|---|---|---|
| `!join` | `j` | all bots join your vc |
| `!joinid <id>` | `ji` | all bots join by channel id |
| `!leave` | `l` | all bots leave vc |
| `!move <id>` | `mv` | move all bots to another vc |
| `!solo <n>` | `s` | only bot #n joins your vc |
| `!vc` | `vs` | status table — who is where, kick count |

### guard
| cmd | alias | |
|---|---|---|
| `!guard on [vcId]` | `gd` | block non-owners from joining protected vc |
| `!guard off` | | disable guard |
| `!guard status` | | config + block count |
| `!guard log` | | who was blocked and when |
| `!guard wl <id>` | | whitelist toggle for a user |
| `!guard dump <id>` | | vc to move blocked users to instead of disconnecting |

### presence
| cmd | alias | |
|---|---|---|
| `!status <s>` | `st` | online / idle / dnd / invisible |
| `!playing <text>` | `pl` | set playing activity |
| `!streaming <text>` | `str` | set streaming activity |
| `!listening <text>` | `ls` | set listening activity |
| `!watching <text>` | `wt` | set watching activity |
| `!noactivity` | `na` | clear activity |

### chat
| cmd | alias | |
|---|---|---|
| `!purge <n>` | `p` | delete your last n messages (max 100) |
| `!snipe` | `sn` | last deleted message in this channel |
| `!afk [reason]` | | toggle afk — auto-replies to mentions |

### info
| cmd | | |
|---|---|---|
| `!ping` | | ws latency of all bots |
| `!stats` | | ram · node · uptime · vc status · kick count |
| `!help` | `h` | command list |

### per-bot
type the command name you set in `.env` while in a vc — only that bot joins.

---

## features

| | |
|---|---|
| gateway vc join | no udp — silent presence, no 15s timeout kicks |
| keepalive | re-asserts every 12s so bots never idle-disconnect |
| auto-rejoin | exponential backoff on kick: 3s → 6s → 12s → 20s cap |
| vc guard | instantly removes non-owners who join the protected vc |
| guard whitelist | per-user exemptions from the guard |
| guard log | full history of every blocked join |
| snipe | caches deleted messages per channel |
| afk | auto-replies to anyone who mentions you |
| purge | bulk-delete your own messages with rate-limit safety |
| 24/7 wrapper | crash recovery with cooldown on rapid failures |
| file logging | mirror all output to log file (optional) |

---

## structure

```
vc-selfbot/
├── src/
│   ├── index.js
│   ├── bot.js
│   ├── commands.js
│   ├── guard.js
│   ├── config.js
│   ├── logger.js
│   └── banner.js
├── start.js
├── .env.example
├── package.json
└── README.md
```

---

> selfbots violate discord's tos. use at your own risk.
