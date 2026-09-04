'use strict';

const chalk  = require('chalk');
const Table  = require('cli-table3');
const moment = require('moment');
const os     = require('os');
const log    = require('./logger');
const cfg    = require('./config');
const { getGuardLog } = require('./guard');

const sleep = ms     => new Promise(r => setTimeout(r, ms));
const rand  = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;

let joinLock    = false;
let leaveLock   = false;
let lastJoinMsg = null;

const snipeMap  = new Map();
const afkStore  = new Map();
const cooldowns = new Map();

const onCooldown = (uid, cmd, ms) => {
  const k = `${uid}:${cmd}`, last = cooldowns.get(k) || 0;
  if (Date.now() - last < ms) return true;
  cooldowns.set(k, Date.now());
  return false;
};

const tbl = head => new Table({
  head: head.map(h => chalk.cyan(h)),
  style: { head: [], border: ['gray'], compact: true },
});

const box = (title, lines) => {
  log.raw(chalk.gray('\n  ┌─ ') + chalk.cyanBright(title));
  lines.forEach(([k, v]) => log.raw(`  ${chalk.gray('│')}  ${chalk.gray(k.padEnd(14))}${chalk.white(v)}`));
  log.raw(chalk.gray('  └─\n'));
};

function registerCommands(instance, all) {
  const { client } = instance;
  const { prefix, ownerIds, deleteCommands, deleteDelayMs } = cfg;

  // snipe listener
  client.on('messageDelete', msg => {
    if (!msg.author || msg.author.bot) return;
    snipeMap.set(msg.channelId, {
      content: msg.content || '[embed / attachment]',
      author:  msg.author.tag,
      sentAt:  msg.createdAt,
      delAt:   new Date(),
    });
  });

  // afk mention listener
  client.on('messageCreate', async msg => {
    if (!msg.mentions.has(client.user?.id)) return;
    if (msg.author.id === client.user?.id)  return;
    const afk = [...afkStore.values()][0];
    if (!afk) return;
    msg.reply(`💤  AFK since ${moment(afk.since).fromNow()}${afk.reason ? `  —  ${afk.reason}` : ''}`).catch(() => {});
  });

  client.on('messageCreate', async message => {
    if (!message.content?.startsWith(prefix)) return;
    if (ownerIds.length && !ownerIds.includes(message.author.id)) return;

    // clear afk on owner activity
    if (afkStore.has(message.author.id) && !message.content.startsWith(`${prefix}afk`)) {
      afkStore.delete(message.author.id);
      all.forEach(i => { i.afkEnabled = false; });
    }

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const cmd  = args.shift().toLowerCase();

    const del = async () => {
      if (!deleteCommands) return;
      await sleep(deleteDelayMs);
      message.delete().catch(() => {});
    };

    // ── VOICE ────────────────────────────────────────────────────────────────

    // !join — all bots join your current vc
    if (['join','j'].includes(cmd)) {
      if (message.id === lastJoinMsg || joinLock) return;
      lastJoinMsg = message.id;
      joinLock = true;
      setTimeout(() => { joinLock = false; }, 10000);

      const guild = message.guild;
      const vc    = message.member?.voice?.channel;
      if (!guild || !vc) { joinLock = false; log.warn(instance.tag, 'join — you are not in a vc'); return; }

      log.cmd(instance.tag, `join  →  "${vc.name}"  (${all.length} bots)`);
      let ok = 0, fail = 0;
      for (const inst of all) {
        if (!inst.isOnline) { fail++; continue; }
        await sleep(rand(cfg.joinDelayMs * 0.8, cfg.joinDelayMs * 1.2));
        try { await inst.joinChannel(guild.id, vc.id); inst.armKeepalive(); ok++; }
        catch (e) {
          if ((e?.message || '').match(/UDP|Connection not/)) ok++;
          else { log.error(inst.tag, `join failed  ${e?.message}`); fail++; }
        }
      }
      log.div();
      log.success(instance.tag, `joined  ${ok} ok  ${fail} failed`);
      log.div();
      del(); return;
    }

    // !joinid <vcId> — all bots join by channel id
    if (['joinid','ji'].includes(cmd)) {
      const vcId = args[0], guildId = message.guild?.id;
      if (!vcId || !guildId) { log.warn(instance.tag, 'joinid — provide a channel id'); return; }
      log.cmd(instance.tag, `joinid  →  ${vcId}`);
      for (const inst of all) {
        if (!inst.isOnline) continue;
        await sleep(rand(cfg.joinDelayMs * 0.8, cfg.joinDelayMs * 1.2));
        try { await inst.joinChannel(guildId, vcId); inst.armKeepalive(); }
        catch (e) { log.error(inst.tag, `joinid  ${e?.message}`); }
      }
      del(); return;
    }

    // !leave — all bots leave vc
    if (['leave','l'].includes(cmd)) {
      if (leaveLock) return;
      leaveLock = true;
      setTimeout(() => { leaveLock = false; }, 8000);
      log.cmd(instance.tag, `leave  (${all.length} bots)`);
      for (const inst of all) {
        if (!inst.isOnline) continue;
        await sleep(rand(200, 500));
        inst.leaveChannel();
      }
      del(); return;
    }

    // !move <vcId> — move all bots to another vc instantly
    if (['move','mv'].includes(cmd)) {
      const vcId = args[0], guildId = message.guild?.id;
      if (!vcId || !guildId) { log.warn(instance.tag, 'move — provide a channel id'); return; }
      log.cmd(instance.tag, `move  →  ${vcId}`);
      for (const inst of all) {
        if (!inst.isOnline) continue;
        await sleep(rand(300, 700));
        try { await inst.joinChannel(guildId, vcId); inst.armKeepalive(); }
        catch (e) { log.error(inst.tag, `move  ${e?.message}`); }
      }
      del(); return;
    }

    // !solo <n> — only bot number n joins your vc
    if (['solo','s'].includes(cmd)) {
      const idx = parseInt(args[0], 10) - 1;
      if (isNaN(idx) || idx < 0 || idx >= all.length) {
        log.warn(instance.tag, `solo — provide a number 1–${all.length}`); return;
      }
      const vc = message.member?.voice?.channel;
      if (!vc || !message.guild) { log.warn(instance.tag, 'solo — join a vc first'); return; }
      const inst = all[idx];
      if (!inst.isOnline) { log.warn(instance.tag, `solo — bot ${idx + 1} is not online`); return; }
      await inst.joinChannel(message.guild.id, vc.id);
      inst.armKeepalive();
      log.success(instance.tag, `solo  →  ${inst.client.user?.tag}`);
      del(); return;
    }

    // !vc — show vc status of all bots
    if (['vc','vs'].includes(cmd)) {
      const t = tbl(['#', 'account', 'in vc', 'channel id', 'kicks']);
      all.forEach((inst, i) => t.push([
        String(i + 1),
        inst.client.user?.tag || inst.tag,
        inst.lastVcId ? chalk.green('✓') : chalk.red('✗'),
        inst.lastVcId || '—',
        String(inst.kicksTotal),
      ]));
      log.raw('\n' + t.toString() + '\n');
      del(); return;
    }

    // ── GUARD ────────────────────────────────────────────────────────────────

    // !guard on/off/status/log/wl/dump
    if (['guard','gd'].includes(cmd)) {
      const sub = args[0]?.toLowerCase();

      if (sub === 'on') {
        cfg.guardEnabled = true;
        const vcId = args[1] || all.find(i => i.lastVcId)?.lastVcId || cfg.autoJoinVcId;
        if (vcId) cfg.guardVcId = vcId;
        log.success('GUARD', `on  →  vc  ${cfg.guardVcId || 'dynamic'}`);
        del(); return;
      }

      if (sub === 'off') {
        cfg.guardEnabled = false;
        log.warn('GUARD', 'off');
        del(); return;
      }

      if (sub === 'status') {
        const total = [...getGuardLog().values()].reduce((a, v) => a + v.length, 0);
        box('GUARD', [
          ['enabled',   cfg.guardEnabled  ? chalk.green('yes') : chalk.red('no')],
          ['vc',        cfg.guardVcId     || 'dynamic (current vc)'],
          ['dump vc',   cfg.guardDumpVcId || 'disconnect'],
          ['whitelist', cfg.guardWhitelist.length ? cfg.guardWhitelist.join(', ') : 'none'],
          ['blocked',   String(total)],
        ]);
        del(); return;
      }

      if (sub === 'log') {
        const glog = getGuardLog();
        if (!glog.size) { log.info('GUARD', 'no blocks yet'); del(); return; }
        const t = tbl(['account', 'action', 'when']);
        glog.forEach(events => {
          events.slice(-5).forEach(e => t.push([e.tag, e.action, moment(e.at).fromNow()]));
        });
        log.raw('\n' + t.toString() + '\n');
        del(); return;
      }

      if (sub === 'wl') {
        const uid = args[1];
        if (!uid) { log.warn('GUARD', 'wl — provide a user id'); return; }
        if (cfg.guardWhitelist.includes(uid)) {
          cfg.guardWhitelist = cfg.guardWhitelist.filter(id => id !== uid);
          log.success('GUARD', `removed  ${uid}`);
        } else {
          cfg.guardWhitelist.push(uid);
          log.success('GUARD', `added  ${uid}`);
        }
        del(); return;
      }

      if (sub === 'dump') {
        const vcId = args[1];
        if (!vcId) { log.warn('GUARD', 'dump — provide a vc id'); return; }
        cfg.guardDumpVcId = vcId;
        log.success('GUARD', `dump vc  →  ${vcId}`);
        del(); return;
      }

      log.raw(
        chalk.gray('\n  guard:\n') +
        `  ${chalk.cyan('guard on [vcId]')}  —  enable\n` +
        `  ${chalk.cyan('guard off')}        —  disable\n` +
        `  ${chalk.cyan('guard status')}     —  config\n` +
        `  ${chalk.cyan('guard log')}        —  blocked users\n` +
        `  ${chalk.cyan('guard wl <id>')}    —  whitelist toggle\n` +
        `  ${chalk.cyan('guard dump <id>')}  —  set dump vc\n`
      );
      del(); return;
    }

    // ── PRESENCE ─────────────────────────────────────────────────────────────

    // !status <online|idle|dnd|invisible>
    if (['status','st'].includes(cmd)) {
      const s = args[0];
      if (!['online','idle','dnd','invisible'].includes(s)) {
        log.warn(instance.tag, 'status — online / idle / dnd / invisible'); return;
      }
      for (const inst of all) { try { await inst.client.user?.setStatus(s); } catch {} }
      log.success(instance.tag, `status  →  ${s}`);
      del(); return;
    }

    // !playing / !streaming / !listening / !watching / !noactivity
    if (['playing','pl'].includes(cmd)) {
      const text = args.join(' ');
      for (const inst of all) { try { await inst.client.user?.setActivity(text || null, { type: 'PLAYING' }); } catch {} }
      log.success(instance.tag, `playing  →  ${text || 'cleared'}`);
      del(); return;
    }

    if (['streaming','str'].includes(cmd)) {
      const text = args.join(' ');
      for (const inst of all) { try { await inst.client.user?.setActivity(text, { type: 'STREAMING', url: 'https://twitch.tv/.' }); } catch {} }
      log.success(instance.tag, `streaming  →  ${text}`);
      del(); return;
    }

    if (['listening','ls'].includes(cmd)) {
      const text = args.join(' ');
      for (const inst of all) { try { await inst.client.user?.setActivity(text, { type: 'LISTENING' }); } catch {} }
      log.success(instance.tag, `listening  →  ${text}`);
      del(); return;
    }

    if (['watching','wt'].includes(cmd)) {
      const text = args.join(' ');
      for (const inst of all) { try { await inst.client.user?.setActivity(text, { type: 'WATCHING' }); } catch {} }
      log.success(instance.tag, `watching  →  ${text}`);
      del(); return;
    }

    if (['noactivity','na'].includes(cmd)) {
      for (const inst of all) { try { await inst.client.user?.setActivity(null); } catch {} }
      log.success(instance.tag, 'activity cleared');
      del(); return;
    }

    // ── CHAT ─────────────────────────────────────────────────────────────────

    // !purge <n> — delete your own last n messages
    if (['purge','p'].includes(cmd)) {
      const n = parseInt(args[0], 10);
      if (!n || n < 1 || n > 100) { log.warn(instance.tag, 'purge — 1 to 100'); return; }
      if (onCooldown(message.author.id, 'purge', 8000)) { log.warn(instance.tag, 'purge — cooldown'); return; }
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

    // !snipe — last deleted message in this channel
    if (['snipe','sn'].includes(cmd)) {
      const s = snipeMap.get(message.channelId);
      if (!s) { log.info(instance.tag, 'snipe — nothing cached'); return; }
      log.raw(
        chalk.gray('\n  ┌─ ') + chalk.cyanBright('SNIPE') + '\n' +
        `  ${chalk.gray('│')}  ${chalk.cyan(s.author)}  ${chalk.gray('·')}  ${chalk.white(s.content)}\n` +
        `  ${chalk.gray('│')}  ${chalk.dim('sent ' + moment(s.sentAt).fromNow() + '  ·  deleted ' + moment(s.delAt).fromNow())}\n` +
        chalk.gray('  └─\n')
      );
      del(); return;
    }

    // !afk [reason] — toggle afk, auto-reply mentions
    if (cmd === 'afk') {
      const uid = message.author.id;
      if (afkStore.has(uid)) {
        const since = moment(afkStore.get(uid).since).fromNow();
        afkStore.delete(uid);
        all.forEach(i => { i.afkEnabled = false; i.afkReason = ''; });
        log.info(instance.tag, `afk off  (was ${since})`);
      } else {
        const reason = args.join(' ');
        afkStore.set(uid, { reason, since: new Date() });
        all.forEach(i => { i.afkEnabled = true; i.afkReason = reason; });
        log.info(instance.tag, `afk on${reason ? `  —  "${reason}"` : ''}`);
      }
      del(); return;
    }

    // ── INFO ─────────────────────────────────────────────────────────────────

    // !ping — ws latency of all bots
    if (cmd === 'ping') {
      const rows = all.map(i => `${chalk.cyan(i.client.user?.tag || i.tag)}  ${chalk.yellow(i.client.ws.ping + 'ms')}`).join('\n  ');
      log.raw(`\n  ${rows}\n`);
      del(); return;
    }

    // !stats — full dashboard
    if (cmd === 'stats') {
      box('SYSTEM', [
        ['version',  cfg.version],
        ['author',   `${cfg.author}  ·  ${cfg.dedic}`],
        ['node',     process.version],
        ['ram',      (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1) + ' MB'],
        ['uptime',   instance.uptime],
        ['bots',     String(all.length)],
      ]);
      const t = tbl(['#', 'account', 'ping', 'uptime', 'in vc', 'joins', 'kicks', 'afk']);
      all.forEach((inst, i) => t.push([
        String(i + 1),
        inst.client.user?.tag || inst.tag,
        inst.client.ws.ping + 'ms',
        inst.uptime,
        inst.lastVcId ? chalk.green('✓') : chalk.red('✗'),
        String(inst.joinCount),
        String(inst.kicksTotal),
        inst.afkEnabled ? chalk.yellow('on') : chalk.gray('off'),
      ]));
      log.raw('\n' + t.toString() + '\n');
      del(); return;
    }

    // ── HELP ─────────────────────────────────────────────────────────────────

    if (['help','h'].includes(cmd)) {
      const t = new Table({
        head: [chalk.cyan('cmd'), chalk.cyan('alias'), chalk.cyan('what it does')],
        style: { head: [], border: ['gray'], compact: true },
        colWidths: [18, 10, 40],
      });

      [
        [chalk.gray('── voice ──'),   '',    ''],
        ['join',                      'j',   'all bots join your vc'],
        ['joinid <id>',               'ji',  'all bots join by channel id'],
        ['leave',                     'l',   'all bots leave vc'],
        ['move <id>',                 'mv',  'move all bots to another vc'],
        ['solo <n>',                  's',   'only bot #n joins your vc'],
        ['vc',                        'vs',  'status table — who is where'],
        [chalk.gray('── guard ──'),   '',    ''],
        ['guard on [id]',             'gd',  'block non-owners from joining vc'],
        ['guard off',                 '',    'disable guard'],
        ['guard status',              '',    'show config + block count'],
        ['guard log',                 '',    'who got blocked and when'],
        ['guard wl <id>',             '',    'whitelist toggle for a user'],
        ['guard dump <id>',           '',    'vc to move blocked users to'],
        [chalk.gray('── presence ──'),'',    ''],
        ['status <s>',                'st',  'online / idle / dnd / invisible'],
        ['playing <text>',            'pl',  'set playing activity'],
        ['streaming <text>',          'str', 'set streaming activity'],
        ['listening <text>',          'ls',  'set listening activity'],
        ['watching <text>',           'wt',  'set watching activity'],
        ['noactivity',                'na',  'clear activity'],
        [chalk.gray('── chat ──'),    '',    ''],
        ['purge <n>',                 'p',   'delete your last n messages (max 100)'],
        ['snipe',                     'sn',  'last deleted message in this channel'],
        ['afk [reason]',              '',    'toggle afk — auto-replies mentions'],
        [chalk.gray('── info ──'),    '',    ''],
        ['ping',                      '',    'ws latency of all bots'],
        ['stats',                     '',    'full dashboard — ram, bots, vc, kicks'],
        ['help',                      'h',   'this list'],
      ].forEach(r => t.push(r));

      log.raw(
        `\n  ${chalk.magentaBright('thecrewx')}  ${chalk.dim('·')}  ${chalk.cyanBright('vishal babe')}  ${chalk.dim('·')}  ${chalk.yellow('v' + cfg.version)}\n\n` +
        t.toString() + '\n'
      );
      del(); return;
    }

    // ── PER-BOT ───────────────────────────────────────────────────────────────

    if (cmd === instance.command) {
      const vc = message.member?.voice?.channel;
      if (!vc || !message.guild) return;
      log.cmd(instance.tag, `${prefix}${instance.command}  →  "${vc.name}"`);
      try {
        await sleep(rand(50, 200));
        await instance.joinChannel(message.guild.id, vc.id);
        instance.armKeepalive();
      } catch (e) { log.error(instance.tag, `join  ${e?.message}`); }
      del();
    }
  });
}

module.exports = { registerCommands };
