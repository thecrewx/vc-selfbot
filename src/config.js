'use strict';
// ═══════════════════════════════════════════════════════════════════════════════
//   CONFIG — Loads and validates environment variables
//   vc-selfbot v0.0.67 | made by thecrewx for vishal babe
// ═══════════════════════════════════════════════════════════════════════════════

require('dotenv').config();

function required(key) {
  const val = process.env[key];
  if (!val || !val.trim()) {
    console.error(`\n❌  Missing required env var: ${key}`);
    console.error(`    Copy .env.example to .env and fill in your values.\n`);
    process.exit(1);
  }
  return val.trim();
}

function optional(key, fallback = '') {
  return (process.env[key] || fallback).toString().trim();
}

function optionalBool(key, fallback = false) {
  const v = process.env[key];
  if (!v) return fallback;
  return v.trim().toLowerCase() === 'true';
}

function optionalInt(key, fallback) {
  const v = parseInt(process.env[key], 10);
  return isNaN(v) ? fallback : v;
}

const tokens   = required('TOKENS').split(',').map(t => t.trim()).filter(Boolean);
const commands = required('COMMANDS').split(',').map(c => c.trim().toLowerCase()).filter(Boolean);
const ownerIds = required('OWNER_ID').split(',').map(s => s.trim()).filter(Boolean);

if (tokens.length !== commands.length) {
  console.error(`\n❌  TOKENS count (${tokens.length}) must match COMMANDS count (${commands.length}).`);
  console.error(`    Each token needs its own command name.\n`);
  process.exit(1);
}

if (ownerIds.includes('your_discord_user_id') || ownerIds.some(id => !/^\d{15,21}$/.test(id))) {
  console.error(`\n❌  OWNER_ID looks invalid. Set it to your real Discord user ID (numbers only).\n`);
  process.exit(1);
}

module.exports = {
  version:         '0.0.67',
  author:          'thecrewx',
  dedic:           'vishal babe',

  tokens,
  commands,
  ownerIds,
  prefix:          optional('PREFIX', '!'),

  // Auto-join
  autoJoinGuildId: optional('AUTO_JOIN_GUILD_ID'),
  autoJoinVcId:    optional('AUTO_JOIN_VC_ID'),

  // Presence
  status:          optional('STATUS', 'online'),
  activityText:    optional('ACTIVITY_TEXT'),
  activityType:    optional('ACTIVITY_TYPE', 'PLAYING'),

  // Timing
  keepaliveMs:     optionalInt('KEEPALIVE_MS', 12000),
  joinDelayMs:     optionalInt('JOIN_DELAY_MS', 1200),

  // Behaviour
  deleteCommands:  optionalBool('DELETE_COMMANDS', false),
  deleteDelayMs:   optionalInt('DELETE_DELAY_MS', 3000),
  afkReply:        optional('AFK_REPLY', '💤 AFK — brb'),

  // Logging
  logToFile:       optionalBool('LOG_TO_FILE', false),
  logFile:         optional('LOG_FILE', 'logs/bot.log'),
};
