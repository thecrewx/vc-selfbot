'use strict';
// ═══════════════════════════════════════════════════════════════════════════════
//   BANNER — Startup UI
//   vc-selfbot v0.0.67 | made by thecrewx for vishal babe
// ═══════════════════════════════════════════════════════════════════════════════

const chalk    = require('chalk');
const figlet   = require('figlet');
const gradient = require('gradient-string');
const Table    = require('cli-table3');
const moment   = require('moment');
const cfg      = require('./config');

function printBanner() {
  console.clear();

  // ASCII art
  try {
    const art = figlet.textSync('VC  SELFBOT', { font: 'ANSI Shadow' });
    console.log(gradient.vice(art));
  } catch {
    console.log(chalk.magentaBright('\n  ⚡ VC SELFBOT\n'));
  }

  // Credits line
  console.log(
    chalk.gray('  ') +
    chalk.dim('made by ') + chalk.magentaBright('thecrewx') +
    chalk.dim(' for ') + chalk.cyanBright('vishal babe') +
    chalk.dim('  •  v') + chalk.yellow(cfg.version)
  );
  console.log(chalk.gray('  ' + '─'.repeat(58) + '\n'));

  // Config table
  const table = new Table({
    head: [chalk.cyan('Setting'), chalk.cyan('Value')],
    style: { head: [], border: ['gray'] },
    colWidths: [22, 40],
  });

  const autoJoin = cfg.autoJoinVcId
    ? chalk.green('✓ ') + cfg.autoJoinVcId
    : chalk.gray('disabled');

  const activity = cfg.activityText
    ? `${cfg.activityType}: ${cfg.activityText}`
    : chalk.gray('none');

  table.push(
    ['Tokens loaded',    chalk.greenBright(String(cfg.tokens.length))],
    ['Commands',         chalk.yellow(cfg.commands.map(c => cfg.prefix + c).join('  '))],
    ['Prefix',           chalk.white(cfg.prefix)],
    ['Owners',           chalk.white(cfg.ownerIds.length + ' user(s)')],
    ['Auto-join VC',     autoJoin],
    ['Status',           chalk.white(cfg.status)],
    ['Activity',         activity],
    ['Keepalive',        chalk.white(`${cfg.keepaliveMs / 1000}s interval`)],
    ['Join delay',       chalk.white(`${cfg.joinDelayMs}ms between bots`)],
    ['Delete commands',  cfg.deleteCommands ? chalk.green('yes') : chalk.gray('no')],
    ['AFK reply',        chalk.white(cfg.afkReply)],
    ['File logging',     cfg.logToFile ? chalk.green('yes → ' + cfg.logFile) : chalk.gray('no')],
    ['Started at',       chalk.white(moment().format('YYYY-MM-DD HH:mm:ss'))],
  );

  console.log(table.toString());
  console.log();
}

module.exports = { printBanner };
