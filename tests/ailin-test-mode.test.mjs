import test from 'node:test';
import assert from 'node:assert/strict';
import { syncAilinTestMode, normalAilinTestRecord } from '../src/ailin-test-mode.mjs';

const character = id => ({id, level: 2, zodiac: 'test', stats: {attack: 30, defense: 20, maxHp: 100, speed: 15, critChance: 5},
    baseStats: {attack: 30, defense: 20, maxHp: 100, speed: 15, critChance: 5}, hp: 100, maxHp: 100, effects: [], cooldowns: {skill: 2}});

test('the toggle boosts only Ailin across guild and battle copies, then restores her normal stats', () => {
    const ailin = character('CHAR-208');
    const other = character('CHAR-246');
    const fighter = structuredClone(ailin);
    const state = {guildMembers: [ailin, other], recruits: []};
    syncAilinTestMode(state, [fighter], true, []);
    for (const copy of [ailin, fighter]) {
        assert.deepEqual([copy.stats.attack, copy.stats.defense, copy.stats.maxHp, copy.stats.speed], [9999,9999,9999,9999]);
        assert.equal(copy.hp, 9999);
        assert.equal(copy.stats.critChance, 5);
    }
    assert.equal(other.stats.attack, 30);
    fighter.hp = 5000;
    syncAilinTestMode(state, [fighter], true, []);
    assert.equal(fighter.hp, 5000);
    syncAilinTestMode(state, [fighter], false, []);
    assert.deepEqual(ailin.stats, character('CHAR-208').stats);
    assert.deepEqual(fighter.stats, ailin.stats);
    assert.equal(fighter.maxHp, 100);
    assert.equal(fighter.hp, 50);
    assert.deepEqual(fighter.cooldowns, {skill: 2});
    assert.equal(fighter.testOriginalStats, undefined);
});

test('saving during test mode keeps normal stats and does not change the active battle', () => {
    const ailin = character('CHAR-208');
    const state = {guildMembers: [ailin], recruits: []};
    syncAilinTestMode(state, [], true, []);
    const restored = JSON.parse(JSON.stringify({state}, (_key, value) => normalAilinTestRecord(value)));
    assert.equal(restored.state.guildMembers[0].stats.attack, 30);
    assert.equal(restored.state.guildMembers[0].maxHp, 100);
    assert.equal(restored.state.guildMembers[0].hp, 100);
    assert.equal(restored.state.guildMembers[0].testOriginalStats, undefined);
    assert.equal(ailin.stats.attack, 9999);
    assert.equal(ailin.maxHp, 9999);
});
