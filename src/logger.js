'use strict';

const chalk  = require('chalk');
const moment = require('moment');
const fs     = require('fs');
const path   = require('path');

const TO_FILE = process.env.LOG_TO_FILE === 'true';
const FILE    = path.resolve(process.env.LOG_FILE || 'logs/bot.log');

if (TO_FILE) {
  const dir = path.dirname(FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const strip = s  => s.replace(/\x1B\[[0-9;]*m/g, '');
const ts    = () => chalk.gray(moment().format('HH:mm:ss'));
const sink  = l  => { if (TO_FILE) try { fs.appendFileSync(FILE, strip(l) + '\n'); } catch {} };
const emit  = (l, fn) => { fn(l); sink(l); };

const line = (icon, col, tag, msg, msgCol) =>
  `${ts()}  ${icon}  ${chalk[col](`[${tag}]`).padEnd(28)}  ${msgCol ? chalk[msgCol](msg) : chalk.white(msg)}`;

const log = {
  info    : (t, m) => emit(line('·', 'cyan',    t, m),          l => console.log(l)),
  success : (t, m) => emit(line('✓', 'green',   t, m, 'green'), l => console.log(l)),
  warn    : (t, m) => emit(line('!', 'yellow',  t, m, 'yellow'),l => console.warn(l)),
  error   : (t, m) => emit(line('✗', 'red',     t, m, 'red'),   l => console.error(l)),
  voice   : (t, m) => emit(line('♪', 'magenta', t, m, 'magenta'),l => console.log(l)),
  cmd     : (t, m) => emit(line('›', 'blue',    t, m, 'blue'),  l => console.log(l)),

  system : m => {
    const l = `${ts()}  ${chalk.bgMagenta.black(' SYSTEM ')}  ${chalk.magenta(m)}`;
    emit(l, l => console.log(l));
  },

  raw : m => { console.log(m); sink(m); },

  div : () => {
    const l = chalk.gray('  ' + '─'.repeat(64));
    console.log(l); sink(l);
  },

  blank : () => { console.log(); sink(''); },
};

module.exports = log;
