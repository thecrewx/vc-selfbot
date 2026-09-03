// ═══════════════════════════════════════════════════════════════════════════════
//   24/7 CRASH RECOVERY WRAPPER
//   vc-selfbot v0.0.67  |  made by thecrewx  •  for vishal babe
//   Run:  node start.js
// ═══════════════════════════════════════════════════════════════════════════════

const { spawn } = require('child_process');

const CFG = {
  MAX_RESTARTS:      100,
  RESTART_DELAY_MS:  5000,
  CRASH_WINDOW_MS:   15000,
  MAX_RAPID_CRASHES: 5,
  COOLDOWN_MS:       90000,
  FATAL_EXIT_CODES:  [1],
};

let restartCount    = 0;
let rapidCrashCount = 0;
let lastCrashTime   = 0;

const ts = () => new Date().toLocaleTimeString();

function box(lines) {
  const W      = 60;
  const border = '═'.repeat(W);
  console.log(`\n╔${border}╗`);
  for (const line of lines) {
    const stripped = line.replace(/\x1B\[[0-9;]*m/g, '');
    const pad = Math.max(0, W - stripped.length - 2);
    console.log(`║  ${line}${' '.repeat(pad)}║`);
  }
  console.log(`╚${border}╝\n`);
}

function start() {
  restartCount++;

  box([
    '⚡  VC SELFBOT  —  24/7 LAUNCHER',
    '─────────────────────────────────────────────────────',
    `🔄  Instance   #${restartCount}`,
    `🕐  Started    ${ts()}`,
    `💀  Crashes    ${rapidCrashCount}`,
    `🏷️  made by thecrewx  for vishal babe`,
    `📦  v0.0.67`,
  ]);

  const child = spawn('node', ['src/index.js'], {
    cwd:   __dirname,
    stdio: 'inherit',
    env:   { ...process.env, FORCE_COLOR: '1' },
  });

  const bootTime = Date.now();

  child.on('exit', (code, signal) => {
    const runtime = Math.round((Date.now() - bootTime) / 1000);
    const now     = Date.now();
    console.log(`\n[${ts()}] ⚡ Exited  code=${code}  signal=${signal}  runtime=${runtime}s`);

    if (CFG.FATAL_EXIT_CODES.includes(code)) {
      console.log(`[${ts()}] ❌ Fatal exit — fix your .env and retry.`);
      process.exit(1);
    }

    if (now - lastCrashTime < CFG.CRASH_WINDOW_MS) rapidCrashCount++;
    else rapidCrashCount = 1;
    lastCrashTime = now;

    if (restartCount >= CFG.MAX_RESTARTS) {
      console.log(`[${ts()}] ❌ Max restarts (${CFG.MAX_RESTARTS}) reached.`);
      process.exit(1);
    }

    if (rapidCrashCount >= CFG.MAX_RAPID_CRASHES) {
      console.log(`[${ts()}] ⚠️  ${rapidCrashCount} rapid crashes — cooling down ${CFG.COOLDOWN_MS / 1000}s...`);
      rapidCrashCount = 0;
      return setTimeout(start, CFG.COOLDOWN_MS);
    }

    console.log(`[${ts()}] 🔄 Restarting in ${CFG.RESTART_DELAY_MS / 1000}s...`);
    setTimeout(start, CFG.RESTART_DELAY_MS);
  });

  child.on('error', err => {
    console.error(`[${ts()}] ❌ Spawn failed: ${err.message}`);
    setTimeout(start, CFG.RESTART_DELAY_MS);
  });
}

process.on('SIGINT',  () => { console.log(`\n[${ts()}] 🛑 SIGINT — bye.`); process.exit(0); });
process.on('SIGTERM', () => { console.log(`\n[${ts()}] 🛑 SIGTERM — bye.`); process.exit(0); });

start();
