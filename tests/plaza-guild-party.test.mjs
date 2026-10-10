import test from 'node:test';
import assert from 'node:assert/strict';
import { togglePlazaGuildMember, hasAvailablePlazaGuildMember } from '../src/plaza-guild-party.mjs';
import { guildDispatchPlan } from '../src/guild-dispatch.mjs';
const member = (id) => ({ id, name: id, stats: { maxHp: 100, attack: 20, defense: 10, speed: 5 }, skills: [], weeklyWage: 30 });
const makeState = () => ({ gold: 100, guildMembers: ['a', 'b', 'c', 'd', 'e'].map(member), recruits: [], guildDispatches: [], guildDispatchMemberIds: [] });

test('guild selection joins and leaves the regular party without charging or refunding gold', () => {
    const state = makeState();
    assert.equal(togglePlazaGuildMember(state, 'a'), true);
    assert.equal(state.recruits[0].isGuildMember, true);
    assert.equal(state.recruits[0].hp, 100);
    assert.equal(state.recruits[0].maxHp, 100);
    state.recruits[0].stats.maxHp = 50;
    assert.equal(state.guildMembers[0].stats.maxHp, 100);
    assert.equal(togglePlazaGuildMember(state, 'a'), true);
    assert.equal(state.recruits.length, 0);
    assert.equal(state.guildMembers.length, 5);
    assert.equal(state.gold, 100);
});

test('the regular party holds four members including hired mercenaries', () => {
    const state = makeState();
    state.recruits.push(member('mercenary'));
    for (const id of ['a', 'b', 'c']) assert.equal(togglePlazaGuildMember(state, id), true);
    assert.equal(togglePlazaGuildMember(state, 'd'), false);
    assert.equal(state.recruits.length, 4);
    assert.equal(togglePlazaGuildMember(state, 'a'), true);
    assert.equal(togglePlazaGuildMember(state, 'd'), true);
});

test('dispatched and reserved members cannot join the regular party', () => {
    const state = makeState();
    state.guildDispatches.push({status: 'active', memberIds: ['a']});
    state.guildDispatchMemberIds.push('b');
    assert.equal(togglePlazaGuildMember(state, 'a'), false);
    assert.equal(togglePlazaGuildMember(state, 'b'), false);
    assert.equal(togglePlazaGuildMember(state, 'missing'), false);
    assert.equal(state.recruits.length, 0);
    state.guildDispatches[0].status = 'success';
    assert.equal(togglePlazaGuildMember(state, 'a'), true);
});

test('regular party members cannot be dispatched or silently remove a hired contract', () => {
    const state = makeState();
    togglePlazaGuildMember(state, 'a');
    state.guildSelectedDestination = {location: 'meadow', subregion: 'north'};
    state.guildDispatchMemberIds = ['a'];
    assert.equal(guildDispatchPlan(state, {meadow: {name: 'Meadow', power: 100, subregions: [['north','North']]}}), null);
    state.recruits.push(member('b'));
    assert.equal(togglePlazaGuildMember(state, 'b'), false);
    assert.equal(state.recruits.length, 2);
});


test('selection opens only when an additional available guild member can join', () => {
    const state = makeState();
    state.guildMembers = [];
    assert.equal(hasAvailablePlazaGuildMember(state), false);
    state.guildMembers = ['a', 'b', 'c'].map(member);
    assert.equal(hasAvailablePlazaGuildMember(state), true);
    togglePlazaGuildMember(state, 'a');
    state.guildDispatches = [{ status: 'active', memberIds: ['b'] }];
    state.guildDispatchMemberIds = ['c'];
    assert.equal(hasAvailablePlazaGuildMember(state), false);
    state.guildDispatchMemberIds = [];
    assert.equal(hasAvailablePlazaGuildMember(state), true);
    state.recruits.push(...['mercenary1', 'mercenary2', 'mercenary3'].map(member));
    assert.equal(hasAvailablePlazaGuildMember(state), false);
    state.recruits.pop();
    assert.equal(hasAvailablePlazaGuildMember(state), true);
});
