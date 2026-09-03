'use strict';
// ═══════════════════════════════════════════════════════════════════════════════
//   COMMANDS — Full command handler
//   vc-selfbot v0.0.67 | made by thecrewx for vishal babe
// ═══════════════════════════════════════════════════════════════════════════════

const chalk  = require('chalk');
const Table  = require('cli-table3');
const moment = require('moment');
const os     = require('os');
const log    = require('./logger');
const cfg    = require('./config');

const sleep = ms      => new Promise(r => setTimeout(r, ms));
const rand  = (a, b)  => Math.floor(Math.random() * (b - a + 1)) + a;

// ── Global guards ─────────────────────────────────────────────────────────────
let joinLock    = false;
let leaveLock   = false;
let lastJoinMsg = null;

// ── Snipe store: channelId → { content, author, createdAt, deletedAt } ────────
const snipeMap = new Map();

// ── AFK store: userId → { reason, since } ────────────────────────────────────
const afkStore = new Map();

// ── Cooldown store: `userId:cmd` → timestamp ─────────────────────────────────
const cooldowns = new Map();
function onCooldown(userId, cmd, ms) {
  const key  = `${userId}:${cmd}`;
  const last = cooldowns.get(key) || 0;
  if (Date.now() - last < ms) return true;
  cooldowns.set(key, Date.now());
  return false;
}

/**
 * Register all commands + event listeners on one instance.
 * @param {import('./bot')} instance
 * @param {import('./bot')[]} all
 */
