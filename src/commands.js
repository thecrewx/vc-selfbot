'use strict';

const chalk  = require('chalk');
const Table  = require('cli-table3');
const moment = require('moment');
const log    = require('./logger');
const cfg    = require('./config');
const { getBlockLog, blockTotal } = require('./guard');

const sleep = ms     => new Promise(r => setTimeout(r, ms));
const rand  = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;

// ── module-level state ────────────────────────────────────────────────────────

let   joinLock    = false;
let   leaveLock   = false;
let   lastJoinMsg = null;

const snipeMap  = new Map();  // channelId → snipe data
const afkStore  = new Map();  // ownerId   → { reason, since }
const cooldowns = new Map();  // `uid:cmd` → timestamp

// ── helpers ───────────────────────────────────────────────────────────────────

const onCooldown = (uid, cmd, ms) => {
  const key  = `${uid}:${cmd}`;
  const last = cooldowns.get(key) ?? 0;
  if (Date.now() - last < ms) return true;
  cooldowns.set(key, Date.now());
  return false;
};

const mkTable = (head, colWidths) => new Table({
  head      : head.map(h => chalk.cyan(h)),
  style     : { head: [], border: ['gray'], compact: true },
  ...(colWidths ? { colWidths } : {}),
});

const infoBox = (title, rows) => {
  log.blank();
  log.raw(chalk.gray('  ┌─  ') + chalk.cyanBright(title));
  rows.forEach(([k, v]) =>
    log.raw(`  ${chalk.gray('│')}  ${chalk.gray(k.padEnd(16))}${chalk.white(v)}`)
  );
  log.raw(chalk.gray('  └─'));
  log.blank();
};

// ── registerCommands ──────────────────────────────────────────────────────────

