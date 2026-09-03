'use strict';
// ═══════════════════════════════════════════════════════════════════════════════
//   VC SELFBOT v0.0.67 — Entry Point
//   made by thecrewx  •  for vishal babe
// ═══════════════════════════════════════════════════════════════════════════════

const cfg                  = require('./config');
const log                  = require('./logger');
const { printBanner }      = require('./banner');
const BotInstance          = require('./bot');
const { registerCommands } = require('./commands');

const rand  = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const sleep = ms     => new Promise(r => setTimeout(r, ms));

// Print startup banner
printBanner();

// Create instances
const instances = cfg.tokens.map((token, i) => new BotInstance(token, cfg.commands[i], i));

// Register commands on every instance (each sees all instances)
for (const inst of instances) {
  registerCommands(inst, instances);
}

// Staggered login — avoids simultaneous login rate-limits
(async () => {
  log.system(`Logging in ${instances.length} bot(s)...`);
  for (let i = 0; i < instances.length; i++) {
    if (i > 0) await sleep(rand(800, 2000));
    instances[i].login();
  }
})();

// ── Graceful shutdown ──────────────────────────────────────────────────────────
function shutdown(sig) {
  log.system(`${sig} received — shutting down...`);
  for (const inst of instances) {
    try { inst.destroy(); } catch {}
  }
  setTimeout(() => process.exit(0), 1500);
}

process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// ── Global error guards — keep the process alive ───────────────────────────────
const IGNORE = ['WebSocket was closed before', 'Connection not established', 'read ECONNRESET'];

process.on('unhandledRejection', e => {
  const msg = e?.message || String(e);
  if (IGNORE.some(s => msg.includes(s))) return;
  log.error('PROCESS', `unhandledRejection: ${msg}`);
});

process.on('uncaughtException', e => {
  const msg = e?.message || String(e);
  if (IGNORE.some(s => msg.includes(s))) return;
  log.error('PROCESS', `uncaughtException: ${msg}`);
  // intentionally no process.exit — let the selfbot keep running
});
