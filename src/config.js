'use strict';

require('dotenv').config();

const _str  = (k, fb = '')    => (process.env[k] ?? fb).toString().trim();
const _bool = (k, fb = false) => process.env[k] != null ? process.env[k].trim().toLowerCase() === 'true' : fb;
const _int  = (k, fb)         => { const n = parseInt(process.env[k], 10); return Number.isFinite(n) ? n : fb; };
const _list = (k, fb = [])    => { const v = _str(k); return v ? v.split(',').map(s => s.trim()).filter(Boolean) : fb; };

const _require = k => {
  const v = _str(k);
  if (!v) { process.stderr.write(`\n  ✗  ${k} is required\n\n`); process.exit(1); }
  return v;
};

const tokens   = _list('TOKENS');
const commands = _list('COMMANDS').map(c => c.toLowerCase());
const ownerIds = _list('OWNER_ID');

if (!tokens.length)   { process.stderr.write('\n  ✗  TOKENS is required\n\n');   process.exit(1); }
if (!commands.length) { process.stderr.write('\n  ✗  COMMANDS is required\n\n'); process.exit(1); }
if (!ownerIds.length) { process.stderr.write('\n  ✗  OWNER_ID is required\n\n'); process.exit(1); }

if (tokens.length !== commands.length) {
  process.stderr.write(`\n  ✗  TOKENS (${tokens.length}) and COMMANDS (${commands.length}) count mismatch\n\n`);
  process.exit(1);
}

if (ownerIds.some(id => !/^\d{15,21}$/.test(id))) {
  process.stderr.write('\n  ✗  OWNER_ID contains an invalid Discord user ID\n\n');
  process.exit(1);
}

module.exports = {
  version : '0.0.67',
  author  : 'thecrewx',
  dedic   : 'vishal babe',

  tokens,
  commands,
  ownerIds,

  prefix          : _str ('PREFIX',           '!'),
  autoJoinGuildId : _str ('AUTO_JOIN_GUILD_ID'),
  autoJoinVcId    : _str ('AUTO_JOIN_VC_ID'),

  status          : _str ('STATUS',            'online'),
  activityText    : _str ('ACTIVITY_TEXT'),
  activityType    : _str ('ACTIVITY_TYPE',     'PLAYING'),

  keepaliveMs     : _int ('KEEPALIVE_MS',      12000),
  joinDelayMs     : _int ('JOIN_DELAY_MS',     1200),
  deleteCommands  : _bool('DELETE_COMMANDS',   false),
  deleteDelayMs   : _int ('DELETE_DELAY_MS',   3000),
  afkReply        : _str ('AFK_REPLY',         '💤 AFK — brb'),

  logToFile       : _bool('LOG_TO_FILE',       false),
  logFile         : _str ('LOG_FILE',          'logs/bot.log'),

  guardEnabled    : _bool('GUARD_ENABLED',     false),
  guardVcId       : _str ('GUARD_VC_ID'),
  guardGuildId    : _str ('GUARD_GUILD_ID'),
  guardDumpVcId   : _str ('GUARD_DUMP_VC_ID'),
  guardWhitelist  : _list('GUARD_WHITELIST'),
  guardMsg        : _bool('GUARD_MSG',         true),
};
