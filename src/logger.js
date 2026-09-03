'use strict';
// ═══════════════════════════════════════════════════════════════════════════════
//   LOGGER — Colored console + optional file output
//   vc-selfbot v0.0.67 | made by thecrewx for vishal babe
// ═══════════════════════════════════════════════════════════════════════════════

const chalk   = require('chalk');
const moment  = require('moment');
const fs      = require('fs');
const path    = require('path');

const LOG_TO_FILE = process.env.LOG_TO_FILE === 'true';
const LOG_FILE    = path.resolve(process.env.LOG_FILE || 'logs/bot.log');

if (LOG_TO_FILE) {
  const dir = path.dirname(LOG_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function ts() { return moment().format('HH:mm:ss'); }

function strip(s) { return s.replace(/\x1B\[[0-9;]*m/g, ''); }

function write(line) {
  if (!LOG_TO_FILE) return;
  try { fs.appendFileSync(LOG_FILE, strip(line) + '\n'); } catch {}
}

function tag(label, color) {
  return chalk[color](`[${label}]`);
}

const log = {
  info:    (t, msg) => { const l = `${chalk.gray(ts())} ${tag(t,'cyan')}    ${msg}`;                          console.log(l);   write(l); },
  success: (t, msg) => { const l = `${chalk.gray(ts())} ${tag(t,'green')}  ${chalk.green(msg)}`;             console.log(l);   write(l); },
  warn:    (t, msg) => { const l = `${chalk.gray(ts())} ${tag(t,'yellow')} ${chalk.yellow(msg)}`;            console.warn(l);  write(l); },
  error:   (t, msg) => { const l = `${chalk.gray(ts())} ${tag(t,'red')}    ${chalk.red(msg)}`;               console.error(l); write(l); },
  voice:   (t, msg) => { const l = `${chalk.gray(ts())} ${tag(t,'magenta')}${chalk.magenta(' ' + msg)}`;    console.log(l);   write(l); },
  cmd:     (t, msg) => { const l = `${chalk.gray(ts())} ${tag(t,'blue')}   ${chalk.blue(msg)}`;              console.log(l);   write(l); },
  system:  (msg)    => { const l = `${chalk.gray(ts())} ${chalk.bgBlue.white(' SYS ')} ${chalk.blue(msg)}`; console.log(l);   write(l); },
  raw:     (msg)    => { console.log(msg); write(msg); },
};

module.exports = log;
