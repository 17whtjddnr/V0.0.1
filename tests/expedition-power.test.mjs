import test from 'node:test';
import assert from 'node:assert/strict';
import { recommendedMonsterPower } from '../src/expedition-power.mjs';
import { configureDestinationMonsterPower, guildDestinations, guildDestinationMarkup } from '../src/guild-destination.mjs';
import { estimateExpeditionClearRate } from '../src/combat-power.mjs';
import { guildDispatchPlan } from '../src/guild-dispatch.mjs';

const monster = (attack, isBoss = false, id = '') => ({ id, isBoss, stats: { attack, maxHp: 100, defense: 5, speed: 5 } });

test('recommendation grows with a stronger expedition and handles stages without monsters', () => {
    const normal = [monster(10), monster(20), monster(30), monster(60, true)];
    const stronger = normal.map((actor) => ({ ...actor, stats: { ...actor.stats, maxHp: actor.stats.maxHp * 3, attack: actor.stats.attack * 3 } }));
    assert.ok(recommendedMonsterPower(normal) > 0);
    assert.ok(recommendedMonsterPower(stronger) > recommendedMonsterPower(normal));
    assert.equal(recommendedMonsterPower([]), 0);
});

test('subregion display and dispatch share current monster stats and update when the roster changes', () => {
    const location = guildDestinations.meadow;
    const north = location.monsterIdsBySubregion.north;
    const west = location.monsterIdsBySubregion.west;
    let roster = [monster(10, false, north[0]), monster(20, false, north[1]), monster(30, false, north[2]), monster(60, true, north[3]), monster(200, true, west[3])];
    configureDestinationMonsterPower(() => roster);
    const northPower = location.powerBySubregion.north;
    const westPower = location.powerBySubregion.west;
    assert.ok(northPower > 0);
    assert.notEqual(westPower, northPower);
    const state = { guildMembers: [{ id: 'hero', stats: { attack: 60, maxHp: 200, speed: 5 } }], guildDispatchMemberIds: ['hero'], guildDispatches: [], guildSelectedDestination: { location: 'meadow', subregion: 'west' } };
    let plan = guildDispatchPlan(state, guildDestinations);
    assert.equal(plan.recommendedPower, westPower);
    assert.equal(plan.gold, 240);
    assert.equal(plan.fame, 2);
    assert.equal(plan.weeks, 1);
    assert.equal(plan.baseSuccessChance, estimateExpeditionClearRate(state.guildMembers, location.monstersForSubregion('west')) * 100);
    const regular = guildDestinationMarkup({ destination: 'meadow', activeSubregion: 'west', testUnlock: true, regularExpedition: true });
    const dispatch = guildDestinationMarkup({ destination: 'meadow', activeSubregion: 'west', testUnlock: true });
    assert.ok(regular.includes('<strong>' + westPower.toLocaleString('ko-KR') + '</strong>'));
    assert.ok(dispatch.includes('<strong>' + westPower.toLocaleString('ko-KR') + '</strong>'));
    roster = [{ ...monster(300, true, west[3]), stats: { attack: 300, maxHp: 300, defense: 5, speed: 5 } }];
    assert.equal(location.powerBySubregion.north, 0);
    assert.ok(guildDispatchPlan(state, guildDestinations).recommendedPower > westPower);
    roster = [];
    assert.equal(guildDispatchPlan(state, guildDestinations), null);
    assert.ok(guildDestinationMarkup({ regularExpedition: true }).includes('<strong>—</strong>'));
    configureDestinationMonsterPower(() => []);
});
