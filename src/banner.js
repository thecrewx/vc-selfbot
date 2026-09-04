'use strict';

const chalk    = require('chalk');
const figlet   = require('figlet');
const gradient = require('gradient-string');
const Table    = require('cli-table3');
const moment   = require('moment');
const cfg      = require('./config');

function printBanner() {
  console.clear();

  try {
    console.log(gradient.vice(figlet.textSync('VC  SELFBOT', { font: 'ANSI Shadow' })));
  } catch {
    console.log(chalk.magentaBright('\n  ⚡ VC SELFBOT\n'));
  }

  console.log(
    '  ' +
    chalk.gray('v' + cfg.version) + '  ' +
    chalk.dim('·') + '  ' +
    chalk.magentaBright('thecrewx') + '  ' +
    chalk.dim('·') + '  ' +
    chalk.cyanBright('vishal babe')
  );
  console.log(chalk.gray('  ' + '─'.repeat(62) + '\n'));

  const t = new Table({
    style: { head: [], border: ['gray'], compact: true },
    colWidths: [24, 42],
  });

  t.push(
    [chalk.gray('tokens'),        chalk.greenBright(`${cfg.tokens.length} loaded`)],
    [chalk.gray('commands'),      chalk.yellow(cfg.commands.map(c => cfg.prefix + c).join('  '))],
    [chalk.gray('prefix'),        chalk.white(cfg.prefix)],
    [chalk.gray('owners'),        chalk.white(cfg.ownerIds.length + ' user(s)')],
    [chalk.gray('auto-join'),     cfg.autoJoinVcId ? chalk.green('✓  ' + cfg.autoJoinVcId) : chalk.gray('disabled')],
    [chalk.gray('status'),        chalk.white(cfg.status)],
    [chalk.gray('activity'),      cfg.activityText ? chalk.white(`${cfg.activityType}  ${cfg.activityText}`) : chalk.gray('none')],
    [chalk.gray('keepalive'),     chalk.white(`${cfg.keepaliveMs / 1000}s`)],
    [chalk.gray('join delay'),    chalk.white(`${cfg.joinDelayMs}ms`)],
    [chalk.gray('delete cmds'),   cfg.deleteCommands ? chalk.green('on') : chalk.gray('off')],
    [chalk.gray('file logging'),  cfg.logToFile ? chalk.green('on  →  ' + cfg.logFile) : chalk.gray('off')],
    [chalk.gray('started'),       chalk.white(moment().format('YYYY-MM-DD  HH:mm:ss'))],
  );

  console.log(t.toString() + '\n');
}

module.exports = { printBanner };
