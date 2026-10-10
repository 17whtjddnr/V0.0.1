import { combatProfile, evaluateTeamPower, estimateExpeditionClearRate, basicForecastSkill, RECOMMENDED_CLEAR_RATE } from './combat-power.mjs';

const recommendationCache = new Map();
function referenceParties(characters, monsters) {
    const available = characters.filter((actor) => actor.stats?.maxHp > 0).map(combatProfile);
    if (!available.length) {
        const level = Math.max(1, ...monsters.map((actor) => Number(actor.level) || 1));
        return [Array.from({ length: 4 }, (_, index) => ({ id: `calibration-${index}`, level,
            stats: { maxHp: 6 * level, attack: 2 * level, defense: 2 * level, speed: 2 * level, critChance: 2, critDamage: 2, effectHit: 2, effectResist: 2 }, skills: [basicForecastSkill] }))];
    }
    const combinations = [
        ['기사', '전사', '마도사', '정령사'], ['도적', '사수', '마도사', '정령사'],
        ['기사', '전사', '사수', '도적'], ['전사', '마도사', '사수', '정령사'],
    ];
    return combinations.map((jobs, teamIndex) => {
        const used = new Set();
        return jobs.map((job, index) => {
            const choices = available.filter((actor) => actor.job === job && !used.has(actor.id));
            const fallback = available.filter((actor) => !used.has(actor.id));
            const pool = choices.length ? choices : fallback;
            if (!pool.length) return null;
            const actor = pool[(teamIndex * 7 + index * 3) % pool.length];
            used.add(actor.id);
            return actor;
        }).filter(Boolean);
    });
}
function scaledParty(party, factor) {
    return party.map((actor) => ({ ...actor, stats: { ...actor.stats,
        ...Object.fromEntries(['maxHp', 'attack', 'defense'].map((stat) => [stat, Math.max(1, Math.round((Number(actor.stats[stat]) || 0) * factor))])),
    } }));
}
export function recommendedExpeditionPower(monsters, characters = []) {
    if (!monsters.some((actor) => actor.isBoss)) return { power: 0, clearRate: 0, targetRate: RECOMMENDED_CLEAR_RATE, calibrated: false };
    const roster = monsters.map(combatProfile);
    const parties = referenceParties(characters, roster);
    const key = JSON.stringify([roster, parties]);
    if (recommendationCache.has(key)) return recommendationCache.get(key);
    const clearRateAt = (factor) => parties.reduce((sum, party) => sum + estimateExpeditionClearRate(scaledParty(party, factor), roster, 12), 0) / parties.length;
    let low = 0, high = 1;
    while (high < 64 && clearRateAt(high) < RECOMMENDED_CLEAR_RATE) { low = high; high *= 2; }
    for (let iteration = 0; iteration < 7; iteration += 1) {
        const middle = (low + high) / 2;
        if (clearRateAt(middle) >= RECOMMENDED_CLEAR_RATE) high = middle;
        else low = middle;
    }
    const clearRate = clearRateAt(high);
    const powers = clearRate >= RECOMMENDED_CLEAR_RATE
        ? parties.map((party) => evaluateTeamPower(scaledParty(party, high))).sort((a, b) => a - b) : [0];
    const middle = Math.floor(powers.length / 2);
    const power = powers.length % 2 ? powers[middle] : Math.round((powers[middle - 1] + powers[middle]) / 2);
    const result = { power, clearRate, targetRate: RECOMMENDED_CLEAR_RATE, calibrated: clearRate >= RECOMMENDED_CLEAR_RATE };
    if (recommendationCache.size >= 128) recommendationCache.delete(recommendationCache.keys().next().value);
    recommendationCache.set(key, result);
    return result;
}
