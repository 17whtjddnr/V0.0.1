import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import XLSX from 'xlsx';
import { generateRosters, CHARACTER_COUNT, applyRosterProfile } from '../src/roster-generation.mjs';
import { characterPortraitFiles, buildCharacterPortraitFileAssignments, characterThumbnailAsset, playerThumbnailAsset } from '../src/character-assets.mjs';
import { characterIdentity, characterImageMetadata, imageJobs } from '../src/character-identity.mjs';
import { syncCharacterIdentities } from '../src/character-identity-sync.mjs';

const workbook = XLSX.read(readFileSync(new URL('../public/data/import/Zodiac_Stats_Merged.xlsx', import.meta.url)), { type: 'buffer' });
const sheet = workbook.Sheets['\uC131\uC7A5\uBD84\uD574'];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: false });
const growthRows = rows.slice(6).map((row) => Object.fromEntries(rows[5].map((key, index) => [key, row[index]])));
const characters = generateRosters(growthRows).characters;
const assignments = buildCharacterPortraitFileAssignments(characters);

test('265 unique characters have valid growth profiles at every supported level', () => {
    assert.equal(CHARACTER_COUNT, 265);
    for (let level = 1; level <= 5; level += 1) {
        const roster = generateRosters(growthRows, level);
        assert.equal(roster.characters.length, 265);
        assert.equal(roster.monsters.length, 660);
        assert.equal(new Set(roster.characters.map((entry) => entry.id)).size, 265);
        assert.equal(new Set(roster.characters.map((entry) => entry.name)).size, 265);
        for (const entry of roster.characters) {
            assert.equal(entry.level, level);
            assert.ok([3, 4, 5].includes(entry.grade));
            assert.ok(Object.values(entry.stats).every(Number.isFinite));
            assert.ok(entry.stats.maxHp > 0);
        }
        assert.deepEqual(buildCharacterPortraitFileAssignments(roster.characters), assignments);
    }
});

test('each character has a distinct portrait and matching thumbnail that exist', () => {
    assert.equal(characterPortraitFiles.length, 267);
    assert.equal(new Set(characterPortraitFiles).size, 267);
    assert.equal(Object.keys(assignments).length, 265);
    assert.equal(new Set(Object.values(assignments)).size, 265);
    const originalAssignments = buildCharacterPortraitFileAssignments(characters.slice(0, 261));
    for (const [id, file] of Object.entries(originalAssignments)) assert.equal(assignments[id], file);
    for (const character of characters) {
        const file = assignments[character.id];
        assert.ok(file);
        assert.ok(existsSync(new URL(`../public/assets/art/2D/Character/${file}`, import.meta.url)));
        assert.ok(existsSync(new URL(`../public${characterThumbnailAsset(file).split('?')[0]}`, import.meta.url)));
    }
});

test('names and class growth follow the existing image assignments at every level', () => {
    for (let level = 1; level <= 5; level++) {
        for (const character of generateRosters(growthRows, level).characters) {
            if (['CHAR-208', 'CHAR-246'].includes(character.id)) continue;
            const metadata = characterImageMetadata(assignments[character.id]);
            assert.equal(character.gender, metadata.gender);
            assert.equal(character.name.includes(' '), false);
            if (metadata.job) assert.equal(character.job, metadata.job);
            assert.deepEqual(character.stats, applyRosterProfile(character, {}, growthRows).stats);
            assert.equal(characterIdentity(character).name, character.name);
        }
    }
    for (const [code, job] of Object.entries(imageJobs)) {
        for (const gender of ['F', 'M']) assert.equal(characterImageMetadata(`/art/1234_${gender}_${code}.webp?v=1`).job, job);
    }
    assert.equal(characterImageMetadata('0126_T.webp').job, '도적');
    assert.equal(characterImageMetadata('0137_Shop.webp').job, null);
});

test('existing save copies gain the image class while preserving experience, contracts, wounds and selections', () => {
    const expected = generateRosters(growthRows, 3).characters.find(character => characterIdentity(character));
    const oldJob = Object.values(imageJobs).find(job => job !== expected.job);
    const old = applyRosterProfile(expected, { job: oldJob, name: '오래된 성 이름' }, growthRows);
    const member = { ...old, experience: 52, experienceToNextLevel: 100, weeklyWage: 432, contractWeeklyWage: 432,
        hp: 0, maxHp: old.stats.maxHp, cooldowns: { example: 2 }, effects: [{ type: 'buff' }] };
    const copy = structuredClone(member);
    copy.hp = copy.maxHp / 2;
    const state = { guildMembers: [member], recruits: [copy], plazaOffers: [structuredClone(member)],
        guildDispatchMemberIds: [member.id], guildDispatches: [{ status: 'active', memberIds: [member.id] }] };
    syncCharacterIdentities(state, [copy], growthRows);
    for (const entry of [member, copy, ...state.plazaOffers]) {
        assert.equal(entry.name, expected.name);
        assert.equal(entry.job, expected.job);
        assert.deepEqual(entry.stats, expected.stats);
        assert.equal(entry.level, 3);
        assert.equal(entry.experience, 52);
        assert.equal(entry.contractWeeklyWage, 432);
        assert.equal(entry.weeklyWage, 432);
        assert.deepEqual(entry.cooldowns, { example: 2 });
        assert.deepEqual(entry.effects, [{ type: 'buff' }]);
    }
    assert.equal(member.hp, 0);
    assert.equal(copy.hp, Math.round(expected.stats.maxHp / 2));
    assert.deepEqual(state.guildDispatchMemberIds, [member.id]);
    const migrated = structuredClone(state);
    syncCharacterIdentities(state, [copy], growthRows);
    assert.deepEqual(state, migrated);
});

test('custom art determines identity, story first names remain, and Master and Ailin are exempt', () => {
    const base = characters[0];
    const changed = characterIdentity({ ...base, portraitSrc: '/assets/art/2D/Character/0005_F_W.webp?v=2' });
    assert.equal(changed.gender, 'F');
    assert.equal(changed.job, '전사');
    assert.equal(changed.name.includes(' '), false);
    assert.equal(characterIdentity({ ...base, id: 'CHAR-STORY-LYSIA', storyCompanion: true, name: '리시아', portraitSrc: '0005_F_W.webp' }).name, '비올라');
    assert.equal(characterIdentity({ ...base, id: 'CHAR-STORY-LORA', storyCompanion: true, name: '로라' }).name, '윌로우');
    for (const id of ['CHAR-208', 'CHAR-246']) assert.equal(characterIdentity({ ...base, id }), null);
    assert.equal(characterIdentity({ ...base, isMaster: true }), null);
});
