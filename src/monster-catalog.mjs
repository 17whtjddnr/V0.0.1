import definitions from '../data/monsters/expedition-monsters.json' with { type: 'json' };

export const monsterDefinitions = Object.freeze(definitions);
export const MONSTER_COUNT = definitions.length;

export function monsterIdsForStage(location, subregion) {
    return definitions.filter((entry) => entry.location === location && entry.subregion === subregion).map((entry) => entry.id);
}

export function monstersForStage(roster, destination, boss = false) {
    // The legacy corridor predates the expedition map and represents the crypt.
    const location = destination?.location === 'crypt' || !destination?.location ? 'ashabyss' : destination.location;
    const subregion = location === 'ashabyss' && (!destination?.subregion || destination.location === 'crypt')
        ? 'floor-1' : destination.subregion;
    const ids = new Set(monsterIdsForStage(location, subregion));
    return roster.filter((entry) => ids.has(entry.id) && entry.isBoss === boss);
}
