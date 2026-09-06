'use strict';

const { spawn } = require('child_process');

const MAX_RESTARTS   = 100;
const RESTART_DELAY  = 5000;
const CRASH_WINDOW   = 15000;
const MAX_RAPID      = 5;
const COOLDOWN       = 90000;
const FATAL_CODES    = new Set([1]);

let restarts   = 0;
let rapid      = 0;
let lastCrash  = 0;

const ts    = () => new Date().toLocaleTimeString();
const strip = s => s.replace(/\x1B\[[0-9;]*m/g, '');

const box = lines => {
  const W = 62;
  const pad = s => { const l = strip(s).length; return s + ' '.repeat(Math.max(0, W - l - 2)); };
  console.log(`\n╔${'═'.repeat(W)}╗`);
  lines.forEach(l => console.log(`║  ${pad(l)}║`));
  console.log(`╚${'═'.repeat(W)}╝\n`);
};

function start() {
  restarts++;

  box([
    '  vc-selfbot  —  24/7',
    '',
    `  instance    #${restarts}`,
    `  started     ${ts()}`,
    `  crashes     ${rapid}`,
    '',
    '  thecrewx  ·  vishal babe  ·  v0.0.67',
  ]);

  const child    = spawn('node', ['src/index.js'], {
    cwd   : __dirname,
    stdio : 'inherit',
    env   : { ...process.env, FORCE_COLOR: '1' },
  });
  const boot = Date.now();

  child.on('exit', (code, signal) => {
    const runtime = Math.round((Date.now() - boot) / 1000);
    console.log(`\n[${ts()}]  exit  code=${code ?? 'null'}  signal=${signal ?? 'null'}  runtime=${runtime}s`);

    if (FATAL_CODES.has(code)) {
      console.log(`[${ts()}]  fatal — fix your .env and retry`);
      process.exit(1);
    }

    const now = Date.now();
    rapid      = (now - lastCrash < CRASH_WINDOW) ? rapid + 1 : 1;
    lastCrash  = now;

    if (restarts >= MAX_RESTARTS) {
      console.log(`[${ts()}]  max restarts (${MAX_RESTARTS}) reached`);
      process.exit(1);
    }

    if (rapid >= MAX_RAPID) {
      console.log(`[${ts()}]  ${rapid} rapid crashes  —  cooldown ${COOLDOWN / 1000}s`);
      rapid = 0;
      return setTimeout(start, COOLDOWN);
    }

    console.log(`[${ts()}]  restart in ${RESTART_DELAY / 1000}s`);
    setTimeout(start, RESTART_DELAY);
  });

  child.on('error', e => {
    console.error(`[${ts()}]  spawn error  ${e.message}`);
    setTimeout(start, RESTART_DELAY);
  });
}

process.on('SIGINT',  () => { console.log(`\n[${ts()}]  stopped`); process.exit(0); });
process.on('SIGTERM', () => { console.log(`\n[${ts()}]  stopped`); process.exit(0); });

start();
