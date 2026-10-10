import test from 'node:test';
import assert from 'node:assert/strict';
import { guildDispatchPlan, approveGuildDispatch, completeGuildDispatches, activeGuildDispatch, pendingGuildDispatchResults, acknowledgeGuildDispatchResults, guildDispatchPower, powerRatioSuccessChance } from '../src/guild-dispatch.mjs';

const member = (id, attack = 150) => ({ id, stats: { attack, maxHp: 1000, defense: 100, speed: 50 } });
const destinations = { meadow: { name: 'Meadow', power: 40000, dispatchWeeks: 1, dispatchGold: 240, dispatchFame: 2, subregions: [['north', 'North']] } };
const makeState = () => ({ week: 3, gold: 100, fame: 0, guildMembers: [member('a'), member('b')], guildDispatchMemberIds: ['a'], guildDispatches: [], guildSelectedDestination: { location: 'meadow', subregion: 'north' } });

test('plan requires a valid destination and one to four unique available members', () => {
    const state = makeState();
    const plan = guildDispatchPlan(state, destinations);
    assert.equal(plan.power, guildDispatchPower(state.guildMembers.slice(0, 1)));
    assert.ok(plan.successChance > 0 && plan.successChance < 100);
    assert.equal(powerRatioSuccessChance(1200, 1200), 80);
    assert.equal(powerRatioSuccessChance(0, 1200), 0);
    assert.ok(powerRatioSuccessChance(600, 1200) < 80);
    for (const ids of [[], ['missing'], ['a', 'a'], ['a', 'b', 'c', 'd', 'e']]) {
        assert.equal(guildDispatchPlan({ ...state, guildDispatchMemberIds: ids }, destinations), null);
    }
    assert.equal(guildDispatchPlan({ ...state, guildSelectedDestination: null }, destinations), null);
    assert.equal(guildDispatchPlan({ ...state, guildSelectedDestination: { location: 'meadow', subregion: 'missing' } }, destinations), null);
});

test('duration stays within one to five weeks and success probability is clamped to zero to 100', () => {
    for (const [power, weeks] of [[1, 1], [1200, 1], [1201, 2], [6000, 5], [12000, 5]]) {
        const plan = guildDispatchPlan(makeState(), { meadow: { ...destinations.meadow, dispatchWeeks: undefined, power } });
        assert.equal(plan.weeks, weeks);
        assert.ok(plan.successChance >= 0 && plan.successChance <= 100);
    }
    const zero = makeState(); zero.guildMembers[0].stats = {};
    assert.equal(guildDispatchPlan(zero, destinations).successChance, 0);
    const high = makeState(); high.guildMembers[0].stats.maxHp = 100000;
    assert.ok(guildDispatchPlan(high, destinations).successChance > 99);
});

test('approval persists the plan, clears selection, prevents repeat dispatch and returns only when due', () => {
    const state = makeState();
    state.guildDestinationDetail = 'meadow';
    state.guildDestinationSubregion = 'north';
    state.guildMapFocusedRegion = 'region';
    state.guildExpeditionStep = 'members';
    const plan = guildDispatchPlan(state, destinations);
    const dispatch = approveGuildDispatch(state, destinations);
    assert.equal(dispatch.returnWeek, 4);
    assert.equal(dispatch.gold, plan.gold);
    assert.equal(dispatch.successChance, plan.successChance);
    assert.deepEqual(state.guildDispatchMemberIds, []);
    assert.equal(state.guildSelectedDestination, null);
    assert.equal(state.guildDestinationDetail, '');
    assert.equal(state.guildDestinationSubregion, '');
    assert.equal(state.guildMapFocusedRegion, '');
    assert.equal(state.guildExpeditionStep, 'destination');
    assert.deepEqual(dispatch.destination, plan.destination);
    assert.deepEqual(dispatch.memberIds, ['a']);
    assert.equal(guildDispatchPlan(state, destinations), null);
    assert.equal(activeGuildDispatch(state, 'a').id, dispatch.id);
    state.guildDispatchMemberIds = ['a'];
    state.guildSelectedDestination = { location: 'meadow', subregion: 'north' };
    assert.equal(approveGuildDispatch(state, destinations), null);
    assert.deepEqual(completeGuildDispatches(state, () => 0), []);
    const restored = JSON.parse(JSON.stringify(state));
    restored.week = 4;
    assert.equal(completeGuildDispatches(restored, () => 0).length, 1);
    assert.equal(restored.gold, 100 + plan.gold);
    assert.equal(restored.fame, plan.fame);
    assert.equal(activeGuildDispatch(restored, 'a'), undefined);
    assert.deepEqual(completeGuildDispatches(restored, () => 0), []);
    assert.equal(restored.gold, 100 + plan.gold);
    assert.ok(guildDispatchPlan(restored, destinations));
});

test('failed return grants no rewards and releases members, including zero probability', () => {
    const state = makeState(); state.guildMembers[0].stats = {};
    approveGuildDispatch(state, destinations); state.week = 10;
    const [dispatch] = completeGuildDispatches(state, () => 0);
    assert.equal(dispatch.status, 'failed');
    assert.equal(state.gold, 100);
    assert.equal(state.fame, 0);
    assert.equal(activeGuildDispatch(state, 'a'), undefined);
});


