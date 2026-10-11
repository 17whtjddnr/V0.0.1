import test from 'node:test';
import assert from 'node:assert/strict';
import { togglePlazaGuildMember, hasAvailablePlazaGuildMember, guildSelectionConflict, canTransferGuildSelection, transferGuildSelection } from '../src/plaza-guild-party.mjs';
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
    assert.equal(hasAvailablePlazaGuildMember(state), true);
    state.guildDispatchMemberIds = [];
    assert.equal(hasAvailablePlazaGuildMember(state), true);
    state.recruits.push(...['mercenary1', 'mercenary2', 'mercenary3'].map(member));
    assert.equal(hasAvailablePlazaGuildMember(state), false);
    state.recruits.pop();
    assert.equal(hasAvailablePlazaGuildMember(state), true);
});

test('checking a conflicting selection leaves both parties unchanged until confirmation', () => {
    const state = makeState();
    state.guildDispatchMemberIds = ['a', 'b'];
    const before = structuredClone(state);
    assert.equal(guildSelectionConflict(state, 'a', 'regular'), true);
    assert.equal(canTransferGuildSelection(state, 'a', 'regular'), true);
    assert.deepEqual(state, before);
    assert.equal(transferGuildSelection(state, 'a', 'regular'), true);
    assert.deepEqual(state.guildDispatchMemberIds, ['b']);
    assert.equal(state.recruits[0].id, 'a');
    assert.equal(state.recruits[0].weeklyWage, 30);
    assert.equal(state.gold, 100);
});

test('confirmed regular to dispatch transfer removes only the selected guild member', () => {
    const state = makeState();
    togglePlazaGuildMember(state, 'a');
    togglePlazaGuildMember(state, 'b');
    state.recruits.push(member('mercenary'));
    state.guildDispatchMemberIds = ['c'];
    const before = structuredClone(state);
    assert.equal(canTransferGuildSelection(state, 'a', 'dispatch'), true);
    assert.deepEqual(state, before);
    assert.equal(transferGuildSelection(state, 'a', 'dispatch'), true);
    assert.deepEqual(state.recruits.map(member => member.id), ['b', 'mercenary']);
    assert.deepEqual(state.guildDispatchMemberIds, ['c', 'a']);
    assert.equal(state.guildMembers[0].weeklyWage, 30);
    assert.equal(state.gold, 100);
});

test('active dispatches cannot transfer in either direction even with stale reservations', () => {
    for (const target of ['regular', 'dispatch']) {
        const state = makeState();
        if (target === 'regular') state.guildDispatchMemberIds = ['a'];
        else togglePlazaGuildMember(state, 'a');
        state.guildDispatches = [{ status: 'active', memberIds: ['a'] }];
        const before = structuredClone(state);
        assert.equal(transferGuildSelection(state, 'a', target), false);
        assert.deepEqual(state, before);
    }
});

test('full target parties or dispatch limits preserve the original selection', () => {
    for (const target of ['regular', 'dispatch']) {
        const state = makeState();
        if (target === 'regular') {
            state.guildDispatchMemberIds = ['a'];
            state.recruits = ['b','c','d','e'].map(member);
        } else {
            togglePlazaGuildMember(state, 'a');
            state.guildDispatchMemberIds = ['b','c','d','e'];
        }
        const before = structuredClone(state);
        assert.equal(transferGuildSelection(state, 'a', target), false);
        assert.deepEqual(state, before);
    }
    const state = makeState();
    togglePlazaGuildMember(state, 'a');
    state.guildDispatches = Array.from({length: 4}, () => ({status: 'active', memberIds: []}));
    const before = structuredClone(state);
    assert.equal(transferGuildSelection(state, 'a', 'dispatch'), false);
    assert.deepEqual(state, before);
});

test('transferred master returns to slot one and repeat confirmation has no effect', () => {
    const state = makeState();
    state.guildMembers[0].isMaster = true;
    togglePlazaGuildMember(state, 'b');
    state.guildDispatchMemberIds = ['a'];
    assert.equal(transferGuildSelection(state, 'a', 'regular'), true);
    assert.deepEqual(state.recruits.map(member => member.id), ['a', 'b']);
    const before = structuredClone(state);
    assert.equal(transferGuildSelection(state, 'a', 'regular'), false);
    assert.deepEqual(state, before);
});
