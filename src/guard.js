'use strict';

const chalk = require('chalk');
const log   = require('./logger');
const cfg   = require('./config');

const guardLog = new Map();

const logGuard = (userId, tag, action) => {
  if (!guardLog.has(userId)) guardLog.set(userId, []);
  guardLog.get(userId).push({ tag, action, at: new Date() });
};

function setupGuard(instance, all) {
  if (!cfg.guardEnabled) return;

  const { client } = instance;

  client.on('voiceStateUpdate', async (oldState, newState) => {
    const userId = newState.member?.id;
    if (!userId) return;

    const isSelfBot = all.some(i => i.client.user?.id === userId);
    if (isSelfBot) return;

    const isOwner = cfg.ownerIds.includes(userId);
    if (isOwner) return;

    const isWhitelisted = cfg.guardWhitelist.includes(userId);
    if (isWhitelisted) return;

    const targetVcId   = cfg.guardVcId   || all.find(i => i.lastVcId)?.lastVcId;
    const targetGuildId = cfg.guardGuildId || all.find(i => i.lastGuildId)?.lastGuildId;

    if (!targetVcId || !targetGuildId) return;

    const joinedTarget = newState.channelId === targetVcId && !oldState.channelId;
    const movedTarget  = newState.channelId === targetVcId && oldState.channelId && oldState.channelId !== targetVcId;

    if (!joinedTarget && !movedTarget) return;

    const tag    = newState.member?.user?.tag || userId;
    const action = joinedTarget ? 'joined' : 'moved into';

    log.warn('GUARD', `${tag}  ${action}  protected vc  →  removing`);
    logGuard(userId, tag, action);

    try {
      const guild  = newState.guild;
      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) return;

      if (cfg.guardDumpVcId) {
        await member.voice.setChannel(cfg.guardDumpVcId).catch(() => {});
        log.warn('GUARD', `${tag}  moved  →  dump vc  ${cfg.guardDumpVcId}`);
      } else {
        await member.voice.disconnect().catch(() => {});
        log.warn('GUARD', `${tag}  disconnected`);
      }

      if (cfg.guardMsg) {
        newState.channel?.send(`<@${userId}>  ❌  you are not allowed in this voice channel`).catch(() => {});
      }

    } catch (e) {
      log.error('GUARD', `failed to remove ${tag}  —  ${e?.message}`);
    }
  });

  log.system(`guard active  →  vc ${cfg.guardVcId || 'dynamic'}  |  dump ${cfg.guardDumpVcId || 'disconnect'}`);
}

function getGuardLog() {
  return guardLog;
}

module.exports = { setupGuard, getGuardLog };
