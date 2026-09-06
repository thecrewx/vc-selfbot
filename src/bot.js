'use strict';

const { Client } = require('discord.js-selfbot-v13');
const log        = require('./logger');
const cfg        = require('./config');

const rand  = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const sleep = ms     => new Promise(r => setTimeout(r, ms));

class BotInstance {
  constructor(token, command, index) {
    this.token   = token;
    this.command = command;
    this.index   = index;
    this.tag     = `BOT${index + 1}`;

    // vc state
    this.lastVcId    = null;
    this.lastGuildId = null;
    this.manualLeave = false;
    this.rejoinLock  = false;
    this.kickCount   = 0;
    this.kicksTotal  = 0;
    this.lastKickAt  = 0;

    // stats
    this.startedAt = Date.now();
    this.joinCount = 0;

    // afk
    this.afkEnabled = false;
    this.afkReason  = '';

    // internals
    this._keepaliveTimer    = null;
    this._keepaliveGuildId  = null;
    this._keepaliveVcId     = null;

    this.client = new Client({
      checkUpdate  : false,
      captchaCache : { enabled: false },
      restTimeOffset: rand(300, 1500),
      properties   : {
        browser        : 'Chrome',
        os             : 'Windows',
        device         : '',
        browserVersion : '120.0.0.0',
        osVersion      : '10',
        platform       : 'Win32',
      },
    });

    this._bindEvents();
  }

  // ── VC ───────────────────────────────────────────────────────────────────────

  _sendGateway(guildId, channelId) {
    const payload = {
      op : 4,
      d  : { guild_id: guildId, channel_id: channelId, self_mute: true, self_deaf: false },
    };
    const ws = this.client.ws;
    try {
      if (ws?.send)                        ws.send(payload);
      else if (this.client._ws?.send)      this.client._ws.send(payload);
      else if (ws?.shards?.first()?.send)  ws.shards.first().send(payload);
    } catch (e) {
      log.error(this.tag, `gateway send: ${e?.message}`);
    }
  }

  async joinChannel(guildId, channelId) {
    this._sendGateway(guildId, channelId);
    this.lastVcId    = channelId;
    this.lastGuildId = guildId;
    this.manualLeave = false;
    this.joinCount++;
    log.voice(this.tag, `joined  ${channelId}`);
  }

  leaveChannel() {
    this.manualLeave = true;
    this.lastVcId    = null;
    this._stopKeepalive();
    try { this.client.voice?.connection?.destroy(); } catch {}
    log.voice(this.tag, 'disconnected');
  }

  // keepalive: call after any join to keep bots in that specific channel
  armKeepalive(guildId, channelId) {
    const gId = guildId || this.lastGuildId;
    const cId = channelId || this.lastVcId;
    if (!gId || !cId) return;

    this._keepaliveGuildId = gId;
    this._keepaliveVcId    = cId;

    if (this._keepaliveTimer) return; // already running, target updated above
    this._keepaliveTimer = setInterval(() => {
      if (this.manualLeave || !this._keepaliveVcId) return;
      this._sendGateway(this._keepaliveGuildId, this._keepaliveVcId);
    }, cfg.keepaliveMs);
  }

  _stopKeepalive() {
    if (this._keepaliveTimer) {
      clearInterval(this._keepaliveTimer);
      this._keepaliveTimer   = null;
      this._keepaliveGuildId = null;
      this._keepaliveVcId    = null;
    }
  }

  // ── GETTERS ──────────────────────────────────────────────────────────────────

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

  // ── EVENTS ───────────────────────────────────────────────────────────────────

  _bindEvents() {
    const { client } = this;

    client.on('ready', async () => {
      this.tag = client.user.tag;
      log.success(this.tag, `online  ·  ${cfg.prefix}${this.command}`);

      // set presence
      try {
        await client.user.setStatus(cfg.status);
        if (cfg.activityText) {
          await client.user.setActivity(cfg.activityText, { type: cfg.activityType });
        }
      } catch {}

      // auto-join on startup
      if (cfg.autoJoinGuildId && cfg.autoJoinVcId) {
        await sleep(3000 + rand(0, 2000));
        if (!this.manualLeave) {
          await this.joinChannel(cfg.autoJoinGuildId, cfg.autoJoinVcId);
          this.armKeepalive(cfg.autoJoinGuildId, cfg.autoJoinVcId);
          log.info(this.tag, `keepalive active  ·  ${cfg.keepaliveMs / 1000}s interval`);
        }
      }
    });

    // track vc state from discord's perspective
    client.on('voiceStateUpdate', (_, ns) => {
      if (ns.member?.id !== client.user?.id) return;
      if (ns.channelId) {
        this.lastVcId    = ns.channelId;
        this.lastGuildId = ns.guild?.id || this.lastGuildId;
      }
    });

    // raw gateway — kick detection with exponential backoff rejoin
    client.on('raw', packet => {
      if (packet.t !== 'VOICE_STATE_UPDATE')     return;
      if (packet.d?.user_id !== client.user?.id) return;
      if (packet.d?.channel_id)                  return;
      if (this.manualLeave)                      return;
      if (this.rejoinLock)                       return;

      const rejoinGuild = this._keepaliveGuildId || cfg.autoJoinGuildId;
      const rejoinVc    = this._keepaliveVcId    || cfg.autoJoinVcId;
      if (!rejoinGuild || !rejoinVc)             return;

      const now = Date.now();
      this.kickCount  = (now - this.lastKickAt < 30000) ? this.kickCount + 1 : 1;
      this.lastKickAt = now;
      this.kicksTotal++;

      // exponential backoff: 3s, 6s, 12s, 20–28s cap
      const backoff = this.kickCount > 4
        ? rand(20000, 28000)
        : Math.min(3000 * (2 ** (this.kickCount - 1)), 20000) + rand(0, 1000);

      this.rejoinLock = true;
      setTimeout(() => { this.rejoinLock = false; }, backoff + 3000);

      log.warn(this.tag, `kicked ×${this.kickCount}  —  rejoin in ${Math.round(backoff / 1000)}s`);

      setTimeout(async () => {
        if (this.manualLeave) return;
        try {
          await this.joinChannel(rejoinGuild, rejoinVc);
          log.success(this.tag, 'rejoined');
        } catch (e) {
          log.error(this.tag, `rejoin failed  ${e?.message}`);
        }
      }, backoff);
    });

    // afk mention auto-reply
    client.on('messageCreate', msg => {
      if (!this.afkEnabled)                       return;
      if (msg.author.id === client.user?.id)      return;
      if (!msg.mentions.has(client.user?.id))     return;
      msg.reply(`${cfg.afkReply}${this.afkReason ? `  —  ${this.afkReason}` : ''}`).catch(() => {});
    });

    client.on('shardReconnecting', () => log.warn(this.tag, 'reconnecting...'));
    client.on('shardResume',       () => log.success(this.tag, 'shard resumed'));
    client.on('error', e           => log.error(this.tag, e?.message ?? 'unknown error'));
    client.on('warn',  m           => log.warn(this.tag, m));
    client.on('debug',             () => {});
  }

  // ── LIFECYCLE ────────────────────────────────────────────────────────────────

  async login() {
    log.info(this.tag, 'logging in...');
    try {
      await this.client.login(this.token);
    } catch (e) {
      log.error(this.tag, `login failed  ${e?.message}`);
    }
  }

  destroy() {
    this._stopKeepalive();
    try { this.client.destroy(); } catch {}
  }
}

module.exports = BotInstance;
