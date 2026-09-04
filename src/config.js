'use strict';

require('dotenv').config();

const req = key => {
  const v = process.env[key];
  if (!v?.trim()) {
    process.stderr.write(`\n  ✗  ${key} is required — edit your .env file\n\n`);
    process.exit(1);
  }
  return v.trim();
};

const opt     = (k, fb = '')    => (process.env[k] || fb).toString().trim();
const optBool = (k, fb = false) => process.env[k] ? process.env[k].trim().toLowerCase() === 'true' : fb;
const optInt  = (k, fb)         => { const v = parseInt(process.env[k], 10); return isNaN(v) ? fb : v; };

const tokens   = req('TOKENS').split(',').map(t => t.trim()).filter(Boolean);
const commands = req('COMMANDS').split(',').map(c => c.trim().toLowerCase()).filter(Boolean);
const ownerIds = req('OWNER_ID').split(',').map(s => s.trim()).filter(Boolean);

if (tokens.length !== commands.length) {
  process.stderr.write(`\n  ✗  TOKENS (${tokens.length}) and COMMANDS (${commands.length}) must have the same count\n\n`);
  process.exit(1);
}

if (ownerIds.some(id => !/^\d{15,21}$/.test(id))) {
  process.stderr.write(`\n  ✗  OWNER_ID must be a valid Discord user ID\n\n`);
  process.exit(1);
}

module.exports = {
  version:  '0.0.67',
  author:   'thecrewx',
  dedic:    'vishal babe',

  tokens,
  commands,
  ownerIds,
  prefix:          opt('PREFIX', '!'),
  autoJoinGuildId: opt('AUTO_JOIN_GUILD_ID'),
  autoJoinVcId:    opt('AUTO_JOIN_VC_ID'),
  status:          opt('STATUS', 'online'),
  activityText:    opt('ACTIVITY_TEXT'),
  activityType:    opt('ACTIVITY_TYPE', 'PLAYING'),
  keepaliveMs:     optInt('KEEPALIVE_MS', 12000),
  joinDelayMs:     optInt('JOIN_DELAY_MS', 1200),
  deleteCommands:  optBool('DELETE_COMMANDS', false),
  deleteDelayMs:   optInt('DELETE_DELAY_MS', 3000),
  afkReply:        opt('AFK_REPLY', '💤 AFK — brb'),
  logToFile:       optBool('LOG_TO_FILE', false),
  logFile:         opt('LOG_FILE', 'logs/bot.log'),

  guardEnabled:    optBool('GUARD_ENABLED', false),
  guardVcId:       opt('GUARD_VC_ID'),
  guardGuildId:    opt('GUARD_GUILD_ID'),
  guardDumpVcId:   opt('GUARD_DUMP_VC_ID'),
  guardWhitelist:  opt('GUARD_WHITELIST').split(',').map(s => s.trim()).filter(Boolean),
  guardMsg:        optBool('GUARD_MSG', true),
};