function registerCommands(instance, all) {
  const { client }                              = instance;
  const { prefix, ownerIds, deleteCommands, deleteDelayMs } = cfg;

  const del = async msg => {
    if (!deleteCommands) return;
    await sleep(deleteDelayMs);
    msg.delete().catch(() => {});
  };

  const isOwner = id => ownerIds.includes(id);

  // ── snipe: cache every deleted message ───────────────────────────────────
  client.on('messageDelete', msg => {
    if (!msg.author || msg.author.bot) return;
    snipeMap.set(msg.channelId, {
      content : msg.content || '[no text]',
      author  : msg.author.tag,
      sentAt  : msg.createdAt,
      delAt   : new Date(),
    });
  });

  // ── command router ────────────────────────────────────────────────────────
  client.on('messageCreate', async message => {
    if (!message.content?.startsWith(prefix))      return;
    if (!isOwner(message.author.id))               return;

    // clear afk when owner sends any command
    if (afkStore.has(message.author.id) && !message.content.startsWith(`${prefix}afk`)) {
      afkStore.delete(message.author.id);
      all.forEach(i => { i.afkEnabled = false; i.afkReason = ''; });
      log.info(instance.tag, 'afk cleared');
    }

    const raw  = message.content.slice(prefix.length).trim();
    const args = raw.split(/\s+/);
    const cmd  = args.shift().toLowerCase();

    // ════════════════════════════════════════════════════════════════════════
    //  VOICE
    // ════════════════════════════════════════════════════════════════════════

    if (cmd === 'join' || cmd === 'j') {
      if (message.id === lastJoinMsg || joinLock) return;
      lastJoinMsg = message.id;
      joinLock    = true;
      setTimeout(() => { joinLock = false; }, 10000);

      const vc    = message.member?.voice?.channel;
      const guild = message.guild;

      if (!vc || !guild) {
        joinLock = false;
        log.warn(instance.tag, 'join  —  you are not in a voice channel');
        return;
      }

      log.div();
      log.cmd(instance.tag, `join  →  "${vc.name}"  [${all.length} bots]`);

      let ok = 0, fail = 0;
      for (const inst of all) {
        if (!inst.isOnline) { fail++; continue; }
        await sleep(rand(cfg.joinDelayMs * 0.8, cfg.joinDelayMs * 1.2));
        try {
          await inst.joinChannel(guild.id, vc.id);
          inst.armKeepalive(guild.id, vc.id);
          ok++;
        } catch (e) {
          if (/UDP|Connection not/.test(e?.message ?? '')) { ok++; }
          else { log.error(inst.tag, `join  ${e?.message}`); fail++; }
        }
      }

      log.success(instance.tag, `done  —  ${ok} joined  ${fail} failed`);
      log.div();
      del(message);
      return;
    }

    if (cmd === 'joinid' || cmd === 'ji') {
      const vcId    = args[0];
      const guildId = message.guild?.id;
      if (!vcId || !guildId) { log.warn(instance.tag, 'joinid  —  provide a channel id'); return; }

      log.cmd(instance.tag, `joinid  →  ${vcId}  [${all.length} bots]`);
      for (const inst of all) {
        if (!inst.isOnline) continue;
        await sleep(rand(cfg.joinDelayMs * 0.8, cfg.joinDelayMs * 1.2));
        try { await inst.joinChannel(guildId, vcId); inst.armKeepalive(guildId, vcId); }
        catch (e) { log.error(inst.tag, `joinid  ${e?.message}`); }
      }
      del(message);
      return;
    }

    if (cmd === 'leave' || cmd === 'l') {
      if (leaveLock) return;
      leaveLock = true;
      setTimeout(() => { leaveLock = false; }, 8000);

      log.cmd(instance.tag, `leave  [${all.length} bots]`);
      for (const inst of all) {
        if (!inst.isOnline) continue;
        await sleep(rand(200, 500));
        inst.leaveChannel();
      }
      del(message);
      return;
    }

    if (cmd === 'move' || cmd === 'mv') {
      const vcId    = args[0];
      const guildId = message.guild?.id;
      if (!vcId || !guildId) { log.warn(instance.tag, 'move  —  provide a channel id'); return; }

      log.cmd(instance.tag, `move  →  ${vcId}  [${all.length} bots]`);
      for (const inst of all) {
        if (!inst.isOnline) continue;
        await sleep(rand(300, 700));
        try { await inst.joinChannel(guildId, vcId); inst.armKeepalive(guildId, vcId); }
        catch (e) { log.error(inst.tag, `move  ${e?.message}`); }
      }
      del(message);
      return;
    }

    if (cmd === 'solo' || cmd === 's') {
      const idx = parseInt(args[0], 10) - 1;
      if (!Number.isFinite(idx) || idx < 0 || idx >= all.length) {
        log.warn(instance.tag, `solo  —  provide 1–${all.length}`);
        return;
      }
      const vc    = message.member?.voice?.channel;
      const guild = message.guild;
      if (!vc || !guild) { log.warn(instance.tag, 'solo  —  join a voice channel first'); return; }

      const inst = all[idx];
      if (!inst.isOnline) { log.warn(instance.tag, `solo  —  bot ${idx + 1} is not online`); return; }

      await inst.joinChannel(guild.id, vc.id);
      inst.armKeepalive(guild.id, vc.id);
      log.success(instance.tag, `solo  →  ${inst.client.user?.tag}`);
      del(message);
      return;
    }

    if (cmd === 'vc' || cmd === 'vs') {
      const t = mkTable(['#', 'account', 'vc', 'channel id', 'kicks']);
      all.forEach((inst, i) => t.push([
        String(i + 1),
        inst.client.user?.tag ?? inst.tag,
        inst.lastVcId ? chalk.green('✓') : chalk.red('✗'),
        inst.lastVcId ?? '—',
        String(inst.kicksTotal),
      ]));
      log.blank();
      log.raw(t.toString());
      log.blank();
      del(message);
      return;
    }

    // ════════════════════════════════════════════════════════════════════════
    //  GUARD
    // ════════════════════════════════════════════════════════════════════════

    if (cmd === 'guard' || cmd === 'gd') {
      const sub = args[0]?.toLowerCase();

      if (sub === 'on') {
        cfg.guardEnabled = true;
        const vcId = args[1] || all.find(i => i.lastVcId)?.lastVcId || cfg.autoJoinVcId || '';
        if (vcId) cfg.guardVcId = vcId;
        log.success('GUARD', `enabled  →  protecting  ${cfg.guardVcId || '(current vc)'}`);
        del(message);
        return;
      }

      if (sub === 'off') {
        cfg.guardEnabled = false;
        log.warn('GUARD', 'disabled');
        del(message);
        return;
      }

      if (sub === 'status') {
        infoBox('GUARD STATUS', [
          ['enabled',    cfg.guardEnabled ? 'yes' : 'no'],
          ['protected',  cfg.guardVcId    || '(dynamic — current vc)'],
          ['dump vc',    cfg.guardDumpVcId || 'disconnect'],
          ['whitelist',  cfg.guardWhitelist.length ? cfg.guardWhitelist.join(', ') : 'none'],
          ['send msg',   cfg.guardMsg ? 'yes' : 'no'],
          ['total blocked', String(blockTotal())],
        ]);
        del(message);
        return;
      }

      if (sub === 'log') {
        const bLog = getBlockLog();
        if (!bLog.size) { log.info('GUARD', 'no blocks logged yet'); return; }
        const t = mkTable(['account', 'action', 'when']);
        bLog.forEach(events =>
          events.slice(-5).forEach(e => t.push([e.tag, e.action, moment(e.at).fromNow()]))
        );
        log.blank();
        log.raw(t.toString());
        log.blank();
        del(message);
        return;
      }

      if (sub === 'wl') {
        const uid = args[1];
        if (!uid) { log.warn('GUARD', 'wl  —  provide a user id'); return; }
        if (cfg.guardWhitelist.includes(uid)) {
          cfg.guardWhitelist = cfg.guardWhitelist.filter(id => id !== uid);
          log.success('GUARD', `removed  ${uid}  from whitelist`);
        } else {
          cfg.guardWhitelist.push(uid);
          log.success('GUARD', `added  ${uid}  to whitelist`);
        }
        del(message);
        return;
      }

      if (sub === 'dump') {
        const vcId = args[1];
        if (!vcId) { log.warn('GUARD', 'dump  —  provide a vc id'); return; }
        cfg.guardDumpVcId = vcId;
        log.success('GUARD', `dump vc  →  ${vcId}`);
        del(message);
        return;
      }

      // guard help
      log.blank();
      [
        ['guard on [vcId]',  'enable  —  protect current or specified vc'],
        ['guard off',        'disable guard'],
        ['guard status',     'show config and block count'],
        ['guard log',        'show last blocked users'],
        ['guard wl <id>',    'toggle user in whitelist'],
        ['guard dump <id>',  'vc to move blocked users into'],
      ].forEach(([c, d]) =>
        log.raw(`  ${chalk.cyan((prefix + c).padEnd(24))}  ${chalk.gray(d)}`)
      );
      log.blank();
      del(message);
      return;
    }

    // ════════════════════════════════════════════════════════════════════════
    //  PRESENCE
    // ════════════════════════════════════════════════════════════════════════

    if (cmd === 'status' || cmd === 'st') {
      const s = args[0]?.toLowerCase();
      if (!['online', 'idle', 'dnd', 'invisible'].includes(s)) {
        log.warn(instance.tag, 'status  —  online / idle / dnd / invisible');
        return;
      }
      for (const inst of all) { try { await inst.client.user?.setStatus(s); } catch {} }
      log.success(instance.tag, `status  →  ${s}`);
      del(message);
      return;
    }

    if (cmd === 'playing' || cmd === 'pl') {
      const text = args.join(' ');
      for (const inst of all) {
        try { await inst.client.user?.setActivity(text || null, { type: 'PLAYING' }); } catch {}
      }
      log.success(instance.tag, `playing  →  ${text || 'cleared'}`);
      del(message);
      return;
    }

    if (cmd === 'streaming' || cmd === 'str') {
      const text = args.join(' ');
      for (const inst of all) {
        try { await inst.client.user?.setActivity(text, { type: 'STREAMING', url: 'https://twitch.tv/.' }); } catch {}
      }
      log.success(instance.tag, `streaming  →  ${text}`);
      del(message);
      return;
    }

    if (cmd === 'listening' || cmd === 'ls') {
      const text = args.join(' ');
      for (const inst of all) {
        try { await inst.client.user?.setActivity(text, { type: 'LISTENING' }); } catch {}
      }
      log.success(instance.tag, `listening  →  ${text}`);
      del(message);
      return;
    }

    if (cmd === 'watching' || cmd === 'wt') {
      const text = args.join(' ');
      for (const inst of all) {
        try { await inst.client.user?.setActivity(text, { type: 'WATCHING' }); } catch {}
      }
      log.success(instance.tag, `watching  →  ${text}`);
      del(message);
      return;
    }

    if (cmd === 'noactivity' || cmd === 'na') {
      for (const inst of all) { try { await inst.client.user?.setActivity(null); } catch {} }
      log.success(instance.tag, 'activity cleared');
      del(message);
      return;
    }

    // ════════════════════════════════════════════════════════════════════════
    //  CHAT
    // ════════════════════════════════════════════════════════════════════════

    if (cmd === 'purge' || cmd === 'p') {
      const n = parseInt(args[0], 10);
      if (!Number.isFinite(n) || n < 1 || n > 100) {
        log.warn(instance.tag, 'purge  —  provide 1–100');
        return;
      }
      if (onCooldown(message.author.id, 'purge', 8000)) {
        log.warn(instance.tag, 'purge  —  cooldown active');
        return;
      }
      const msgs = await message.channel.messages.fetch({ limit: 100 }).catch(() => null);
      if (!msgs) return;
      let deleted = 0;
      for (const [, m] of msgs) {
        if (deleted >= n) break;
        if (m.author.id !== client.user.id) continue;
        try { await m.delete(); deleted++; await sleep(rand(400, 700)); } catch {}
      }
      log.success(instance.tag, `purge  →  ${deleted} deleted`);
      return;
    }

    if (cmd === 'snipe' || cmd === 'sn') {
      const s = snipeMap.get(message.channelId);
      if (!s) { log.info(instance.tag, 'snipe  —  nothing cached in this channel'); return; }
      log.blank();
      log.raw(
        chalk.gray('  ┌─  ') + chalk.cyanBright('SNIPE') + '\n' +
        `  ${chalk.gray('│')}  ${chalk.cyan(s.author)}\n` +
        `  ${chalk.gray('│')}  ${chalk.white(s.content)}\n` +
        `  ${chalk.gray('│')}  ${chalk.dim('sent ' + moment(s.sentAt).fromNow() + '  ·  deleted ' + moment(s.delAt).fromNow())}` + '\n' +
        chalk.gray('  └─')
      );
      log.blank();
      del(message);
      return;
    }

    if (cmd === 'afk') {
      const uid = message.author.id;
      if (afkStore.has(uid)) {
        const since = moment(afkStore.get(uid).since).fromNow();
        afkStore.delete(uid);
        all.forEach(i => { i.afkEnabled = false; i.afkReason = ''; });
        log.info(instance.tag, `afk off  (was active ${since})`);
      } else {
        const reason = args.join(' ');
        afkStore.set(uid, { reason, since: new Date() });
        all.forEach(i => { i.afkEnabled = true; i.afkReason = reason; });
        log.info(instance.tag, `afk on${reason ? `  —  "${reason}"` : ''}`);
      }
      del(message);
      return;
    }

    // ════════════════════════════════════════════════════════════════════════
    //  INFO
    // ════════════════════════════════════════════════════════════════════════

    if (cmd === 'ping') {
      log.blank();
      all.forEach(inst =>
        log.raw(`  ${chalk.cyan((inst.client.user?.tag ?? inst.tag).padEnd(32))}  ${chalk.yellow(inst.client.ws.ping + 'ms')}`)
      );
      log.blank();
      del(message);
      return;
    }

    if (cmd === 'stats') {
      infoBox('SYSTEM', [
        ['version',  cfg.version],
        ['author',   `${cfg.author}  ·  ${cfg.dedic}`],
        ['node',     process.version],
        ['ram',      (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1) + ' MB'],
        ['bots',     String(all.length)],
        ['guard',    cfg.guardEnabled ? `on  ·  ${blockTotal()} blocked` : 'off'],
      ]);

      const t = mkTable(['#', 'account', 'ping', 'uptime', 'vc', 'joins', 'kicks', 'afk']);
      all.forEach((inst, i) => t.push([
        String(i + 1),
        inst.client.user?.tag ?? inst.tag,
        inst.client.ws.ping + 'ms',
        inst.uptime,
        inst.lastVcId ? chalk.green('✓') : chalk.red('✗'),
        String(inst.joinCount),
        String(inst.kicksTotal),
        inst.afkEnabled ? chalk.yellow('on') : chalk.gray('off'),
      ]));
      log.raw(t.toString());
      log.blank();
      del(message);
      return;
    }

    // ════════════════════════════════════════════════════════════════════════
    //  HELP
    // ════════════════════════════════════════════════════════════════════════

    if (cmd === 'help' || cmd === 'h') {
      const t = new Table({
        head      : [chalk.cyan('command'), chalk.cyan('alias'), chalk.cyan('description')],
        style     : { head: [], border: ['gray'], compact: true },
        colWidths : [20, 8, 38],
      });

      const section = label => [chalk.gray(label), '', ''];
      const entry   = (c, a, d) => [c, chalk.gray(a), chalk.gray(d)];

      [
        section('voice'),
        entry('join',             'j',   'all bots join your vc'),
        entry('joinid <id>',      'ji',  'all bots join by channel id'),
        entry('leave',            'l',   'all bots leave vc'),
        entry('move <id>',        'mv',  'move all bots to another vc'),
        entry('solo <n>',         's',   'only bot #n joins your vc'),
        entry('vc',               'vs',  'status — who is where, kick counts'),
        section('guard'),
        entry('guard on [id]',    'gd',  'block non-owners from joining vc'),
        entry('guard off',        '',    'disable guard'),
        entry('guard status',     '',    'config + total block count'),
        entry('guard log',        '',    'last blocked users'),
        entry('guard wl <id>',    '',    'toggle whitelist for a user id'),
        entry('guard dump <id>',  '',    'vc to move blocked users into'),
        section('presence'),
        entry('status <s>',       'st',  'online / idle / dnd / invisible'),
        entry('playing <text>',   'pl',  'set playing activity'),
        entry('streaming <text>', 'str', 'set streaming activity'),
        entry('listening <text>', 'ls',  'set listening activity'),
        entry('watching <text>',  'wt',  'set watching activity'),
        entry('noactivity',       'na',  'clear all activity'),
        section('chat'),
        entry('purge <n>',        'p',   'delete your last n messages (max 100)'),
        entry('snipe',            'sn',  'last deleted message in this channel'),
        entry('afk [reason]',     '',    'toggle afk — auto-replies to mentions'),
        section('info'),
        entry('ping',             '',    'ws latency of all bots'),
        entry('stats',            '',    'dashboard — ram · vc · kicks · guard'),
        entry('help',             'h',   'this list'),
      ].forEach(r => t.push(r));

      log.blank();
      log.raw(
        `  ${chalk.magentaBright('thecrewx')}  ${chalk.gray('·')}  ` +
        `${chalk.cyanBright('vishal babe')}  ${chalk.gray('·')}  ` +
        `${chalk.yellow('v' + cfg.version)}\n`
      );
      log.raw(t.toString());
      log.blank();
      del(message);
      return;
    }

    // ════════════════════════════════════════════════════════════════════════
    //  PER-BOT COMMAND
    // ════════════════════════════════════════════════════════════════════════

    if (cmd === instance.command) {
      const vc    = message.member?.voice?.channel;
      const guild = message.guild;
      if (!vc || !guild) return;

      log.cmd(instance.tag, `${prefix}${instance.command}  →  "${vc.name}"`);
      try {
        await sleep(rand(50, 200));
        await instance.joinChannel(guild.id, vc.id);
        instance.armKeepalive(guild.id, vc.id);
      } catch (e) {
        log.error(instance.tag, `per-bot join  ${e?.message}`);
      }
      del(message);
    }
  });
}

module.exports = { registerCommands };
