'use strict';

const log = require('./logger');
const cfg = require('./config');

// block log: userId → [{ tag, action, at }]
const blockLog = new Map();

const record = (userId, tag, action) => {
  if (!blockLog.has(userId)) blockLog.set(userId, []);
  blockLog.get(userId).push({ tag, action, at: new Date() });
};

// guard listener — registered once per instance, always active
// cfg.guardEnabled is checked at runtime so !guard on/off works instantly
function setupGuard(instance, all) {
  const { client } = instance;

  client.on('voiceStateUpdate', async (oldState, newState) => {
    if (!cfg.guardEnabled)            return;

    const userId = newState.member?.id;
    if (!userId)                      return;

    // never touch other selfbot accounts
    if (all.some(i => i.client.user?.id === userId)) return;

    // owners and whitelisted users pass freely
    if (cfg.ownerIds.includes(userId))        return;
    if (cfg.guardWhitelist.includes(userId))  return;

    // resolve which vc is being protected
    const targetVcId = cfg.guardVcId || all.find(i => i.lastVcId)?.lastVcId;
    if (!targetVcId)                          return;

    // only fire when user enters the protected vc
    const entered = newState.channelId === targetVcId && oldState.channelId !== targetVcId;
    if (!entered)                             return;

    const tag    = newState.member?.user?.tag ?? userId;
    const action = oldState.channelId ? 'moved into' : 'joined';

    log.warn('GUARD', `${tag}  ${action}  protected vc  →  removing`);
    record(userId, tag, action);

    try {
      const member = await newState.guild.members.fetch(userId).catch(() => null);
      if (!member?.voice?.channelId) return;

      if (cfg.guardDumpVcId) {
        await member.voice.setChannel(cfg.guardDumpVcId);
        log.warn('GUARD', `${tag}  →  dump vc`);
      } else {
        await member.voice.disconnect();
        log.warn('GUARD', `${tag}  →  disconnected`);
      }

      if (cfg.guardMsg) {
        newState.channel?.send(`<@${userId}>  you are not allowed in this voice channel`).catch(() => {});
      }
    } catch (e) {
      log.error('GUARD', `remove failed  ${tag}  —  ${e?.message}`);
    }
  });
}

const getBlockLog = () => blockLog;
const blockTotal  = () => [...blockLog.values()].reduce((n, v) => n + v.length, 0);

module.exports = { setupGuard, getBlockLog, blockTotal };
