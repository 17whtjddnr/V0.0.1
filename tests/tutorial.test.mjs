import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { tutorialPrologue, tutorialDialogues, tutorialActionAllowed, completeTutorialRental, confirmTutorialMilestone, restoreTutorialState, syncTutorialCompanion, TUTORIAL_COMPANION_ID } from '../src/tutorial.mjs';
import { guildResearchMarkup } from '../src/guild-research.mjs';

const companion = { id: TUTORIAL_COMPANION_ID, name: 'Companion', stats: { maxHp: 3 }, weeklyWage: 85 };
const rentalState = (gold = 5000) => ({ gold, tutorial: { stage: 'rent' }, guildMembers: [], recruits: [] });

test('prologue backgrounds exist and short story nodes have valid destinations', () => {
    assert.equal(new Set(tutorialPrologue.map(scene => scene.background)).size, 4);
    for (const scene of tutorialPrologue) assert.ok(existsSync(new URL(`../public/assets/backgrounds/${scene.background}`, import.meta.url)));
    for (const dialogue of tutorialDialogues) {
        assert.ok(dialogue.nodes[dialogue.start]);
        for (const node of Object.values(dialogue.nodes)) {
            assert.ok(node.text.length < 150);
            assert.ok(node.end || dialogue.nodes[node.next]);
        }
    }
});

test('guided recruitment and founding reject unrelated controls and wrong guild members', () => {
    const expected = {
        'look-first':'plaza-look-around', 'hire-first':'plaza-hire', 'look-second':'plaza-look-around',
        'hire-second':'plaza-hire', depart:'plaza-depart', 'guild-open':'guild-open', rent:'tutorial-rent',
        'guild-exit':'guild-exit', 'select-open':'plaza-guild-select-open', 'rent-popup':'tutorial-confirm',
        'companion-popup':'tutorial-confirm', 'final-popup':'tutorial-confirm',
    };
    for (const [stage, action] of Object.entries(expected)) {
        assert.equal(tutorialActionAllowed({stage}, action), true);
        for (const blocked of ['plaza-rest','game-menu-open','plaza-party-swap','guild-room']) assert.equal(tutorialActionAllowed({stage}, blocked), false);
    }
    assert.equal(tutorialActionAllowed({stage:'select-companion'},'plaza-guild-toggle',TUTORIAL_COMPANION_ID),true);
    assert.equal(tutorialActionAllowed({stage:'select-companion'},'plaza-guild-toggle','CHAR-002'),false);
    assert.equal(tutorialActionAllowed({stage:'battle'},'skill'),true);
    assert.equal(tutorialActionAllowed({stage:'battle'},'combat-target'),true);
    assert.equal(tutorialActionAllowed({stage:'battle'},'advance'),false);
    assert.equal(tutorialActionAllowed({stage:'done'},'plaza-rest'),true);
    assert.equal(tutorialActionAllowed(null,'game-menu-open'),true);
});

test('first rental charges once, rejects insufficient funds and persists a zero-wage companion', () => {
    const insufficient = rentalState(4999);
    assert.equal(completeTutorialRental(insufficient,companion),false);
    assert.equal(insufficient.gold,4999);
    const state = rentalState(5315);
    assert.equal(completeTutorialRental(state,companion),true);
    assert.equal(state.gold,315);
    assert.equal(state.guildFounded,true);
    assert.equal(completeTutorialRental(state,companion),false);
    assert.equal(state.gold,315);
    const restored = JSON.parse(JSON.stringify(state));
    assert.equal(confirmTutorialMilestone(restored),true);
    assert.equal(restored.guildMembers.length,1);
    assert.equal(restored.guildMembers[0].weeklyWage,0);
    assert.equal(restored.guildMembers[0].wageExempt,true);
    assert.equal(restored.guildSecretaryId,TUTORIAL_COMPANION_ID);
    assert.equal(confirmTutorialMilestone(restored),true);
    assert.equal(restored.guildMembers.length,1);
    assert.equal(restored.view,'guild');
    assert.equal(restored.guildRoom,'lobby');
    assert.equal(restored.tutorial.stage,'guild-exit');
    restored.tutorial.stage='final-popup';
    assert.equal(confirmTutorialMilestone(restored),true);
    assert.equal(restored.tutorial.stage,'done');
    assert.equal(confirmTutorialMilestone(restored),false);
});

