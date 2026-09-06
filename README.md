<p align="center">
  <img src="https://img.shields.io/badge/version-0.0.67-blueviolet?style=for-the-badge" />
  <img src="https://img.shields.io/badge/node.js-16+-339933?style=for-the-badge&logo=node.js&logoColor=white" />
  <img src="https://img.shields.io/badge/discord.js--selfbot--v13-3.7.1-5865F2?style=for-the-badge&logo=discord&logoColor=white" />
  <img src="https://img.shields.io/badge/made%20by-thecrewx-ff69b4?style=for-the-badge" />
  <img src="https://img.shields.io/badge/for-vishal%20babe-00bcd4?style=for-the-badge" />
</p>

<h1 align="center">⚡ vc-selfbot</h1>
<p align="center">
  premium multi-token discord voice channel selfbot<br>
  24/7 crash recovery  ·  vc guard  ·  exponential backoff rejoin
</p>
<p align="center"><sub>made by <b>thecrewx</b>  ·  for <b>vishal babe</b>  ·  v0.0.67</sub></p>

---

## setup

```bash
git clone https://github.com/yourusername/vc-selfbot
cd vc-selfbot
npm install
cp .env.example .env
# edit .env with your values
npm start
```

---

## .env

```env
# required
TOKENS=token1,token2,token3
COMMANDS=bot1,bot2,bot3
PREFIX=!
OWNER_ID=your_discord_user_id

# auto-join a vc on startup (optional)
AUTO_JOIN_GUILD_ID=
AUTO_JOIN_VC_ID=

# presence (optional)
STATUS=online
ACTIVITY_TEXT=
ACTIVITY_TYPE=PLAYING

# timing
KEEPALIVE_MS=12000
JOIN_DELAY_MS=1200

# behaviour
DELETE_COMMANDS=false
DELETE_DELAY_MS=3000
AFK_REPLY=💤 AFK — brb

# logging
LOG_TO_FILE=false
LOG_FILE=logs/bot.log

# guard (optional — can also be toggled with !guard on/off)
GUARD_ENABLED=false
GUARD_VC_ID=
GUARD_GUILD_ID=
GUARD_DUMP_VC_ID=
GUARD_WHITELIST=
GUARD_MSG=true
```

> one token per account. one command name per token. same order.

---

## run

```bash
npm start          # 24/7 with crash recovery  (recommended)
node src/index.js  # direct, no recovery
npm run pm2        # pm2 — best for vps
```

---

## commands

### voice
| cmd | alias | |
|---|---|---|
| `!join` | `j` | all bots join your current vc |
| `!joinid <id>` | `ji` | all bots join by channel id |
| `!leave` | `l` | all bots disconnect |
| `!move <id>` | `mv` | move all bots to a different vc |
| `!solo <n>` | `s` | only bot #n joins your vc |
| `!vc` | `vs` | status table — who is where, kick counts |

### guard
| cmd | alias | |
|---|---|---|
| `!guard on [vcId]` | `gd` | enable — block non-owners from joining vc |
| `!guard off` | | disable guard |
| `!guard status` | | config + total block count |
| `!guard log` | | last blocked users |
| `!guard wl <id>` | | toggle whitelist for a user id |
| `!guard dump <id>` | | vc to move blocked users into (default: disconnect) |

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
| `!stats` | | ram · node · uptime · vc status · kick count · guard |
| `!help` | `h` | command list |

### per-bot
type the command name from `.env` while in a vc — only that bot joins.  
example: if `COMMANDS=alpha,beta,gamma` then `!alpha` joins only the first bot.

---

## how it works

| | |
|---|---|
| **gateway join** | sends discord op 4 directly — no udp, no audio, no 15s timeout kicks |
| **keepalive** | re-asserts presence on a timer so bots never idle-disconnect |
| **auto-rejoin** | exponential backoff on kick: 3s → 6s → 12s → 20–28s cap |
| **guard** | voiceStateUpdate listener — removes non-owners the instant they enter the protected vc. works with `!guard on/off` at runtime without restart |
| **snipe** | messageDelete listener caches per channel — `!snipe` always shows the most recent |
| **afk** | all bot accounts auto-reply to anyone who mentions you while afk is active |
| **purge** | deletes your own messages with a rate-limit safe delay between each |
| **crash recovery** | `start.js` restarts on any exit, exponential cooldown on rapid crashes |

---

## structure

```
vc-selfbot/
├── src/
│   ├── index.js      main — wires everything, handles shutdown
│   ├── bot.js        BotInstance class — login, vc, keepalive, afk
│   ├── commands.js   command router — all commands
│   ├── guard.js      vc guard — block non-owners
│   ├── config.js     env loader + validation
│   ├── logger.js     aligned console + file output
│   └── banner.js     startup ui
├── start.js          24/7 crash recovery wrapper
├── .env.example
├── package.json
└── README.md
```

---

> selfbots violate discord's [terms of service](https://discord.com/terms). use at your own risk.

<p align="center">
  ⚡ <b>VC Selfbot v0.0.67</b><br>
  made with ❤️ by <b>thecrewx</b> · for <b>vishal babe</b>
</p>
