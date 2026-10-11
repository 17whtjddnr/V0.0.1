import test from 'node:test';
import assert from 'node:assert/strict';
import { consolidateCharacterRecords, uniqueCharacters, configureCharacterDeduplication, canonicalCharacterId, distinctCharacterName } from '../src/character-deduplication.mjs';

test('old story and catalog records consolidate while retaining progress, free contracts, selections and affinity', () => {
    const catalog = { id: 'CHAR-112', name: '윌로우', level: 3, experience: 40, hp: 12, weeklyWage: 90, contractWeeklyWage: 90 };
    const story = { ...catalog, id: 'CHAR-STORY-LORA', level: 2, experience: 90, weeklyWage: 0, contractWeeklyWage: 0, wageExempt: true };
    const state = { guildMembers: [catalog, story], recruits: [structuredClone(story), structuredClone(catalog)],
        plazaOffers: [structuredClone(story)], plazaCurrentOffer: structuredClone(catalog), gold: 200,
        affinityByCharacterId: { 'CHAR-112': 10, 'CHAR-STORY-LORA': 55 },
        guildDispatchMemberIds: ['CHAR-STORY-LORA', 'CHAR-112'], plazaGiftedIds: ['CHAR-STORY-LORA'],
        plazaGuildInvitedIds: ['CHAR-STORY-LORA', 'CHAR-112'], guildSecretaryId: 'CHAR-STORY-LORA', characterInfoMemberId: 'CHAR-STORY-LORA',
        guildDispatches: [{ status: 'active', memberIds: ['CHAR-STORY-LORA', 'CHAR-112'], memberSnapshots: [structuredClone(story), structuredClone(catalog)], returnWeek: 4 }],
        guildRecruitmentDialog: { memberId: 'CHAR-STORY-LORA' } };
    const party = [structuredClone(story), structuredClone(catalog)];
    consolidateCharacterRecords(state, party);
    assert.equal(state.guildMembers.length, 1);
    assert.equal(state.guildMembers[0].id, 'CHAR-112');
    assert.equal(state.guildMembers[0].level, 3);
    assert.equal(state.guildMembers[0].experience, 40); // Different levels cannot have their experience summed.
    assert.equal(state.guildMembers[0].contractWeeklyWage, 0);
    assert.equal(state.guildMembers[0].wageExempt, true);
    assert.equal(state.guildMembers[0].hp, 12);
    assert.equal(state.recruits.length, 1);
    assert.equal(party.length, 1);
    assert.equal(state.gold, 200);
    assert.deepEqual(state.affinityByCharacterId, { 'CHAR-112': 55 });
    assert.deepEqual(state.guildDispatchMemberIds, ['CHAR-112']);
    assert.deepEqual(state.plazaGiftedIds, ['CHAR-112']);
    assert.deepEqual(state.plazaGuildInvitedIds, ['CHAR-112']);
    assert.equal(state.guildSecretaryId, 'CHAR-112');
    assert.equal(state.characterInfoMemberId, 'CHAR-112');
    assert.equal(state.guildRecruitmentDialog.memberId, 'CHAR-112');
    assert.deepEqual(state.guildDispatches[0].memberIds, ['CHAR-112']);
    assert.equal(state.guildDispatches[0].memberSnapshots.length, 1);
    assert.equal(state.guildDispatches[0].returnWeek, 4);
    assert.equal(state.guildDispatches[0].status, 'active');
    assert.deepEqual(state.plazaOffers, []);
    assert.equal(state.plazaCurrentOffer, null);
    const saved = structuredClone({ state, party });
    consolidateCharacterRecords(state, party);
    assert.deepEqual({ state, party }, saved);
});