test('resuming restores research, lobby, selection and combat without recharging or dropping result reports', () => {
    for (const stage of ['rent','rent-popup','companion-popup']) {
        const state={};
        assert.equal(restoreTutorialState(state,{view:'plaza',gold:315,tutorial:{stage}}),true);
        assert.equal(state.view,'guild');
        assert.equal(state.guildResearchOpen,true);
        assert.equal(state.gold,315);
    }
    const lobby={};restoreTutorialState(lobby,{tutorial:{stage:'guild-exit'}});
    assert.equal(lobby.guildRoom,'lobby');
    const selection={};restoreTutorialState(selection,{tutorial:{stage:'select-companion'}});
    assert.equal(selection.plazaGuildSelectionOpen,true);
    const combat={};restoreTutorialState(combat,{tutorial:{stage:'battle'},mode:'combat',enemyPhase:true,enemies:[{hp:1}]});
    assert.equal(combat.view,'expedition');assert.equal(combat.enemyPhase,false);assert.equal(combat.enemies[0].hp,1);
    const report={completed:true};const result={};
    restoreTutorialState(result,{tutorial:{stage:'battle'},expeditionResult:report,mode:'victory'});
    assert.equal(result.expeditionResult,report);assert.equal(result.mode,'victory');
    const legacy={view:'plaza'};assert.equal(restoreTutorialState(legacy,{view:'guild'}),false);assert.equal(legacy.view,'plaza');
});

test('founding research has one actionable node at 5000 gold; later research retains normal nodes', () => {
    const first = guildResearchMarkup(5000,true);
    assert.equal((first.match(/class="guild-research-icon"/g)||[]).length,1);
    assert.ok(first.includes('5000G'));
    assert.ok(first.includes('data-action="tutorial-rent"'));
    assert.ok(first.includes('aria-disabled="false"'));
    const later=guildResearchMarkup(10000);
    assert.equal((later.match(/class="guild-research-icon"/g)||[]).length,3);
    assert.ok(!later.includes('tutorial-rent'));
});


test('tutorial follows the character ID and keeps edited names and images in saved companions', () => {
    assert.equal(TUTORIAL_COMPANION_ID, 'CHAR-208');
    for (const dialogue of tutorialDialogues) assert.equal(dialogue.characterId, TUTORIAL_COMPANION_ID);
    assert.equal(tutorialDialogues[0].nodes.line8.text, '{{characterName}}이에요.');
    const profile = { ...companion, name: '수정된 이름', portraitSrc: '/edited-art.webp', thumbnailSrc: '/edited-thumb.webp' };
    const saved = { ...companion, name: '이전 이름', tutorialCompanion: true, hp: 1 };
    const state = { tutorial: { companion: { ...saved } }, guildMembers: [{ ...saved }], recruits: [{ ...saved }], guildSecretaryId: TUTORIAL_COMPANION_ID };
    const party = [{ ...saved }];
    syncTutorialCompanion(state, profile, party);
    for (const member of [state.tutorial.companion, ...state.guildMembers, ...state.recruits, ...party]) {
        assert.equal(member.name, profile.name);
        assert.equal(member.portraitSrc, profile.portraitSrc);
        assert.equal(member.thumbnailSrc, profile.thumbnailSrc);
        assert.equal(member.hp, 1);
        assert.equal(member.weeklyWage, 0);
    }
    completeTutorialRental(rentalState(), profile);
    const rent = rentalState();
    completeTutorialRental(rent, profile);
    assert.equal(rent.tutorial.companion.name, profile.name);
});

test('old tutorial companions migrate without changing unrelated members or losing assigned slots', () => {
    const old = { ...companion, id: 'CHAR-001', tutorialCompanion: true };
    const other = { id: 'CHAR-002', name: '다른 길드원' };
    const state = { guildMembers: [old, other], recruits: [], guildSecretaryId: old.id,
        guildDispatchMemberIds: [old.id], affinityByCharacterId: { 'CHAR-001': 50 },
        guildDispatches: [{ status: 'active', memberIds: [old.id], memberSnapshots: [{ ...old }] }] };
    syncTutorialCompanion(state, companion);
    assert.equal(old.id, TUTORIAL_COMPANION_ID);
    assert.equal(state.guildSecretaryId, TUTORIAL_COMPANION_ID);
    assert.deepEqual(state.guildDispatchMemberIds, [TUTORIAL_COMPANION_ID]);
    assert.deepEqual(state.guildDispatches[0].memberIds, [TUTORIAL_COMPANION_ID]);
    assert.equal(state.guildDispatches[0].memberSnapshots[0].id, TUTORIAL_COMPANION_ID);
    assert.equal(state.affinityByCharacterId[TUTORIAL_COMPANION_ID], 50);
    assert.equal(other.name, '다른 길드원');
});
