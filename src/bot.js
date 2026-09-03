'use strict';
// ═══════════════════════════════════════════════════════════════════════════════
//   BOT — Single selfbot instance
//   vc-selfbot v0.0.67 | made by thecrewx for vishal babe
// ═══════════════════════════════════════════════════════════════════════════════

const { Client } = require('discord.js-selfbot-v13');
const log        = require('./logger');
const cfg        = require('./config');

const rand  = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const sleep = ms     => new Promise(r => setTimeout(r, ms));

class BotInstance {
  constructor(token, command, index) {
    this.token    = token;
    this.command  = command;
    this.index    = index;
    this.tag      = `BOT${index + 1}`;

    // ── VC state ──────────────────────────────────────────────────────────
    this.lastVcId    = null;
    this.lastGuildId = null;
    this.manualLeave = false;
    this.kickCount   = 0;
    this.lastKickAt  = 0;
    this.rejoinLock  = false;

    // ── Stats ─────────────────────────────────────────────────────────────
    this.startedAt   = Date.now();
    this.joinCount   = 0;
    this.kicksTotal  = 0;
    this.msgSeen     = 0;

    // ── AFK ───────────────────────────────────────────────────────────────
    this.afkEnabled  = false;
    this.afkReason   = '';
    this.afkSince    = null;

    // ── Timers ────────────────────────────────────────────────────────────
    this._keepaliveTimer = null;

    this.client = new Client({
      checkUpdate: false,
      captchaCache: { enabled: false },
      restTimeOffset: rand(300, 1500),
      properties: {
        browser: 'Chrome',
        os: 'Windows',
        device: '',
        browserVersion: '120.0.0.0',
        osVersion: '10',
        platform: 'Win32',
      },
    });

    this._bindEvents();
  }

  // ── Gateway VC join (no UDP — avoids 15s timeout kicks) ──────────────────
  gatewayJoin(guildId, channelId) {
    try {
      const payload = {
        op: 4,
        d: { guild_id: guildId, channel_id: channelId, self_mute: true, self_deaf: false },
      };
      const ws = this.client.ws;
      if (ws?.send)                        ws.send(payload);
      else if (this.client._ws?.send)      this.client._ws.send(payload);
      else if (ws?.shards?.first()?.send)  ws.shards.first().send(payload);
    } catch (e) {
      log.error(this.tag, `gatewayJoin error: ${e?.message}`);
    }
    this.lastVcId    = channelId;
    this.lastGuildId = guildId;
    this.manualLeave = false;
  }

  async joinChannel(guildId, channelId) {
    this.gatewayJoin(guildId, channelId);
    this.joinCount++;
    log.voice(this.tag, `joined VC ${channelId} (guild ${guildId})`);
  }

  leaveChannel() {
    this.manualLeave = true;
    this.lastVcId    = null;
    // Clear keepalive so it doesn't auto-rejoin
    if (this._keepaliveTimer) {
      clearInterval(this._keepaliveTimer);
      this._keepaliveTimer = null;
    }
    try { this.client.voice?.connection?.destroy(); } catch {}
    log.voice(this.tag, 'left VC');
  }

  // Re-arm keepalive after a manual join following a manual leave
  armKeepalive() {
    if (this._keepaliveTimer) return; // already running
    if (!cfg.autoJoinGuildId || !cfg.autoJoinVcId) return;
    const doKeepalive = () => {
      if (this.manualLeave) return;
      this.gatewayJoin(cfg.autoJoinGuildId, cfg.autoJoinVcId);
    };
    this._keepaliveTimer = setInterval(doKeepalive, cfg.keepaliveMs);
  }

  get uptime() {
    const ms = Date.now() - this.startedAt;
    const h  = Math.floor(ms / 3600000);
    const m  = Math.floor((ms % 3600000) / 60000);
    const s  = Math.floor((ms % 60000) / 1000);
    return `${h}h ${m}m ${s}s`;
  }

  get isOnline() {
    return !!this.client.user;
  }

