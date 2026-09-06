'use strict';

const chalk    = require('chalk');
const figlet   = require('figlet');
const gradient = require('gradient-string');
const Table    = require('cli-table3');
const moment   = require('moment');
const cfg      = require('./config');

const row = (k, v) => [chalk.gray(k), v];

function printBanner() {
  console.clear();

  try {
    console.log(gradient.vice(figlet.textSync('VC-SELFBOT', { font: 'ANSI Shadow' })));
  } catch {
    console.log(chalk.magentaBright('\n  vc-selfbot\n'));
  }

  console.log(
    '  ' +
    chalk.magentaBright('thecrewx') +
    chalk.gray('  ·  ') +
    chalk.cyanBright('vishal babe') +
    chalk.gray('  ·  ') +
    chalk.yellow('v' + cfg.version)
  );
  console.log(chalk.gray('  ' + '─'.repeat(64)));
  console.log();

  const t = new Table({
    style   : { head: [], border: ['gray'], compact: true },
    colWidths: [22, 46],
  });

  const guardVal = cfg.guardEnabled
    ? chalk.green('✓  enabled') + chalk.gray(cfg.guardVcId ? '  →  ' + cfg.guardVcId : '  (dynamic)')
    : chalk.gray('disabled');

  t.push(
    row('tokens',       chalk.greenBright(cfg.tokens.length + ' loaded')),
    row('commands',     chalk.yellow(cfg.commands.map(c => cfg.prefix + c).join('  '))),
    row('prefix',       chalk.white(cfg.prefix)),
    row('owners',       chalk.white(cfg.ownerIds.length + ' user(s)')),
    row('auto-join',    cfg.autoJoinVcId
      ? chalk.green('✓  ') + chalk.white(cfg.autoJoinVcId)
      : chalk.gray('disabled')),
    row('guard',        guardVal),
    row('status',       chalk.white(cfg.status)),
    row('activity',     cfg.activityText
      ? chalk.white(cfg.activityType.toLowerCase() + '  ' + cfg.activityText)
      : chalk.gray('none')),
    row('keepalive',    chalk.white(cfg.keepaliveMs / 1000 + 's')),
    row('join delay',   chalk.white(cfg.joinDelayMs + 'ms')),
    row('delete cmds',  cfg.deleteCommands ? chalk.green('on') : chalk.gray('off')),
    row('file logging', cfg.logToFile
      ? chalk.green('on  →  ') + chalk.white(cfg.logFile)
      : chalk.gray('off')),
    row('started',      chalk.white(moment().format('YYYY-MM-DD  HH:mm:ss'))),
  );

  console.log(t.toString());
  console.log();
}

module.exports = { printBanner };
