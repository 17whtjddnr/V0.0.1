import test from 'node:test';
import assert from 'node:assert/strict';
import { startRegularExpeditionDestination, finishRegularExpeditionDestination, tutorialExpeditionDestination } from '../src/regular-expedition.mjs';
import { completeGuildDispatches } from '../src/guild-dispatch.mjs';
import { guildDestinations, guildDestinationUnlocked } from '../src/guild-destination.mjs';

test('tutorial clear leaves Mistwood locked; the subsequent normal clear unlocks it', () => {
    const state = { tutorial: { stage: 'battle' }, guildClearedDestinations: [] };
    startRegularExpeditionDestination(state, tutorialExpeditionDestination);
    finishRegularExpeditionDestination(state, true, guildDestinations);
    assert.equal(state.expeditionDestination, null);
    assert.deepEqual(state.guildClearedDestinations, []);
    assert.equal(guildDestinationUnlocked('mistwood', state.guildClearedDestinations), false);
    state.tutorial.stage = 'done';
    startRegularExpeditionDestination(state, tutorialExpeditionDestination);
    finishRegularExpeditionDestination(state, true, guildDestinations);
    assert.deepEqual(state.guildClearedDestinations, ['meadow']);
    assert.equal(guildDestinationUnlocked('mistwood', state.guildClearedDestinations), true);
    startRegularExpeditionDestination(state, tutorialExpeditionDestination);
    finishRegularExpeditionDestination(state, true, guildDestinations);
    assert.deepEqual(state.guildClearedDestinations, ['meadow']);
});

test('failed normal expeditions do not grant unlocks', () => {
    const state = { tutorial: { stage: 'done' }, guildClearedDestinations: [] };
    startRegularExpeditionDestination(state, tutorialExpeditionDestination);
    finishRegularExpeditionDestination(state, false, guildDestinations);
    assert.equal(guildDestinationUnlocked('mistwood', state.guildClearedDestinations), false);
});

test('successful dispatches pay rewards without granting or removing normal clear records, including after reload', () => {
    for (const cleared of [[], ['meadow']]) {
        const state = { week: 2, gold: 100, fame: 0, guildClearedDestinations: [...cleared], guildDispatches: [
            { id: 'meadow-dispatch', status: 'active', returnWeek: 2, successChance: 100, gold: 240, fame: 2, destination: { location: 'meadow', subregion: 'north' } },
            { id: 'forest-dispatch', status: 'active', returnWeek: 2, successChance: 100, gold: 300, fame: 3, destination: { location: 'mistwood', subregion: 'north' } },
        ] };
        const restored = JSON.parse(JSON.stringify(state));
        assert.equal(completeGuildDispatches(restored, () => 0).length, 2);
        assert.deepEqual(restored.guildClearedDestinations, cleared);
        assert.equal(restored.gold, 640);
        assert.equal(restored.fame, 5);
        assert.equal(guildDestinationUnlocked('mistwood', restored.guildClearedDestinations), cleared.includes('meadow'));
        assert.equal(guildDestinationUnlocked('quietleaf', restored.guildClearedDestinations), false);
        assert.equal(completeGuildDispatches(restored, () => 0).length, 0);
    }
});