  // ── Event bindings ────────────────────────────────────────────────────────
  _bindEvents() {
    const { client } = this;

    // READY
    client.on('ready', async () => {
      this.tag = client.user.tag;
      log.success(this.tag, `online  |  cmd: ${cfg.prefix}${this.command}`);

      // Presence
      try {
        await client.user.setStatus(cfg.status);
        if (cfg.activityText) {
          await client.user.setActivity(cfg.activityText, { type: cfg.activityType });
        }
      } catch {}

      // Auto-join + keepalive
      if (cfg.autoJoinGuildId && cfg.autoJoinVcId) {
        const doKeepalive = () => {
          if (this.manualLeave) return;
          this.gatewayJoin(cfg.autoJoinGuildId, cfg.autoJoinVcId);
        };
        setTimeout(doKeepalive, 3000 + rand(0, 2000));
        this._keepaliveTimer = setInterval(doKeepalive, cfg.keepaliveMs);
        log.info(this.tag, `keepalive active → every ${cfg.keepaliveMs / 1000}s → VC ${cfg.autoJoinVcId}`);
      }
    });

    // AFK mention handler
    client.on('messageCreate', (msg) => {
      if (!this.afkEnabled) return;
      if (msg.author.id === client.user?.id) return;
      if (!msg.mentions.has(client.user?.id)) return;
      msg.reply(`${cfg.afkReply}${this.afkReason ? ` — ${this.afkReason}` : ''}`)
        .catch(() => {});
    });

    // Message seen counter
    client.on('messageCreate', () => { this.msgSeen++; });

    // Voice state tracking
    client.on('voiceStateUpdate', (_, newState) => {
      if (newState.member?.id !== client.user?.id) return;
      if (newState.channelId) {
        this.lastVcId    = newState.channelId;
        this.lastGuildId = newState.guild?.id || this.lastGuildId;
      } else {
        // disconnected — track but don't auto-rejoin here (raw handles it)
      }
    });

    // RAW — kick detection + exponential backoff rejoin
    client.on('raw', (packet) => {
      if (packet.t !== 'VOICE_STATE_UPDATE') return;
      if (packet.d?.user_id !== client.user?.id) return;
      if (packet.d?.channel_id) return; // joined somewhere, not kicked

      if (this.manualLeave) {
        log.info(this.tag, 'disconnected (manual)');
        return;
      }
      if (!cfg.autoJoinGuildId || !cfg.autoJoinVcId) return;
      if (this.rejoinLock) return;

      const now = Date.now();
      if (now - this.lastKickAt < 30000) this.kickCount++;
      else this.kickCount = 1;
      this.lastKickAt = now;
      this.kicksTotal++;

      // Exponential backoff: 3s, 6s, 12s, then cap at 20–28s
      const backoff = this.kickCount > 4
        ? rand(20000, 28000)
        : Math.min(3000 * Math.pow(2, this.kickCount - 1), 20000) + rand(0, 1000);

      this.rejoinLock = true;
      setTimeout(() => { this.rejoinLock = false; }, backoff + 3000);

      log.warn(this.tag, `kicked (×${this.kickCount}) — rejoin in ${Math.round(backoff / 1000)}s`);

      setTimeout(async () => {
        if (this.manualLeave) return;
        try {
          await this.joinChannel(cfg.autoJoinGuildId, cfg.autoJoinVcId);
          log.success(this.tag, `auto-rejoined VC ${cfg.autoJoinVcId}`);
        } catch (e) {
          log.error(this.tag, `auto-rejoin failed: ${e?.message}`);
        }
      }, backoff);
    });

    client.on('error', e  => log.error(this.tag, `error: ${e?.message}`));
    client.on('warn',  m  => log.warn(this.tag,  `warn: ${m}`));
    client.on('debug', () => {});

    // Reconnect notice
    client.on('shardReconnecting', () => log.warn(this.tag, 'shard reconnecting...'));
    client.on('shardResume',       () => log.success(this.tag, 'shard resumed'));
  }

  async login() {
    try {
      log.info(this.tag, 'logging in...');
      await this.client.login(this.token);
    } catch (e) {
      log.error(this.tag, `login failed: ${e?.message}`);
    }
  }

  destroy() {
    if (this._keepaliveTimer) clearInterval(this._keepaliveTimer);
    try { this.client.destroy(); } catch {}
  }
}

module.exports = BotInstance;
