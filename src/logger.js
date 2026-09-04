'use strict';

const chalk  = require('chalk');
const moment = require('moment');
const fs     = require('fs');
const path   = require('path');

const TO_FILE = process.env.LOG_TO_FILE === 'true';
const FILE    = path.resolve(process.env.LOG_FILE || 'logs/bot.log');

if (TO_FILE) {
  const d = path.dirname(FILE);
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

const strip = s => s.replace(/\x1B\[[0-9;]*m/g, '');
const ts    = () => chalk.gray(moment().format('HH:mm:ss'));
const write = l  => { if (TO_FILE) try { fs.appendFileSync(FILE, strip(l) + '\n'); } catch {} };

const fmt = (icon, tagColor, tag, msgColor, msg) => {
  const l = `${ts()} ${icon} ${chalk[tagColor](`[${tag}]`)} ${msgColor ? chalk[msgColor](msg) : msg}`;
  return l;
};

const log = {
  info:    (t, m) => { const l = fmt('·', 'cyan',    t, null,      m); console.log(l);   write(l); },
  success: (t, m) => { const l = fmt('✓', 'green',   t, 'green',   m); console.log(l);   write(l); },
  warn:    (t, m) => { const l = fmt('!', 'yellow',  t, 'yellow',  m); console.warn(l);  write(l); },
  error:   (t, m) => { const l = fmt('✗', 'red',     t, 'red',     m); console.error(l); write(l); },
  voice:   (t, m) => { const l = fmt('♪', 'magenta', t, 'magenta', m); console.log(l);   write(l); },
  cmd:     (t, m) => { const l = fmt('›', 'blue',    t, 'blue',    m); console.log(l);   write(l); },
  system:  (m)    => {
    const l = `${ts()} ${chalk.bgMagenta.black(' vc-selfbot ')} ${chalk.magenta(m)}`;
    console.log(l); write(l);
  },
  raw: m => { console.log(m); write(m); },
  div: () => {
    const l = chalk.gray('  ' + '─'.repeat(62));
    console.log(l); write(l);
  },
};

module.exports = log;