test('matching element and job grant five points each per selected member, capped at 100', () => {
    const state = makeState();
    const locations = { meadow: { ...destinations.meadow, dispatchBonus: { element: 'fire', job: 'knight' } } };
    state.guildMembers[0].element = 'fire';
    state.guildMembers[0].job = 'mage';
    assert.equal(guildDispatchPlan(state, locations).bonusChance, 5);
    state.guildMembers[0].job = 'knight';
    let plan = guildDispatchPlan(state, locations);
    assert.equal(plan.bonusChance, 10);
    assert.equal(plan.successChance, Math.min(100, plan.baseSuccessChance + 10));
    state.guildMembers[1].element = 'fire'; state.guildMembers[1].job = 'knight';
    state.guildDispatchMemberIds.push('b');
    plan = guildDispatchPlan(state, locations);
    assert.equal(plan.bonusChance, 20);
    const dispatch = approveGuildDispatch(state, locations);
    assert.equal(dispatch.bonusChance, 20);
    assert.equal(dispatch.successChance, plan.successChance);
    const strong = makeState(); strong.guildMembers[0].element = 'fire'; strong.guildMembers[0].stats.maxHp = 100000;
    assert.equal(guildDispatchPlan(strong, locations).successChance, 100);
    const unmatched = makeState();
    assert.equal(guildDispatchPlan(unmatched, locations).bonusChance, 0);
});

test('explicit destination duration and rewards are shared with the approval, including zero rewards', () => {
    const location = { ...destinations.meadow, dispatchWeeks: 3, dispatchGold: 0, dispatchFame: 0 };
    const state = makeState();
    const plan = guildDispatchPlan(state, { meadow: location });
    assert.equal(plan.weeks, 3);
    assert.equal(plan.gold, 0);
    assert.equal(plan.fame, 0);
    const dispatch = approveGuildDispatch(state, { meadow: location });
    assert.equal(dispatch.weeks, 3);
    assert.equal(dispatch.returnWeek, 6);
    assert.equal(dispatch.gold, 0);
});


test('multiple due dispatches create persistent reports, future parties remain active and confirmation never repays rewards', () => {
    const state = makeState();
    const first = approveGuildDispatch(state, destinations);
    state.guildDispatchMemberIds = ['b'];
    state.guildSelectedDestination = { location: 'forest', subregion: 'north' };
    const second = approveGuildDispatch(state, { forest: { ...destinations.meadow, dispatchWeeks: 2 } });
    state.week = 4;
    completeGuildDispatches(state, () => 0);
    assert.equal(first.completedWeek, 4);
    assert.equal(pendingGuildDispatchResults(state).length, 1);
    assert.equal(activeGuildDispatch(state, 'b').id, second.id);
    const restored = JSON.parse(JSON.stringify(state));
    restored.week = 5;
    completeGuildDispatches(restored, () => .99);
    const reports = pendingGuildDispatchResults(restored);
    assert.deepEqual(reports.map((report) => report.status), ['success', 'failed']);
    assert.equal(reports[0].memberSnapshots[0].id, 'a');
    const gold = restored.gold;
    acknowledgeGuildDispatchResults(restored, [first.id]);
    assert.deepEqual(pendingGuildDispatchResults(restored).map((report) => report.id), [second.id]);
    acknowledgeGuildDispatchResults(restored, [second.id]);
    completeGuildDispatches(restored, () => 0);
    assert.equal(restored.gold, gold);
    assert.deepEqual(pendingGuildDispatchResults(JSON.parse(JSON.stringify(restored))), []);
});

test('legacy completed dispatches do not generate retrospective popups', () => {
    const state = makeState();
    state.guildDispatches = [{ id: 'old', status: 'success' }];
    assert.deepEqual(pendingGuildDispatchResults(state), []);
});


test('four active dispatches block approval until a party returns', () => {
    const state = makeState();
    state.guildMembers = Array.from({ length: 5 }, (_, i) => member(`m${i}`));
    const locations = Object.fromEntries(Array.from({ length: 5 }, (_, i) => [`place${i}`, destinations.meadow]));
    for (let i = 0; i < 4; i++) {
        state.guildDispatchMemberIds = [`m${i}`];
        state.guildSelectedDestination = { location: `place${i}`, subregion: 'north' };
        assert.ok(approveGuildDispatch(state, locations));
    }
    state.guildDispatchMemberIds = ['m4'];
    state.guildSelectedDestination = { location: 'place4', subregion: 'north' };
    assert.equal(guildDispatchPlan(state, locations), null);
    assert.equal(approveGuildDispatch(state, locations), null);
    assert.equal(state.guildDispatches.length, 4);
    state.guildDispatches[0].status = 'success';
    assert.ok(approveGuildDispatch(state, locations));
});

test('an active location blocks a second party, including other subregions', () => {
    const state = makeState();
    const locations = { meadow: { ...destinations.meadow, subregions: [['north', 'North'], ['south', 'South']] } };
    approveGuildDispatch(state, locations);
    state.guildDispatchMemberIds = ['b'];
    for (const subregion of ['north', 'south']) {
        state.guildSelectedDestination = { location: 'meadow', subregion };
        assert.equal(approveGuildDispatch(state, locations), null);
    }
    state.week = 4;
    completeGuildDispatches(state, () => 0);
    assert.ok(approveGuildDispatch(state, locations));
});
