import test from 'node:test';
import assert from 'node:assert/strict';
import { findCharacterInformation, currentCharacterInformation, filterCharacterInformation } from '../src/character-information.mjs';
import { createCombatEngine } from '../src/combat-engine.mjs';

test('information uses the clicked roster instance rather than another copy or the catalog level', () => {
    const recruit = { id: 'CHAR-001', level: 7, hp: 31 };
    const guildMember = { id: 'CHAR-001', level: 4, hp: 100 };
    const partyMember = { id: 'CHAR-001', level: 8, hp: 12 };
    const state = { catalogLevel: 1, recruits: [recruit], guildMembers: [guildMember] };
    assert.equal(findCharacterInformation(state, [partyMember], recruit.id, 'recruits'), recruit);
    assert.equal(findCharacterInformation(state, [partyMember], recruit.id, 'guildMembers'), guildMember);
    assert.equal(findCharacterInformation(state, [partyMember], recruit.id, 'party'), partyMember);
    assert.equal(findCharacterInformation(state, [], 'missing', 'recruits'), null);
});

test('current information applies combat effects and percentage conversion without changing skill calculation inputs', () => {
    const character = {
        id: 'CHAR-001', level: 7, hp: 31,
        stats: { attack: 100, defense: 50, maxHp: 200, critChance: 2, critDamage: 5 },
        effects: [{ code: 'ATTACK_UP', value: .5, turnsRemaining: 2 }],
    };
    const before = structuredClone(character);
    const { combatStat } = createCombatEngine({});
    const current = currentCharacterInformation(character, Object.keys(character.stats), combatStat);
    assert.equal(current.level, 7);
    assert.equal(current.hp, 31);
    assert.equal(current.currentStats.attack, 150);
    assert.equal(current.currentStats.critChance, 20);
    assert.equal(current.currentStats.critDamage, 150);
    assert.equal(current.stats, character.stats);
    assert.equal(combatStat(current, 'attack'), 150);
    assert.deepEqual(character, before);
});

test('guild roster search combines element, job and grade filters without adding catalog characters', () => {
    const members = [
        { id: 'a', name: 'Aileen', element: 'water', job: 'mage', grade: 3, level: 7 },
        { id: 'b', name: 'Beryl', element: 'water', job: 'knight', grade: 4, level: 2 },
        { id: 'c', name: 'Celia', element: 'fire', job: 'mage', grade: 3, level: 4 },
    ];
    const filters = { search: '', element: '', job: '', grade: '' };
    assert.deepEqual(filterCharacterInformation(members, filters), members);
    assert.deepEqual(filterCharacterInformation(members, { ...filters, search: ' AILEEN ' }), [members[0]]);
    assert.deepEqual(filterCharacterInformation(members, { ...filters, element: 'water', job: 'mage', grade: '3' }), [members[0]]);
    assert.deepEqual(filterCharacterInformation(members, { ...filters, element: 'fire', grade: '4' }), []);
    assert.deepEqual(filterCharacterInformation([], filters), []);
});
