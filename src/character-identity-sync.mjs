import { characterIdentity } from './character-identity.mjs';
import { applyRosterProfile } from './roster-generation.mjs';

export function syncCharacterIdentities(state, party, growthRows, skills = [], resolve = entry => entry) {
    const references = [...(state.guildMembers || []), ...(state.recruits || []), ...party,
        ...(state.plazaOffers || []), state.plazaCurrentOffer,
        ...(state.guildDispatches || []).flatMap(dispatch => dispatch.members || [])].filter(Boolean);
    for (const member of new Set(references)) {
        const resolved = resolve(member);
        const original = characterIdentity(resolved);
        const identity = resolved === member ? original : { ...original, name: resolved.name, job: resolved.job, gender: resolved.gender };
        if (!identity || member.name === identity.name && member.job === identity.job && member.gender === identity.gender) continue;
        if (member.job === identity.job) {
            Object.assign(member, identity);
            continue;
        }
        const previousMaxHp = Math.max(1, member.maxHp ?? member.stats.maxHp);
        const ratio = member.hp == null ? 1 : Math.max(0, Math.min(1, member.hp / previousMaxHp));
        const profile = applyRosterProfile(member, identity, growthRows, skills);
        // Only identity and class-derived combat fields change; contracts and progression stay intact.
        Object.assign(member, identity, { title: profile.title, mark: profile.mark, growthStateId: profile.growthStateId,
            skills: resolved.job === identity.job ? resolved.skills : profile.skills,
            stats: { ...profile.stats }, baseStats: { ...profile.stats }, maxHp: profile.stats.maxHp,
            hp: ratio === 0 ? 0 : Math.max(1, Math.round(profile.stats.maxHp * ratio)) });
    }
}
