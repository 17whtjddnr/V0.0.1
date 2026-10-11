import { activeGuildDispatch, MAX_ACTIVE_GUILD_DISPATCHES } from './guild-dispatch.mjs';

export function retainRegularGuildSelection(state, party) {
    const guild = new Map((state.guildMembers || []).map(member => [member.id, member]));
    state.recruits = party.filter(member => guild.has(member.id)).map(member => {
        const current = guild.get(member.id);
        const stats = { ...current.stats };
        return { ...current, isGuildMember: true, stats, baseStats: { ...stats },
            hp: stats.maxHp, maxHp: stats.maxHp, effects: [], cooldowns: {} };
    });
}

export function guildSelectionConflict(state, memberId, target) {
    if (target === 'regular') return (state.guildDispatchMemberIds || []).includes(memberId);
    if (target === 'dispatch') return (state.recruits || []).some(member => member.id === memberId);
    return false;
}

export function canTransferGuildSelection(state, memberId, target, maxMembers = 4) {
    if (!(state.guildMembers || []).some(member => member.id === memberId) || activeGuildDispatch(state, memberId)) return false;
    if (!guildSelectionConflict(state, memberId, target)) return false;
    if (target === 'regular') return !(state.recruits || []).some(member => member.id === memberId)
        && (state.recruits || []).length < maxMembers;
    return (state.recruits || []).some(member => member.id === memberId && member.isGuildMember)
        && !(state.guildDispatchMemberIds || []).includes(memberId)
        && (state.guildDispatchMemberIds || []).length < maxMembers
        && (state.guildDispatches || []).filter(dispatch => dispatch.status === 'active').length < MAX_ACTIVE_GUILD_DISPATCHES;
}

// Only call after confirmation. Validate both parties before changing either selection.
export function transferGuildSelection(state, memberId, target, maxMembers = 4) {
    if (!canTransferGuildSelection(state, memberId, target, maxMembers)) return false;
    if (target === 'regular') {
        const next = { ...state, recruits: [...(state.recruits || [])], guildDispatchMemberIds: state.guildDispatchMemberIds.filter(id => id !== memberId) };
        if (!togglePlazaGuildMember(next, memberId, maxMembers)) return false;
        state.recruits = next.recruits;
        state.guildDispatchMemberIds = next.guildDispatchMemberIds;
    } else {
        state.recruits = state.recruits.filter(member => member.id !== memberId);
        state.guildDispatchMemberIds = [...(state.guildDispatchMemberIds || []), memberId];
    }
    return true;
}

export function canSelectPlazaGuildMember(state, memberId, maxMembers = 4) {
    return (state.recruits || []).length < maxMembers
        && (state.guildMembers || []).some((member) => member.id === memberId)
        && !(state.recruits || []).some((member) => member.id === memberId)
        && !activeGuildDispatch(state, memberId)
        && !(state.guildDispatchMemberIds || []).includes(memberId);
}

export function hasAvailablePlazaGuildMember(state, maxMembers = 4) {
    return (state.guildMembers || []).some((member) => canSelectPlazaGuildMember(state, member.id, maxMembers)
        || canTransferGuildSelection(state, member.id, 'regular', maxMembers));
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
    const selected = { ...member, isGuildMember: true, stats, baseStats: { ...stats }, hp: stats.maxHp, maxHp: stats.maxHp, effects: [], cooldowns: {} };
    if (member.isMaster) state.recruits.unshift(selected);
    else state.recruits.push(selected);
    return true;
}