test('merging duplicated battle slots updates turn indexes, actors and effect sources without changing enemies', () => {
    const first = { id: 'CHAR-STORY-LYSIA', level: 1, hp: 0 };
    const duplicate = { id: 'CHAR-111', level: 2, hp: 5 };
    const other = { id: 'CHAR-003', level: 1, hp: 7, effects: [{ sourceId: 'CHAR-STORY-LYSIA' }] };
    const enemy = { id: 'MON-001', hp: 9, effects: [{ sourceId: 'CHAR-STORY-LYSIA' }] };
    const party = [first, duplicate, other];
    const state = { enemies: [enemy], turn: 2, turnOrderIndex: 2,
        turnOrder: [{ side: 'hero', index: 0, actor: first }, { side: 'hero', index: 1, actor: duplicate },
            { side: 'hero', index: 2, actor: other }, { side: 'enemy', index: 0, actor: enemy }] };
    consolidateCharacterRecords(state, party);
    assert.deepEqual(party.map(c => c.id), ['CHAR-111', 'CHAR-003']);
    assert.equal(party[0].hp, 5);
    assert.deepEqual(state.turnOrder.map(turn => [turn.side, turn.index]), [['hero', 0], ['hero', 1], ['enemy', 0]]);
    assert.equal(state.turnOrder[0].actor, party[0]);
    assert.equal(state.turnOrderIndex, 1);
    assert.equal(state.turn, 1);
    assert.equal(enemy.hp, 9);
    assert.equal(enemy.effects[0].sourceId, 'CHAR-111');
    assert.equal(other.effects[0].sourceId, 'CHAR-111');
});

test('story character lists keep one card for each canonical catalog and owned character', () => {
    const characters = uniqueCharacters([{ id: 'CHAR-111', level: 1 }, { id: 'CHAR-112', level: 1 },
        { id: 'CHAR-STORY-LYSIA', level: 3, storyCompanion: true }, { id: 'CHAR-STORY-LORA', level: 2, storyCompanion: true }]);
    assert.deepEqual(characters.map(c => c.id), ['CHAR-111', 'CHAR-112']);
    assert.deepEqual(characters.map(c => c.level), [3, 2]);
});

test('edited Oscar duplicates keep the original Oscar and migrate stale saved artwork and references', () => {
    try {
        const oscar = { id: 'CHAR-183', name: '오스카', gender: 'M', job: '기사', level: 1,
            portraitSrc: '/assets/art/2D/Character/0006_M_N.webp', thumbnailSrc: '/assets/art/2D/Character_thumnail/0006_M_N.webp' };
        const edited = { ...oscar, id: 'CHAR-001', portraitSrc: oscar.portraitSrc + '?v=old-edit' };
        configureCharacterDeduplication([edited, oscar]);
        assert.equal(canonicalCharacterId('CHAR-001'), 'CHAR-183');
        const catalog = uniqueCharacters([structuredClone(edited), structuredClone(oscar)]);
        assert.equal(catalog.length, 1);
        assert.equal(catalog[0].id, 'CHAR-183');
        assert.equal(catalog[0].storyCompanion, undefined);
        const state = { guildMembers: [{ ...edited, portraitSrc: '/old/0002_M_A.webp', level: 3, experience: 42, contractWeeklyWage: 90 }, structuredClone(oscar)],
            guildSecretaryId: 'CHAR-001', affinityByCharacterId: { 'CHAR-001': 40, 'CHAR-183': 20 } };
        consolidateCharacterRecords(state, []);
        assert.equal(state.guildMembers.length, 1);
        assert.equal(state.guildMembers[0].portraitSrc, oscar.portraitSrc);
        assert.equal(state.guildMembers[0].level, 3);
        assert.equal(state.guildMembers[0].experience, 42);
        assert.equal(state.guildMembers[0].contractWeeklyWage, 90);
        assert.equal(state.guildSecretaryId, 'CHAR-183');
        assert.deepEqual(state.affinityByCharacterId, { 'CHAR-183': 40 });
    } finally { configureCharacterDeduplication([]); }
});

test('two Oscars with different artwork stay separate characters and only the conflicting name changes', () => {
    try {
        const original = { id: 'CHAR-183', name: '오스카', gender: 'M', portraitSrc: '/art/0006_M_N.webp' };
        const other = { id: 'CHAR-002', name: '오스카', gender: 'M', portraitSrc: '/art/0002_M_A.webp' };
        const report = configureCharacterDeduplication([other, original]);
        assert.equal(report.aliases['CHAR-002'], undefined);
        assert.equal(distinctCharacterName(original), '오스카');
        assert.notEqual(distinctCharacterName(other), '오스카');
        const name = distinctCharacterName(other);
        assert.equal(name.includes(' '), false);
        assert.equal(uniqueCharacters([structuredClone(other), structuredClone(original)]).length, 2);
        configureCharacterDeduplication([other, original]);
        assert.equal(distinctCharacterName(other), name);
    } finally { configureCharacterDeduplication([]); }
});
