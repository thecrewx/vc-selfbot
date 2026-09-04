'use strict';

const cfg                  = require('./config');
const log                  = require('./logger');
const { printBanner }      = require('./banner');
const BotInstance          = require('./bot');
const { registerCommands } = require('./commands');
const { setupGuard }       = require('./guard');

const rand  = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const sleep = ms     => new Promise(r => setTimeout(r, ms));

printBanner();

const instances = cfg.tokens.map((token, i) => new BotInstance(token, cfg.commands[i], i));

for (const inst of instances) {
  registerCommands(inst, instances);
  setupGuard(inst, instances);
}

(async () => {
  log.system(`starting ${instances.length} instance(s)`);
  log.div();
  for (let i = 0; i < instances.length; i++) {
    if (i > 0) await sleep(rand(800, 2000));
    instances[i].login();
  }
})();

const shutdown = sig => {
  log.system(`${sig}  —  shutting down`);
  instances.forEach(i => { try { i.destroy(); } catch {} });
  setTimeout(() => process.exit(0), 1500);
};

process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

const IGNORE = ['WebSocket was closed before', 'Connection not established', 'read ECONNRESET'];

process.on('unhandledRejection', e => {
  const m = e?.message || String(e);
  if (!IGNORE.some(s => m.includes(s))) log.error('process', `unhandledRejection  ${m}`);
});

process.on('uncaughtException', e => {
  const m = e?.message || String(e);
  if (!IGNORE.some(s => m.includes(s))) log.error('process', `uncaughtException  ${m}`);
});
