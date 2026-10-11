import { applyRosterProfile } from './roster-generation.mjs';

const ailinId = 'CHAR-208';
const testStats = { attack: 9999, defense: 9999, maxHp: 9999, speed: 9999 };

export function normalAilinTestRecord(member) {
    if (member?.id !== ailinId || !member.testOriginalStats) return member;
    const original = member.testOriginalStats;
    const restored = { ...member, stats: { ...original.stats }, baseStats: { ...original.baseStats }, maxHp: original.maxHp,
        hp: member.hp <= 0 ? 0 : Math.max(1, Math.min(original.maxHp, Math.round(original.maxHp * member.hp / Math.max(1, member.maxHp)))) };
    delete restored.testOriginalStats;
    return restored;
}

export function syncAilinTestMode(state, party, enabled, growthRows, skills = []) {
    const members = [...(state.guildMembers || []), ...(state.recruits || []), ...party,
        state.tutorial?.companion, ...(state.plazaOffers || []), state.plazaCurrentOffer].filter(Boolean);
    for (const member of new Set(members)) {
        if (member.id !== ailinId) continue;
        let original = member.testOriginalStats;
        if (original && (original.level !== member.level || original.zodiac !== member.zodiac)) {
            const profile = applyRosterProfile(member, { level: member.level, zodiac: member.zodiac }, growthRows, skills);
            original = member.testOriginalStats = { stats: { ...profile.stats }, baseStats: { ...profile.stats },
                maxHp: profile.stats.maxHp, level: member.level, zodiac: member.zodiac };
        }
        if (!enabled) {
            if (original) Object.assign(member, normalAilinTestRecord(member));
            delete member.testOriginalStats;
            continue;
        }
        if (!original) member.testOriginalStats = { stats: { ...member.stats }, baseStats: { ...(member.baseStats || member.stats) },
            maxHp: member.maxHp || member.stats.maxHp, level: member.level, zodiac: member.zodiac };
        const previousMax = Math.max(1, member.maxHp || member.stats.maxHp);
        if (previousMax !== 9999 && member.hp != null) member.hp = member.hp <= 0 ? 0 : Math.max(1, Math.min(9999, Math.round(9999 * member.hp / previousMax)));
        member.stats = { ...member.stats, ...testStats };
        member.baseStats = { ...(member.baseStats || member.stats), ...testStats };
        member.maxHp = 9999;
    }
}
