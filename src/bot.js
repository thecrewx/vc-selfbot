'use strict';

const { Client } = require('discord.js-selfbot-v13');
const log        = require('./logger');
const cfg        = require('./config');

const rand  = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;

class BotInstance {
  constructor(token, command, index) {
    this.token    = token;
    this.command  = command;
    this.index    = index;
    this.tag      = `BOT${index + 1}`;

    this.lastVcId    = null;
    this.lastGuildId = null;
    this.manualLeave = false;
    this.kickCount   = 0;
    this.lastKickAt  = 0;
    this.kicksTotal  = 0;
    this.rejoinLock  = false;

    this.startedAt   = Date.now();
    this.joinCount   = 0;
    this.msgSeen     = 0;

    this.afkEnabled  = false;
    this.afkReason   = '';

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

    this._bind();
  }

  gatewayJoin(guildId, channelId) {
    try {
      const p = { op: 4, d: { guild_id: guildId, channel_id: channelId, self_mute: true, self_deaf: false } };
      const ws = this.client.ws;
      if (ws?.send)                       ws.send(p);
      else if (this.client._ws?.send)     this.client._ws.send(p);
      else if (ws?.shards?.first()?.send) ws.shards.first().send(p);
    } catch (e) { log.error(this.tag, `gateway: ${e?.message}`); }
    this.lastVcId    = channelId;
    this.lastGuildId = guildId;
    this.manualLeave = false;
  }

  async joinChannel(guildId, channelId) {
    this.gatewayJoin(guildId, channelId);
    this.joinCount++;
    log.voice(this.tag, `joined  ${channelId}`);
  }

  leaveChannel() {
    this.manualLeave = true;
    this.lastVcId    = null;
    if (this._keepaliveTimer) { clearInterval(this._keepaliveTimer); this._keepaliveTimer = null; }
    try { this.client.voice?.connection?.destroy(); } catch {}
    log.voice(this.tag, 'disconnected');
  }

  armKeepalive() {
    if (this._keepaliveTimer)              return;
    if (!cfg.autoJoinGuildId || !cfg.autoJoinVcId) return;
    this._keepaliveTimer = setInterval(() => {
      if (!this.manualLeave) this.gatewayJoin(cfg.autoJoinGuildId, cfg.autoJoinVcId);
    }, cfg.keepaliveMs);
  }

  get uptime() {
    const ms = Date.now() - this.startedAt;
    return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  }

  get isOnline() { return !!this.client.user; }

  _bind() {
    const { client } = this;

    client.on('ready', async () => {
      this.tag = client.user.tag;
      log.success(this.tag, `online  ·  ${cfg.prefix}${this.command}`);
      try {
        await client.user.setStatus(cfg.status);
        if (cfg.activityText) await client.user.setActivity(cfg.activityText, { type: cfg.activityType });
      } catch {}
      if (cfg.autoJoinGuildId && cfg.autoJoinVcId) {
        setTimeout(() => { if (!this.manualLeave) this.gatewayJoin(cfg.autoJoinGuildId, cfg.autoJoinVcId); }, 3000 + rand(0, 2000));
        this.armKeepalive();
        log.info(this.tag, `keepalive  →  every ${cfg.keepaliveMs / 1000}s`);
      }
    });

    client.on('messageCreate', msg => {
      this.msgSeen++;
      if (!this.afkEnabled || msg.author.id === client.user?.id || !msg.mentions.has(client.user?.id)) return;
      msg.reply(`${cfg.afkReply}${this.afkReason ? `  —  ${this.afkReason}` : ''}`).catch(() => {});
    });

    client.on('voiceStateUpdate', (_, ns) => {
      if (ns.member?.id !== client.user?.id) return;
      if (ns.channelId) { this.lastVcId = ns.channelId; this.lastGuildId = ns.guild?.id || this.lastGuildId; }
    });

    client.on('raw', packet => {
      if (packet.t !== 'VOICE_STATE_UPDATE')       return;
      if (packet.d?.user_id !== client.user?.id)   return;
      if (packet.d?.channel_id)                    return;
      if (this.manualLeave)                        { log.info(this.tag, 'left vc (manual)'); return; }
      if (!cfg.autoJoinGuildId || !cfg.autoJoinVcId) return;
      if (this.rejoinLock)                         return;

      const now = Date.now();
      if (now - this.lastKickAt < 30000) this.kickCount++; else this.kickCount = 1;
      this.lastKickAt = now;
      this.kicksTotal++;

      const backoff = this.kickCount > 4
        ? rand(20000, 28000)
        : Math.min(3000 * Math.pow(2, this.kickCount - 1), 20000) + rand(0, 1000);

      this.rejoinLock = true;
      setTimeout(() => { this.rejoinLock = false; }, backoff + 3000);
      log.warn(this.tag, `kicked  ×${this.kickCount}  —  rejoin in ${Math.round(backoff / 1000)}s`);

      setTimeout(async () => {
        if (this.manualLeave) return;
        try { await this.joinChannel(cfg.autoJoinGuildId, cfg.autoJoinVcId); log.success(this.tag, 'rejoined'); }
        catch (e) { log.error(this.tag, `rejoin failed  ${e?.message}`); }
      }, backoff);
    });

    client.on('shardReconnecting', () => log.warn(this.tag, 'reconnecting...'));
    client.on('shardResume',       () => log.success(this.tag, 'resumed'));
    client.on('error', e => log.error(this.tag, e?.message));
    client.on('warn',  m => log.warn(this.tag, m));
    client.on('debug', () => {});
  }

  async login() {
    log.info(this.tag, 'logging in...');
    try { await this.client.login(this.token); }
    catch (e) { log.error(this.tag, `login failed  ${e?.message}`); }
  }

  destroy() {
    if (this._keepaliveTimer) clearInterval(this._keepaliveTimer);
    try { this.client.destroy(); } catch {}
  }
}

module.exports = BotInstance;
