'use strict';

const { spawn } = require('child_process');

const CFG = {
  MAX_RESTARTS:      100,
  RESTART_DELAY_MS:  5000,
  CRASH_WINDOW_MS:   15000,
  MAX_RAPID_CRASHES: 5,
  COOLDOWN_MS:       90000,
  FATAL_CODES:       [1],
};

let restarts    = 0;
let rapidCrash  = 0;
let lastCrashAt = 0;

const ts  = () => new Date().toLocaleTimeString();
const pad = (s, w) => { const r = s.replace(/\x1B\[[0-9;]*m/g, ''); return s + ' '.repeat(Math.max(0, w - r.length)); };

const box = lines => {
  const W = 60;
  console.log(`\n╔${'═'.repeat(W)}╗`);
  lines.forEach(l => console.log(`║  ${pad(l, W - 2)}║`));
  console.log(`╚${'═'.repeat(W)}╝\n`);
};

function start() {
  restarts++;
  box([
    '  ⚡  VC SELFBOT  —  24/7',
    '',
    `  instance   #${restarts}`,
    `  started    ${ts()}`,
    `  crashes    ${rapidCrash}`,
    '',
    '  thecrewx  ·  vishal babe  ·  v0.0.67',
  ]);

  const child    = spawn('node', ['src/index.js'], { cwd: __dirname, stdio: 'inherit', env: { ...process.env, FORCE_COLOR: '1' } });
  const bootTime = Date.now();

  child.on('exit', (code, signal) => {
    const runtime = Math.round((Date.now() - bootTime) / 1000);
    const now     = Date.now();
    console.log(`\n[${ts()}]  exit  code=${code}  signal=${signal}  runtime=${runtime}s`);

    if (CFG.FATAL_CODES.includes(code)) {
      console.log(`[${ts()}]  fatal exit — fix .env and retry`);
      process.exit(1);
    }

    rapidCrash  = (now - lastCrashAt < CFG.CRASH_WINDOW_MS) ? rapidCrash + 1 : 1;
    lastCrashAt = now;

    if (restarts >= CFG.MAX_RESTARTS) { console.log(`[${ts()}]  max restarts reached`); process.exit(1); }

    if (rapidCrash >= CFG.MAX_RAPID_CRASHES) {
      console.log(`[${ts()}]  ${rapidCrash} rapid crashes — cooldown ${CFG.COOLDOWN_MS / 1000}s`);
      rapidCrash = 0;
      return setTimeout(start, CFG.COOLDOWN_MS);
    }

    console.log(`[${ts()}]  restart in ${CFG.RESTART_DELAY_MS / 1000}s`);
    setTimeout(start, CFG.RESTART_DELAY_MS);
  });

  child.on('error', e => { console.error(`[${ts()}]  spawn error  ${e.message}`); setTimeout(start, CFG.RESTART_DELAY_MS); });
}

process.on('SIGINT',  () => { console.log(`\n[${ts()}]  stopped`); process.exit(0); });
process.on('SIGTERM', () => { console.log(`\n[${ts()}]  stopped`); process.exit(0); });

start();
