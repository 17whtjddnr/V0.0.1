import { legacyStoryCharacterIds, characterIdentityPortraits, characterIdentity } from './character-identity.mjs';

let aliases = { ...legacyStoryCharacterIds };
let renamed = new Map();
let profilesById = new Map();
export function canonicalCharacterId(id) {
    const visited = new Set();
    while (aliases[id] && !visited.has(id)) { visited.add(id); id = aliases[id]; }
    return id;
}
export const distinctCharacterName = entry => renamed.get(entry.id) || entry.name;
const uniqueIds = ids => [...new Set(ids.map(canonicalCharacterId))];

export function configureCharacterDeduplication(characters) {
    aliases = { ...legacyStoryCharacterIds };
    renamed = new Map();
    const portraits = new Map(), names = new Map();
    const source = entry => (entry.portraitSrc || entry.thumbnailSrc || '').split('?')[0];
    const naturalPortrait = entry => characterIdentityPortraits[entry.id] === source(entry).split('/').pop();
    const ordered = [...characters].sort((a, b) => Number(naturalPortrait(b)) - Number(naturalPortrait(a)) || a.id.localeCompare(b.id));
    for (const entry of ordered) {
        const image = source(entry);
        const key = `${image}|${entry.name}`;
        const previous = image && portraits.get(key);
        if (previous) aliases[entry.id] = previous.id;
        else if (image) portraits.set(key, entry);
    }
    const retained = ordered.filter(entry => canonicalCharacterId(entry.id) === entry.id)
        .sort((a, b) => Number(characterIdentity(b)?.name === b.name) - Number(characterIdentity(a)?.name === a.name) || a.id.localeCompare(b.id));
    const usedNames = new Set(retained.map(entry => entry.name));
    for (const entry of retained) {
        if (!names.has(entry.name)) { names.set(entry.name, entry.id); continue; }
        const prefixes = entry.gender === 'F' ? ['엘', '아', '릴', '세', '미', '노', '루', '에'] : ['오스', '알', '브', '발', '테', '에', '카', '루'];
        const endings = entry.gender === 'F' ? ['리나', '네아', '벨', '리아', '에나', '엘라', '비아', '티아'] : ['윈', '데릭', '리온', '하르트', '리크', '세르', '디안', '루스'];
        const candidates = prefixes.flatMap(prefix => endings.map(ending => prefix + ending));
        const replacement = candidates.find(name => !usedNames.has(name));
        if (!replacement) throw new Error('중복 캐릭터를 위한 새 이름을 찾지 못했습니다.');
        renamed.set(entry.id, replacement);
        usedNames.add(replacement);
    }
    profilesById = new Map(retained.map(entry => [entry.id, { ...entry, name: distinctCharacterName(entry) }]));
    return { aliases: { ...aliases }, renamed: Object.fromEntries(renamed) };
}

export function uniqueCharacters(characters) {
    const groups = new Map();
    const naturalIds = new Set();
    for (const member of characters) {
        const originalId = member.id;
        const id = canonicalCharacterId(member.id);
        if (legacyStoryCharacterIds[member.id]) member.storyCompanion = true;
        member.name = distinctCharacterName(member);
        const canonical = profilesById.get(id);
        if (originalId !== id && canonical) {
            member.name = canonical.name;
            if (canonical.portraitSrc) member.portraitSrc = canonical.portraitSrc;
            if (canonical.thumbnailSrc) member.thumbnailSrc = canonical.thumbnailSrc;
        }
        member.id = id;
        const previous = groups.get(id);
        if (!previous) { groups.set(id, member); if (originalId === id) naturalIds.add(id); continue; }
        const newerProgress = Number(member.level || 1) > Number(previous.level || 1)
            || Number(member.level || 1) === Number(previous.level || 1) && (Number(member.experience || 0) > Number(previous.experience || 0)
                || Number(member.experience || 0) === Number(previous.experience || 0) && originalId === id && !naturalIds.has(id));
        const retained = newerProgress ? member : previous;
        if (originalId === id) naturalIds.add(id);
        const story = previous.storyCompanion ? previous : member.storyCompanion ? member : null;
        if (story) {
            // Preserve the story contract, including Willow's zero wage, without summing experience.
            for (const key of ['storyCompanion', 'wageExempt', 'weeklyWage', 'contractWeeklyWage', 'price', 'weapon', 'characterConceptVersion']) {
                if (story[key] !== undefined) retained[key] = story[key];
            }
        }
        groups.set(id, retained);
    }
    return [...groups.values()];
}

