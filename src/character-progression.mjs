import { applyRosterProfile } from './roster-generation.mjs';
import { initializeExperience, advanceExperienceAtWeekStart, experienceRequired } from './experience-progression.mjs';

export const recruitmentBasePrices = Object.freeze({ 3: 30, 4: 55, 5: 85 });

export function recruitmentTerms(character) {
    if (character.wageExempt) return { price: 0, weeklyWage: 0 };
    const amount = (recruitmentBasePrices[character.grade] ?? 30) * Math.max(1, Math.floor(Number(character.level) || 1));
    return { price: amount, weeklyWage: amount };
}

export function encounterLevel(playerLevel, random = Math.random) {
    const maximum = Math.max(1, Math.floor(Number(playerLevel) || 1));
    return Math.min(maximum, 1 + Math.floor(Math.max(0, random()) * maximum));
}

function progressionSources(state, party = []) {
    // Guild records own permanent progression; battle copies own temporary mercenaries.
    const sources = new Map();
    for (const member of [state.tutorial?.companion, ...(state.recruits || []), ...party, ...(state.guildMembers || [])].filter(Boolean)) sources.set(member.id, member);
    return sources;
}

function applyCharacterLevel(member, level, zodiac, growthRows, skills) {
    const previousMaxHp = Math.max(1, Number(member.maxHp ?? member.stats?.maxHp) || 1);
    const previousHp = member.hp == null ? previousMaxHp : Number(member.hp);
    const profile = applyRosterProfile(member, { level, zodiac }, growthRows, skills);
    Object.assign(member, { level, zodiac, growthStateId: profile.growthStateId,
        stats: { ...profile.stats }, baseStats: { ...profile.stats }, maxHp: profile.stats.maxHp });
    member.hp = previousHp <= 0 ? 0 : Math.max(1, Math.min(member.maxHp, Math.round(member.maxHp * previousHp / previousMaxHp)));
}

export function awardCharacterExperience(state, party, amount) {
    const sources = progressionSources(state, party);
    for (const id of new Set(party.map(member => member.id))) {
        const source = sources.get(id);
        initializeExperience(source);
        source.experience += Math.max(0, Number(amount) || 0);
        if (source.level >= Math.max(1, Number(state.userLevel) || 1)) {
            source.experience = Math.min(source.experience, source.experienceToNextLevel);
        }
    }
}

export function levelUpCharactersAtWeekStart(state, party, growthRows, skills = []) {
    syncGuildProgression(state, party, growthRows, skills);
    for (const member of progressionSources(state, party).values()) {
        if (member.level < Math.max(1, Number(state.userLevel) || 1) && advanceExperienceAtWeekStart(member)) {
            applyCharacterLevel(member, member.level, member.isMaster ? state.playerZodiac || member.zodiac : member.zodiac, growthRows, skills);
        }
    }
    syncGuildProgression(state, party, growthRows, skills);
}

export function syncGuildProgression(state, party, growthRows, skills = []) {
    const guild = new Map((state.guildMembers || []).map((member) => [member.id, member]));
    const sources = progressionSources(state, party);
    for (const member of sources.values()) initializeExperience(member);
    // Freeze existing saves at their stored wage, before changing their level.
    for (const member of guild.values()) {
        member.contractWeeklyWage = member.wageExempt ? 0
            : member.contractWeeklyWage ?? member.weeklyWage ?? member.price ?? recruitmentTerms(member).weeklyWage;
        member.weeklyWage = member.contractWeeklyWage;
    }
    const playerLevel = Math.max(1, Math.floor(Number(state.userLevel) || 1));
    for (const source of sources.values()) {
        if (source.level > playerLevel) {
            applyCharacterLevel(source, playerLevel, source.isMaster ? state.playerZodiac || source.zodiac : source.zodiac, growthRows, skills);
            source.experienceToNextLevel = experienceRequired(playerLevel);
        }
        if (source.level >= playerLevel) source.experience = Math.min(source.experience, source.experienceToNextLevel);
    }
    const references = [...guild.values(), ...(state.recruits || []), ...party, state.tutorial?.companion].filter(Boolean);
    for (const member of new Set(references)) {
        const contract = guild.get(member.id);
        const source = sources.get(member.id);
        const level = Math.max(1, Math.floor(Number(source.level) || 1));
        const zodiac = member.isMaster ? state.playerZodiac || source.zodiac : source.zodiac;
        if (Number(member.level) !== level || member.zodiac !== zodiac) {
            applyCharacterLevel(member, level, zodiac, growthRows, skills);
        }
        member.experience = source.experience;
        member.experienceToNextLevel = source.experienceToNextLevel;
        if (contract) {
            member.isGuildMember = true;
            member.contractWeeklyWage = contract.contractWeeklyWage;
            member.weeklyWage = contract.contractWeeklyWage;
        }
    }
}
