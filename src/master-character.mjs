import { applyRosterProfile } from './roster-generation.mjs';

export const MASTER_CHARACTER_ID = 'CHAR-246';

export function createMasterCharacter(profile, zodiac, growthRows, level = 1) {
    const master = applyRosterProfile(profile, { zodiac, level }, growthRows);
    const stats = { ...master.stats };
    return {
        ...master, stats, baseStats: { ...stats }, hp: stats.maxHp, maxHp: stats.maxHp,
        isMaster: true, isGuildMember: true, guildCapacityExempt: true,
        wageExempt: true, price: 0, weeklyWage: 0, cooldowns: {}, effects: [],
    };
}

export function selectMasterForExpedition(state) {
    const master = state.guildMembers?.find((member) => member.id === MASTER_CHARACTER_ID && member.isMaster);
    if (!master) return false;
    const stats = { ...master.stats };
    const selected = { ...master, stats, baseStats: { ...stats }, hp: stats.maxHp, maxHp: stats.maxHp, effects: [], cooldowns: {} };
    state.recruits = [selected, ...(state.recruits || []).filter((member) => member.id !== master.id)];
    return true;
}

export function showPartySwap(tutorial, member, normalParty) {
    return (!tutorial?.stage || tutorial.stage === 'done') && (!normalParty || member.isGuildMember);
}