export function consolidateCharacterRecords(state, party) {
    const previousPartyIds = party.map(member => member.id);
    for (const field of ['guildMembers', 'recruits', 'plazaOffers']) {
        if (state[field]) state[field] = uniqueCharacters(state[field]);
    }
    const consolidatedParty = uniqueCharacters(party);
    // Remap battle indexes only when duplicate party slots were actually removed.
    if (consolidatedParty.length !== party.length) {
        const remap = index => consolidatedParty.findIndex(member => member.id === canonicalCharacterId(previousPartyIds[index]));
        const seenTurns = new Set();
        let removedBeforeCurrent = 0;
        state.turnOrder = (state.turnOrder || []).filter((turn, index) => {
            if (turn.side !== 'hero') return true;
            const next = remap(turn.index);
            const keep = next >= 0 && !seenTurns.has(next);
            if (keep) { turn.index = next; turn.actor = consolidatedParty[next]; seenTurns.add(next); }
            else if (index < (state.turnOrderIndex || 0)) removedBeforeCurrent++;
            return keep;
        });
        state.turnOrderIndex = Math.max(0, (state.turnOrderIndex || 0) - removedBeforeCurrent);
        if (Number.isInteger(state.turn) && state.turn >= 0) state.turn = remap(state.turn);
        party.splice(0, party.length, ...consolidatedParty);
    }
    const storyIds = new Set((state.guildMembers || []).filter(member => member.storyCompanion).map(member => member.id));
    for (const member of [...party, ...(state.recruits || [])]) if (storyIds.has(member.id)) member.storyCompanion = true;
    if (state.plazaCurrentOffer) state.plazaCurrentOffer = uniqueCharacters([state.plazaCurrentOffer])[0];
    for (const field of ['guildSecretaryId', 'characterInfoMemberId', 'catalogSelectedRosterId']) {
        if (state[field]) state[field] = canonicalCharacterId(state[field]);
    }
    if (state.guildRecruitmentDialog?.memberId) state.guildRecruitmentDialog.memberId = canonicalCharacterId(state.guildRecruitmentDialog.memberId);
    for (const field of ['guildDispatchMemberIds', 'plazaGiftedIds', 'plazaGuildInvitedIds']) {
        if (state[field]) state[field] = uniqueIds(state[field]);
    }
    for (const dispatch of state.guildDispatches || []) {
        dispatch.memberIds = uniqueIds(dispatch.memberIds || []);
        if (dispatch.memberSnapshots) dispatch.memberSnapshots = uniqueCharacters(dispatch.memberSnapshots);
        if (dispatch.members) dispatch.members = uniqueCharacters(dispatch.members);
    }
    for (const oldId of Object.keys(aliases)) {
        const newId = canonicalCharacterId(oldId);
        if (state.affinityByCharacterId?.[oldId] !== undefined) {
            state.affinityByCharacterId[newId] = Math.max(state.affinityByCharacterId[newId] || 0, state.affinityByCharacterId[oldId]);
            delete state.affinityByCharacterId[oldId];
        }
    }
    for (const actor of [...party, ...(state.enemies || [])]) {
        for (const effect of actor.effects || []) if (effect.sourceId) effect.sourceId = canonicalCharacterId(effect.sourceId);
    }
    const owned = new Set([...(state.guildMembers || []), ...(state.recruits || [])].map(member => member.id));
    if (state.plazaOffers) state.plazaOffers = state.plazaOffers.filter(member => !owned.has(member.id));
    if (owned.has(state.plazaCurrentOffer?.id)) state.plazaCurrentOffer = null;
}
