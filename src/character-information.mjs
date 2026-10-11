export function findCharacterInformation(state, party, id, source) {
    const members = source === 'party' ? party : state[source];
    return members?.find((member) => member.id === id) || null;
}

export function currentCharacterInformation(character, statKeys, combatStat) {
    return {
        ...character,
        currentStats: Object.fromEntries(statKeys.map((key) => [key, Math.round(combatStat(character, key) * 100) / 100])),
    };
}

export function filterCharacterInformation(members, filters) {
    const query = filters.search.trim().toLocaleLowerCase();
    return members.filter((member) => (!query || [member.id, member.name, member.element, member.job, member.grade, member.level].join(' ').toLocaleLowerCase().includes(query))
        && (!filters.element || member.element === filters.element)
        && (!filters.job || member.job === filters.job)
        && (!filters.grade || String(member.grade) === filters.grade));
}
