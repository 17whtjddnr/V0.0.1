import { activeGuildDispatch } from './guild-dispatch.mjs';

export function canSelectPlazaGuildMember(state, memberId, maxMembers = 4) {
    return (state.recruits || []).length < maxMembers
        && (state.guildMembers || []).some((member) => member.id === memberId)
        && !(state.recruits || []).some((member) => member.id === memberId)
        && !activeGuildDispatch(state, memberId)
        && !(state.guildDispatchMemberIds || []).includes(memberId);
}

export function hasAvailablePlazaGuildMember(state, maxMembers = 4) {
    return (state.guildMembers || []).some((member) => canSelectPlazaGuildMember(state, member.id, maxMembers));
}

export function togglePlazaGuildMember(state, memberId, maxMembers = 4) {
    const member = (state.guildMembers || []).find((entry) => entry.id === memberId);
    if (!member) return false;
    state.recruits ||= [];
    const index = state.recruits.findIndex((entry) => entry.id === memberId);
    if (index >= 0) {
        if (!state.recruits[index].isGuildMember) return false;
        state.recruits.splice(index, 1);
        return true;
    }
    if (!canSelectPlazaGuildMember(state, memberId, maxMembers)) return false;
    const stats = { ...member.stats };
    state.recruits.push({ ...member, isGuildMember: true, stats, baseStats: { ...stats }, hp: stats.maxHp, maxHp: stats.maxHp, effects: [], cooldowns: {} });
    return true;
}