function registerCommands(instance, all) {
  const { client } = instance;
  const { prefix, ownerIds, deleteCommands, deleteDelayMs } = cfg;

  // ── Snipe listener ───────────────────────────────────────────────────────
  client.on('messageDelete', msg => {
    if (!msg.author || msg.author.bot) return;
    snipeMap.set(msg.channelId, {
      content:   msg.content || '[no text / embed]',
      author:    msg.author.tag,
      authorId:  msg.author.id,
      createdAt: msg.createdAt,
      deletedAt: new Date(),
    });
  });

  // ── AFK auto-reply ────────────────────────────────────────────────────────
  client.on('messageCreate', async msg => {
    if (!msg.mentions.has(client.user?.id)) return;
    if (msg.author.id === client.user?.id)  return;
    const afk = afkStore.get(client.user?.id);
    if (!afk) return;
    const since = moment(afk.since).fromNow();
    try {
      await msg.reply(`💤 **AFK** since ${since}${afk.reason ? ` — ${afk.reason}` : ''}`);
    } catch {}
  });

  // ── Main message handler ──────────────────────────────────────────────────
  client.on('messageCreate', async message => {
    if (!message.content?.startsWith(prefix)) return;
    if (ownerIds.length && !ownerIds.includes(message.author.id)) return;

    // Clear AFK on owner activity
    if (afkStore.has(message.author.id) && !message.content.startsWith(`${prefix}afk`)) {
      afkStore.delete(message.author.id);
      log.info(instance.tag, `AFK cleared for ${message.author.tag}`);
    }

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const cmd  = args.shift().toLowerCase();

    const autoDel = async () => {
      if (!deleteCommands) return;
      await sleep(deleteDelayMs);
      try { await message.delete(); } catch {}
    };

    // ═════════════════════════════════════════════════════════════════════════
    //  VOICE
    // ═════════════════════════════════════════════════════════════════════════

    // !join — all bots join caller's VC
    if (['join','j','connect','vc'].includes(cmd)) {
      if (message.id === lastJoinMsg) return;
      if (joinLock) { log.warn(instance.tag, 'join debounced'); return; }
      lastJoinMsg = message.id;
      joinLock = true;
      setTimeout(() => { joinLock = false; }, 10000);

      const guild = message.guild;
      const vc    = message.member?.voice?.channel;
      if (!guild || !vc) {
        log.warn(instance.tag, '!join — you are not in a voice channel');
        setTimeout(() => { joinLock = false; }, 500);
        return;
      }

      log.cmd(instance.tag, `!join → "${vc.name}" (${vc.id}) — ${all.length} bots`);
      let ok = 0, fail = 0;
      for (const inst of all) {
        if (!inst.isOnline) { log.warn(inst.tag, 'skip (not ready)'); fail++; continue; }
        await sleep(rand(cfg.joinDelayMs * 0.8, cfg.joinDelayMs * 1.2));
        try {
          await inst.joinChannel(guild.id, vc.id);
          inst.armKeepalive();
          ok++;
        } catch (e) {
          const m = e?.message || '';
          if (m.includes('UDP') || m.includes('Connection not')) {
            log.warn(inst.tag, 'UDP timeout — kept gateway join');
            ok++;
          } else {
            log.error(inst.tag, `join failed: ${m}`);
            fail++;
          }
        }
      }
      log.success(instance.tag, `join complete — ${ok} ok, ${fail} failed`);
      autoDel();
      return;
    }

    // !joinid <channelId> [guildId] — join specific VC by ID
    if (['joinid','ji','vcid'].includes(cmd)) {
      const vcId    = args[0];
      const guildId = args[1] || message.guild?.id;
      if (!vcId)    { log.warn(instance.tag, '!joinid — provide a channel ID'); return; }
      if (!guildId) { log.warn(instance.tag, '!joinid — no guild ID'); return; }

      log.cmd(instance.tag, `!joinid ${vcId} (guild ${guildId}) — ${all.length} bots`);
      for (const inst of all) {
        if (!inst.isOnline) continue;
        await sleep(rand(cfg.joinDelayMs * 0.8, cfg.joinDelayMs * 1.2));
        try { await inst.joinChannel(guildId, vcId); inst.armKeepalive(); }
        catch (e) { log.error(inst.tag, `joinid failed: ${e?.message}`); }
      }
      autoDel();
      return;
    }

    // !leave — all bots leave VC
    if (['leave','l','dc','disconnect'].includes(cmd)) {
      if (leaveLock) return;
      leaveLock = true;
      setTimeout(() => { leaveLock = false; }, 8000);
      log.cmd(instance.tag, `!leave — ${all.length} bots`);
      for (const inst of all) {
        if (!inst.isOnline) continue;
        await sleep(rand(200, 500));
        inst.leaveChannel();
      }
      autoDel();
      return;
    }

    // !vcstatus — table of all bots' VC state
    if (['vcstatus','vs','vcinfo'].includes(cmd)) {
      const t = new Table({
        head: ['#', 'Tag', 'In VC', 'VC ID', 'Kicks'],
        style: { head: ['cyan'], border: ['gray'] },
      });
      all.forEach((inst, i) => {
        t.push([
          i + 1,
          inst.client.user?.tag || inst.tag,
          inst.lastVcId ? chalk.green('✓ yes') : chalk.red('✗ no'),
          inst.lastVcId || '—',
          inst.kicksTotal,
        ]);
      });
      log.raw('\n' + t.toString() + '\n');
      autoDel();
      return;
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  PRESENCE
    // ═════════════════════════════════════════════════════════════════════════

    if (['setstatus','ss'].includes(cmd)) {
      const s = args[0];
      if (!['online','idle','dnd','invisible'].includes(s)) {
        log.warn(instance.tag, 'setstatus: use online/idle/dnd/invisible'); return;
      }
      for (const inst of all) { try { await inst.client.user?.setStatus(s); } catch {} }
      log.success(instance.tag, `status → ${s}`);
      autoDel(); return;
    }

    if (['setactivity','sa','setgame','playing'].includes(cmd)) {
      const text = args.join(' ');
      for (const inst of all) {
        try { await inst.client.user?.setActivity(text || null, { type: 'PLAYING' }); } catch {}
      }
      log.success(instance.tag, `activity → Playing ${text || '(cleared)'}`);
      autoDel(); return;
    }

    if (['setstreaming','stream'].includes(cmd)) {
      const text = args.join(' ');
      for (const inst of all) {
        try { await inst.client.user?.setActivity(text, { type: 'STREAMING', url: 'https://twitch.tv/.' }); } catch {}
      }
      log.success(instance.tag, `activity → Streaming ${text}`);
      autoDel(); return;
    }

    if (['setlistening','listen'].includes(cmd)) {
      const text = args.join(' ');
      for (const inst of all) {
        try { await inst.client.user?.setActivity(text, { type: 'LISTENING' }); } catch {}
      }
      log.success(instance.tag, `activity → Listening to ${text}`);
      autoDel(); return;
    }

    if (['setwatching','watch'].includes(cmd)) {
      const text = args.join(' ');
      for (const inst of all) {
        try { await inst.client.user?.setActivity(text, { type: 'WATCHING' }); } catch {}
      }
      log.success(instance.tag, `activity → Watching ${text}`);
      autoDel(); return;
    }

    if (['clearactivity','ca','noactivity'].includes(cmd)) {
      for (const inst of all) {
        try { await inst.client.user?.setActivity(null); } catch {}
      }
      log.success(instance.tag, 'activity cleared on all bots');
      autoDel(); return;
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  CHAT / MESSAGING
    // ═════════════════════════════════════════════════════════════════════════

    // !say <text> — send a message then delete the command
    if (['say','echo'].includes(cmd)) {
      const text = args.join(' ');
      if (!text) return;
      try { await message.channel.send(text); } catch {}
      try { await message.delete(); } catch {}
      return;
    }

    // !purge <n> — delete your own last N messages
    if (['purge','clear','prune'].includes(cmd)) {
      const count = parseInt(args[0], 10);
      if (!count || count < 1 || count > 100) {
        log.warn(instance.tag, 'purge: provide 1–100'); return;
      }
      if (onCooldown(message.author.id, 'purge', 8000)) {
        log.warn(instance.tag, 'purge on cooldown'); return;
      }
      const msgs = await message.channel.messages.fetch({ limit: 100 }).catch(() => null);
      if (!msgs) return;
      let deleted = 0;
      for (const [, m] of msgs) {
        if (deleted >= count) break;
        if (m.author.id !== client.user.id) continue;
        try { await m.delete(); deleted++; await sleep(rand(400, 700)); } catch {}
      }
      log.success(instance.tag, `purge: deleted ${deleted} message(s)`);
      return;
    }

    // !snipe — last deleted message in this channel
    if (['snipe','sn'].includes(cmd)) {
      const s = snipeMap.get(message.channelId);
      if (!s) { log.info(instance.tag, 'snipe: nothing to show'); return; }
      const ago = moment(s.deletedAt).fromNow();
      log.raw(
        chalk.gray('  ┌──[ ') + chalk.yellow('SNIPE') + chalk.gray(' ]') + '\n' +
        chalk.gray('  │ ') + chalk.cyan(s.author) + chalk.gray(' — ') + chalk.white(s.content) + '\n' +
        chalk.gray('  │ ') + chalk.dim(`sent ${moment(s.createdAt).fromNow()} • deleted ${ago}`) + '\n' +
        chalk.gray('  └──')
      );
      autoDel(); return;
    }

    // !afk [reason] — toggle AFK
    if (cmd === 'afk') {
      const uid = message.author.id;
      if (afkStore.has(uid)) {
        const since = moment(afkStore.get(uid).since).fromNow();
        afkStore.delete(uid);
        // Also clear per-instance AFK flag
        for (const inst of all) inst.afkEnabled = false;
        log.info(instance.tag, `AFK off (was since ${since})`);
      } else {
        const reason = args.join(' ');
        afkStore.set(uid, { reason, since: new Date() });
        for (const inst of all) {
          inst.afkEnabled = true;
          inst.afkReason  = reason;
          inst.afkSince   = new Date();
        }
        log.info(instance.tag, `AFK on${reason ? ` — "${reason}"` : ''}`);
      }
      autoDel(); return;
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  UTILITY
    // ═════════════════════════════════════════════════════════════════════════

    // !ping
    if (['ping','p','latency'].includes(cmd)) {
      const rows = all.map(i => `${chalk.cyan(i.tag)}: ${chalk.yellow(i.client.ws.ping + 'ms')}`).join('  ');
      log.raw(`  ${rows}`);
      autoDel(); return;
    }

    // !uptime
    if (['uptime','up'].includes(cmd)) {
      const t = new Table({
        head: ['#','Tag','Uptime','VC Joins','Kicks','Msgs Seen'],
        style: { head: ['cyan'], border: ['gray'] },
      });
      all.forEach((inst, i) => {
        t.push([i+1, inst.client.user?.tag || inst.tag, inst.uptime, inst.joinCount, inst.kicksTotal, inst.msgSeen]);
      });
      log.raw('\n' + t.toString() + '\n');
      autoDel(); return;
    }

    // !stats — full stats board
    if (['stats','info','botinfo'].includes(cmd)) {
      const memMB = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
      const cpuUp = (os.uptime() / 3600).toFixed(1);

      // System row
      log.raw(
        chalk.gray('\n  ┌─ ') + chalk.blueBright('SYSTEM') + '\n' +
        chalk.gray('  │ ') + `Node ${process.version}  •  RAM ${memMB} MB  •  CPU uptime ${cpuUp}h\n` +
        chalk.gray('  │ ') + `v${cfg.version}  •  made by ${chalk.magentaBright(cfg.author)}  for ${chalk.cyanBright(cfg.dedic)}\n` +
        chalk.gray('  └─')
      );

      const t = new Table({
        head: ['#','Tag','Ping','Uptime','VC','Joins','Kicks','AFK'],
        style: { head: ['cyan'], border: ['gray'] },
      });
      all.forEach((inst, i) => {
        t.push([
          i + 1,
          inst.client.user?.tag || inst.tag,
          inst.client.ws.ping + 'ms',
          inst.uptime,
          inst.lastVcId ? chalk.green('✓') : chalk.red('✗'),
          inst.joinCount,
          inst.kicksTotal,
          inst.afkEnabled ? chalk.yellow('on') : chalk.gray('off'),
        ]);
      });
      log.raw('\n' + t.toString() + '\n');
      autoDel(); return;
    }

    // !serverlist
    if (['serverlist','sl','guilds'].includes(cmd)) {
      const guilds = instance.client.guilds.cache;
      const t = new Table({
        head: ['Name','ID','Members'],
        style: { head: ['cyan'], border: ['gray'] },
      });
      guilds.forEach(g => t.push([g.name, g.id, g.memberCount ?? '?']));
      log.raw(`\n${t.toString()}\n  Total: ${guilds.size} servers\n`);
      autoDel(); return;
    }

    // !serverinfo
    if (['serverinfo','si','guild'].includes(cmd)) {
      const g = message.guild;
      if (!g) return;
      log.raw(
        chalk.gray('\n  ┌─ ') + chalk.blueBright('SERVER INFO') + '\n' +
        chalk.gray('  │ ') + `Name: ${chalk.white(g.name)}\n` +
        chalk.gray('  │ ') + `ID: ${g.id}  •  Members: ${chalk.yellow(g.memberCount)}\n` +
        chalk.gray('  │ ') + `Owner: ${g.ownerId}  •  Locale: ${g.preferredLocale}\n` +
        chalk.gray('  │ ') + `Created: ${moment(g.createdAt).format('YYYY-MM-DD')}\n` +
        chalk.gray('  └─')
      );
      autoDel(); return;
    }

    // !userinfo [@user] — user info card
    if (['userinfo','ui','whois'].includes(cmd)) {
      const target = message.mentions.users.first() || message.author;
      log.raw(
        chalk.gray('\n  ┌─ ') + chalk.blueBright('USER INFO') + '\n' +
        chalk.gray('  │ ') + `Tag: ${chalk.white(target.tag)}  •  ID: ${target.id}\n` +
        chalk.gray('  │ ') + `Bot: ${target.bot ? chalk.red('yes') : chalk.gray('no')}  •  Created: ${moment(target.createdAt).format('YYYY-MM-DD')}\n` +
        chalk.gray('  │ ') + `Avatar: ${target.displayAvatarURL({ size: 4096 })}\n` +
        chalk.gray('  └─')
      );
      autoDel(); return;
    }

    // !avatar [@user]
    if (['avatar','av','pfp'].includes(cmd)) {
      const target = message.mentions.users.first() || message.author;
      log.raw(`  🖼  ${chalk.cyan(target.tag)}: ${target.displayAvatarURL({ size: 4096, dynamic: true })}`);
      autoDel(); return;
    }

    // !copycat <botIndex 1-N> — make ONE specific bot follow you
    if (['copycat','cc'].includes(cmd)) {
      const idx = parseInt(args[0], 10) - 1;
      if (isNaN(idx) || idx < 0 || idx >= all.length) {
        log.warn(instance.tag, `copycat: provide a bot number 1–${all.length}`); return;
      }
      const vc = message.member?.voice?.channel;
      if (!vc || !message.guild) { log.warn(instance.tag, 'copycat: join a VC first'); return; }
      const inst = all[idx];
      await inst.joinChannel(message.guild.id, vc.id);
      log.success(instance.tag, `copycat: ${inst.tag} joined your VC`);
      autoDel(); return;
    }

    // !moveall <channelId> — move all bots to a different VC without !leave + !joinid
    if (['moveall','ma','move'].includes(cmd)) {
      const vcId    = args[0];
      const guildId = args[1] || message.guild?.id;
      if (!vcId)    { log.warn(instance.tag, 'moveall: provide a channel ID'); return; }
      if (!guildId) return;
      log.cmd(instance.tag, `!moveall → ${vcId}`);
      for (const inst of all) {
        if (!inst.isOnline) continue;
        await sleep(rand(300, 700));
        try { await inst.joinChannel(guildId, vcId); inst.armKeepalive(); }
        catch (e) { log.error(inst.tag, `moveall failed: ${e?.message}`); }
      }
      autoDel(); return;
    }

    // !mute — self-mute all bots toggle
    if (['mute','selfmute'].includes(cmd)) {
      log.cmd(instance.tag, '!mute — toggling self-mute on all bots');
      for (const inst of all) {
        if (!inst.lastVcId || !inst.lastGuildId) continue;
        // Re-assert gateway with self_mute toggled
        try {
          const payload = { op: 4, d: { guild_id: inst.lastGuildId, channel_id: inst.lastVcId, self_mute: true, self_deaf: false } };
          const ws = inst.client.ws;
          if (ws?.send) ws.send(payload);
          else if (ws?.shards?.first()?.send) ws.shards.first().send(payload);
        } catch {}
      }
      log.success(instance.tag, 'self-mute sent to all bots in VC');
      autoDel(); return;
    }

    // !resetkicks — clear kick counters on all bots
    if (['resetkicks','rk'].includes(cmd)) {
      all.forEach(i => { i.kickCount = 0; i.kicksTotal = 0; });
      log.success(instance.tag, 'kick counters reset');
      autoDel(); return;
    }

    // !token — show masked token
    if (['token','tokeninfo'].includes(cmd)) {
      const tok = instance.token;
      const masked = tok.slice(0, 10) + '...' + tok.slice(-6);
      log.info(instance.tag, `token: ${chalk.yellow(masked)}`);
      autoDel(); return;
    }

    // !help [cmd]
    if (['help','h','cmds','commands'].includes(cmd)) {
      const t = new Table({
        head: [chalk.cyan('Command'), chalk.cyan('Aliases'), chalk.cyan('Description')],
        style: { head: [], border: ['gray'] },
        colWidths: [22, 28, 36],
        wordWrap: true,
      });

      const rows = [
        // Voice
        ['', chalk.gray('── VOICE ──'), ''],
        ['!join',            'j  connect  vc',      'All bots join your VC'],
        ['!joinid <id>',     'ji  vcid',             'All bots join VC by ID'],
        ['!leave',           'l  dc  disconnect',    'All bots leave VC'],
        ['!moveall <id>',    'ma  move',             'Move all bots to another VC'],
        ['!copycat <n>',     'cc',                   'Only bot #N joins your VC'],
        ['!mute',            'selfmute',             'Self-mute all bots in VC'],
        ['!vcstatus',        'vs  vcinfo',           'Show VC status table'],
        // Presence
        ['', chalk.gray('── PRESENCE ──'), ''],
        ['!setstatus <s>',   'ss',                   'online/idle/dnd/invisible'],
        ['!setactivity <t>', 'sa  playing  setgame', 'Set "Playing ..." status'],
        ['!setstreaming <t>','stream',               'Set streaming status'],
        ['!setlistening <t>','listen',               'Set "Listening to ..."'],
        ['!setwatching <t>', 'watch',                'Set "Watching ..."'],
        ['!clearactivity',   'ca  noactivity',       'Clear activity on all bots'],
        // Chat
        ['', chalk.gray('── CHAT ──'), ''],
        ['!say <text>',      'echo',                 'Send a message (auto-deletes cmd)'],
        ['!purge <n>',       'clear  prune',         'Delete your last N messages'],
        ['!snipe',           'sn',                   'Show last deleted message'],
        ['!afk [reason]',    '',                     'Toggle AFK (auto-replies mentions)'],
        // Info
        ['', chalk.gray('── INFO ──'), ''],
        ['!ping',            'p  latency',           'Ping of all bots'],
        ['!uptime',          'up',                   'Uptime + stats per bot'],
        ['!stats',           'info  botinfo',        'Full stats dashboard'],
        ['!serverlist',      'sl  guilds',           'All servers list'],
        ['!serverinfo',      'si  guild',            'Current server info'],
        ['!userinfo [@u]',   'ui  whois',            'User info card'],
        ['!avatar [@u]',     'av  pfp',              'Get avatar URL'],
        ['!token',           'tokeninfo',            'Show your masked token'],
        // System
        ['', chalk.gray('── SYSTEM ──'), ''],
        ['!resetkicks',      'rk',                   'Reset kick counters'],
        ['!help',            'h  cmds  commands',    'Show this list'],
      ];

      rows.forEach(r => t.push(r));

      log.raw(
        `\n  ${chalk.magentaBright('thecrewx')} ${chalk.dim('·')} ${chalk.cyanBright('vishal babe')} ${chalk.dim('·')} ${chalk.yellow('v' + cfg.version)}\n` +
        t.toString() + '\n'
      );
      autoDel(); return;
    }

    // ── Per-bot individual command (e.g. !bot1, !bot2) ─────────────────────
    if (cmd === instance.command) {
      const vc = message.member?.voice?.channel;
      if (!vc || !message.guild) return;
      log.cmd(instance.tag, `!${instance.command} → "${vc.name}"`);
      try {
        await sleep(rand(50, 200));
        await instance.joinChannel(message.guild.id, vc.id);
        instance.armKeepalive();
      } catch (e) {
        log.error(instance.tag, `individual join failed: ${e?.message}`);
      }
      autoDel();
    }
  });
}

module.exports = { registerCommands };
