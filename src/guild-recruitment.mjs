import { MAX_GUILD_MEMBERS } from './guild-roster.mjs';

export const guildRelationshipStages = [
    { label: '앙숙', max: 0, chance: 10 },
    { label: '데면데면한 사이', max: 10, chance: 30 },
    { label: '보통 사이', max: 20, chance: 50 },
    { label: '호감이 있는 사이', max: 50, chance: 70 },
    { label: '친밀한 사이', max: 90, chance: 90 },
    { label: '소울메이트', max: 100, chance: 100 },
];

export function guildRecruitmentRelationship(state, offer) {
    const affinity = Math.min(100, Math.max(0, Number(state.affinityByCharacterId?.[offer?.id] ?? offer?.affinity ?? 10) || 0));
    return guildRelationshipStages.find(stage => affinity <= stage.max);
}

export function guildRecruitmentWage(offer) {
    return Math.max(0, Number(offer?.weeklyWage ?? offer?.price) || 0);
}

export function canInviteGuildMember(state, offer = state.plazaCurrentOffer) {
    return !!offer && Number(state.userLevel) >= 2
        && (state.guildMembers || []).length < MAX_GUILD_MEMBERS
        && !(state.guildMembers || []).some(member => member.id === offer.id)
        && !(state.plazaGuildInvitedIds || []).includes(offer.id)
        && Number(state.gold) >= guildRecruitmentWage(offer);
}

export function recruitGuildMember(state, offer, random = Math.random) {
    if (!canInviteGuildMember(state, offer)) return null;
    const wage = guildRecruitmentWage(offer);
    const relationship = guildRecruitmentRelationship(state, offer);
    const success = random() * 100 < relationship.chance;
    state.plazaGuildInvitedIds ||= [];
    state.plazaGuildInvitedIds.push(offer.id);
    if (success) {
        state.gold -= wage;
        const stats = { ...offer.stats };
        const member = { ...offer, stats, baseStats: { ...stats }, isGuildMember: true,
            weeklyWage: wage, hp: stats.maxHp, maxHp: stats.maxHp, effects: [], cooldowns: {} };
        state.guildMembers ||= [];
        state.guildMembers.push(member);
        // Preserve a current party slot when its hired character becomes a guild member.
        const hired = (state.recruits || []).find(entry => entry.id === offer.id);
        if (hired) Object.assign(hired, { isGuildMember: true, weeklyWage: wage });
        state.plazaOffers = (state.plazaOffers || []).filter(entry => entry.id !== offer.id);
        if (state.plazaCurrentOffer?.id === offer.id) state.plazaCurrentOffer = null;
    }
    return { success, memberId: offer.id, name: offer.name, wage, chance: relationship.chance, relationship: relationship.label };
}

export function levelUpAtWeekStart(state) {
    const maximum = Math.max(1, Number(state.experienceToNextLevel) || 100);
    if ((Number(state.experience) || 0) < maximum) return null;
    const previousLevel = Math.max(1, Number(state.userLevel) || 1);
    state.userLevel = previousLevel + 1;
    state.experience = 0;
    state.experienceToNextLevel = maximum * 2;
    state.pendingLevelUp = { previousLevel, level: state.userLevel, maximumExperience: state.experienceToNextLevel };
    return state.pendingLevelUp;
}
