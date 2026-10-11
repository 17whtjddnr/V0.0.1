export const MAX_GUILD_MEMBERS = 4;

export function guildMemberCount(state) {
    return (state.guildMembers || []).filter((member) => !member.guildCapacityExempt).length;
}

export function resetTemporaryGuildRoster(state) {
    if (state.guildRosterResetVersion === 1) return;
    state.guildMembers = [];
    state.guildSecretaryId = null;
    state.guildRosterResetVersion = 1;
}
