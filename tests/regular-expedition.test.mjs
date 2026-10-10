import test from 'node:test';
import assert from 'node:assert/strict';
import { tutorialExpeditionDestination, startRegularExpeditionDestination, finishRegularExpeditionDestination, migrateRegularExpeditionDestination, regularExpeditionPreparation } from '../src/regular-expedition.mjs';
import { approveGuildDispatch, guildDispatchPlan } from '../src/guild-dispatch.mjs';
const destinations = { meadow: { name: '온바람 평야', power: 1200, subregions: [['north','북부']] }, mistwood: { name: '숲', power: 2000, subregions: [['north','북부']] } };

test('tutorial and normal expedition destinations leave dispatch preparation untouched', () => {
    for (const selection of [null, { region: 'Stormreach', location: 'mistwood', subregion: 'north' }]) {
        const state = { guildSelectedDestination: selection, guildDispatchMemberIds: ['a'], guildDestinationDetail: 'mistwood' };
        startRegularExpeditionDestination(state, tutorialExpeditionDestination);
        assert.equal(state.guildSelectedDestination, selection);
        assert.deepEqual(state.expeditionDestination, tutorialExpeditionDestination);
        finishRegularExpeditionDestination(state, true, destinations);
        assert.equal(state.guildSelectedDestination, selection);
        assert.deepEqual(state.guildDispatchMemberIds, ['a']);
        assert.equal(state.guildDestinationDetail, 'mistwood');
        assert.deepEqual(state.guildClearedDestinations, ['meadow']);
        startRegularExpeditionDestination(state);
        assert.equal(state.expeditionDestination.location, 'crypt');
        assert.equal(state.guildSelectedDestination, selection);
        finishRegularExpeditionDestination(state, false, destinations);
        assert.equal(state.expeditionDestination, null);
        assert.equal(state.guildSelectedDestination, selection);
    }
});

test('regular expedition cannot supply a missing dispatch destination or clear a running expedition', () => {
    const state = { week: 1, gold: 100, guildMembers: [{ id: 'a', name: '대원', stats: { maxHp:100, attack:20, defense:10, speed:5 } }], guildDispatchMemberIds: ['a'], guildDispatches: [], guildSelectedDestination: null };
    startRegularExpeditionDestination(state, tutorialExpeditionDestination);
    assert.equal(guildDispatchPlan(state, destinations), null);
    state.guildSelectedDestination = { location: 'mistwood', subregion: 'north' };
    assert.ok(approveGuildDispatch(state, destinations));
    assert.equal(state.guildSelectedDestination, null);
    assert.deepEqual(state.expeditionDestination, tutorialExpeditionDestination);
});

test('legacy tutorial contamination clears once while deliberate dispatch choices are retained', () => {
    const old = { tutorial: { stage: 'battle' }, guildSelectedDestination: { ...tutorialExpeditionDestination } };
    migrateRegularExpeditionDestination(old);
    assert.equal(old.guildSelectedDestination, null);
    assert.deepEqual(old.expeditionDestination, tutorialExpeditionDestination);
    old.guildSelectedDestination = { ...tutorialExpeditionDestination, region: 'Stormreach' };
    migrateRegularExpeditionDestination(old);
    assert.equal(old.guildSelectedDestination.region, 'Stormreach');
    const deliberate = { tutorial: { stage: 'done' }, guildSelectedDestination: { ...tutorialExpeditionDestination, region: 'Stormreach' } };
    migrateRegularExpeditionDestination(deliberate);
    assert.equal(deliberate.guildSelectedDestination.region, 'Stormreach');
    const legacyDone = { tutorial: { stage: 'done' }, guildSelectedDestination: { ...tutorialExpeditionDestination } };
    migrateRegularExpeditionDestination(legacyDone);
    assert.equal(legacyDone.guildSelectedDestination, null);
});


test('normal departure requires a valid destination before checking for party members', () => {
    const state = { tutorial: { stage: 'done' }, recruits: [], guildSelectedDestination: { location: 'meadow', subregion: 'north' } };
    let status = regularExpeditionPreparation(state, destinations);
    assert.equal(status.canDepart, false);
    assert.equal(status.label, '원정출발 - 원정지를 선택해주세요');
    state.recruits = [{ id: 'a' }];
    assert.equal(regularExpeditionPreparation(state, destinations).canDepart, false);
    state.regularSelectedDestination = { location: 'meadow', subregion: 'missing' };
    assert.equal(regularExpeditionPreparation(state, destinations).destination, null);
    state.regularSelectedDestination = { location: 'meadow', subregion: 'north', name: '온바람 평야 북부' };
    state.recruits = [];
    status = regularExpeditionPreparation(state, destinations);
    assert.equal(status.canDepart, false);
    assert.equal(status.label, '원정출발 - 원정대원을 선발해주세요');
    state.recruits = [{ id: 'a' }];
    status = regularExpeditionPreparation(state, destinations);
    assert.equal(status.canDepart, true);
    const dispatchSelection = state.guildSelectedDestination;
    const departureSelection = state.regularSelectedDestination;
    state.regularDestinationDetail = departureSelection.location;
    state.regularDestinationSubregion = departureSelection.subregion;
    state.regularMapFocusedRegion = 'Stormreach';
    startRegularExpeditionDestination(state, status.destination);
    assert.deepEqual(state.expeditionDestination, departureSelection);
    assert.notEqual(state.expeditionDestination, departureSelection);
    assert.equal(state.regularSelectedDestination, null);
    assert.equal(state.regularDestinationDetail, '');
    assert.equal(state.regularDestinationSubregion, '');
    assert.equal(state.regularMapFocusedRegion, '');
    assert.equal(state.guildSelectedDestination, dispatchSelection);
    assert.equal(regularExpeditionPreparation(state, destinations).canDepart, false);
    finishRegularExpeditionDestination(state, true, destinations);
    assert.equal(state.guildSelectedDestination, dispatchSelection);
    assert.equal(state.regularSelectedDestination, null);
});

test('tutorial departure keeps its predefined destination and three-button preparation', () => {
    const state = { tutorial: { stage: 'depart' }, recruits: [{ id: 'a' }] };
    const status = regularExpeditionPreparation(state, destinations);
    assert.equal(status.requiresDestination, false);
    assert.equal(status.canDepart, true);
    assert.equal(status.label, '원정 출발');
    assert.equal(regularExpeditionPreparation({ recruits: [] }, destinations).requiresDestination, true);
});
