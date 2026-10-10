import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import XLSX from 'xlsx';
import { generateRosters, CHARACTER_COUNT } from '../src/roster-generation.mjs';
import { characterPortraitFiles, buildCharacterPortraitFileAssignments, characterThumbnailAsset, playerThumbnailAsset } from '../src/character-assets.mjs';

const workbook = XLSX.read(readFileSync(new URL('../public/data/import/Zodiac_Stats_Merged.xlsx', import.meta.url)), { type: 'buffer' });
const sheet = workbook.Sheets['\uC131\uC7A5\uBD84\uD574'];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: false });
const growthRows = rows.slice(6).map((row) => Object.fromEntries(rows[5].map((key, index) => [key, row[index]])));
const characters = generateRosters(growthRows).characters;
const assignments = buildCharacterPortraitFileAssignments(characters);

test('261 unique characters have valid growth profiles at every supported level', () => {
    assert.equal(CHARACTER_COUNT, 261);
    for (let level = 1; level <= 5; level += 1) {
        const roster = generateRosters(growthRows, level);
        assert.equal(roster.characters.length, 261);
        assert.equal(roster.monsters.length, 168);
        assert.equal(new Set(roster.characters.map((entry) => entry.id)).size, 261);
        assert.equal(new Set(roster.characters.map((entry) => entry.name)).size, 261);
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
    assert.equal(characterPortraitFiles.length, 263);
    assert.equal(new Set(characterPortraitFiles).size, 263);
    assert.equal(Object.keys(assignments).length, 261);
    assert.equal(new Set(Object.values(assignments)).size, 261);
    for (const character of characters) {
        const file = assignments[character.id];
        assert.ok(file);
        assert.ok(existsSync(new URL(`../public/assets/art/2D/Character/${file}`, import.meta.url)));
        assert.ok(existsSync(new URL(`../public${characterThumbnailAsset(file).split('?')[0]}`, import.meta.url)));
    }
});
