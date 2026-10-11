import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import XLSX from 'xlsx';
import { monsterDefinitions, MONSTER_COUNT, monsterIdsForStage, monstersForStage } from '../src/monster-catalog.mjs';
import { generateRosters } from '../src/roster-generation.mjs';
import { guildDestinations, guildDestinationMonsterIds, guildDestinationMarkup } from '../src/guild-destination.mjs';

const workbook = XLSX.read(readFileSync(new URL('../public/data/import/Zodiac_Stats_Merged.xlsx', import.meta.url)), { type: 'buffer' });
const rows = XLSX.utils.sheet_to_json(workbook.Sheets['성장분해'], { header: 1, defval: '', blankrows: false });
const growthRows = rows.slice(6).map((row) => Object.fromEntries(rows[5].map((key, index) => [key, row[index]])));

test('all 660 entries preserve the Markdown names, sizes, concepts and stage order', () => {
    const md = readFileSync(new URL('../던전별_몬스터_추천.md', import.meta.url), 'utf8');
    const expected = [];
    let locationName;
    for (const line of md.split(/\r?\n/)) {
        if (line.startsWith('### ')) {
            locationName = line.slice(4);
        }
        if (!line.startsWith('| ') || line.startsWith('| 구역')) continue;
        const [subregionName, ...cells] = line.split('|').slice(1, -1).map((cell) => cell.trim());
        cells.forEach((cell, index) => {
            const [, name, size, concept] = cell.match(/^(.+?)〔([대중소])〕—(.+)$/);
            expected.push({ name, size, concept, locationName, subregionName, isBoss: index === 3 });
        });
    }
    assert.equal(MONSTER_COUNT, 660);
    assert.equal(new Set(monsterDefinitions.map((entry) => entry.id)).size, 660);
    assert.deepEqual(monsterDefinitions.map(({ name, size, concept, locationName, subregionName, isBoss }) => ({ name, size, concept, locationName, subregionName, isBoss })), expected);
});

test('all 165 registered stages have exactly three ordinary monsters and their own boss', () => {
    let stages = 0;
    for (const [location, destination] of Object.entries(guildDestinations)) {
        for (const [subregion] of destination.subregions) {
            const ids = monsterIdsForStage(location, subregion);
            assert.deepEqual(ids, guildDestinationMonsterIds(location, subregion, true));
            stages += 1;
            assert.equal(ids.length, 4);
            const regular = monstersForStage(monsterDefinitions, { location, subregion });
            const bosses = monstersForStage(monsterDefinitions, { location, subregion }, true);
            assert.equal(regular.length, 3);
            assert.equal(bosses.length, 1);
            assert.equal(bosses[0].grade, 5);
            assert.ok(regular.every((entry) => entry.grade < 5));
            assert.deepEqual([...regular, ...bosses].map((entry) => entry.id), ids);
        }
    }
    assert.equal(stages, 165);
    assert.equal(monstersForStage(monsterDefinitions, { location: 'eldermere-1', subregion: 'north' }).length, 3);
    assert.deepEqual(monstersForStage(monsterDefinitions, { location: 'crypt', subregion: '' }), monstersForStage(monsterDefinitions, { location: 'ashabyss', subregion: 'floor-1' }));
    assert.deepEqual(guildDestinationMonsterIds('meadow', 'south'), monsterIdsForStage('meadow', 'north'));
});

test('registered portraits and thumbnails resolve to real assets without changing uploaded files', () => {
    for (const entry of monsterDefinitions) {
        for (const source of [entry.portraitSrc, entry.thumbnailSrc]) {
            assert.ok(existsSync(new URL(`../public${source}`, import.meta.url)), `${entry.name}: ${source}`);
        }
        assert.ok(entry.thumbnailSrc.startsWith('/assets/art/2D/Monster_thumnail/'));
        if (entry.portraitFallback) assert.equal(entry.portraitSrc, entry.thumbnailSrc);
        else assert.ok(entry.portraitSrc.startsWith('/assets/art/2D/Monster/'));
    }
});

test('later regions use the grass slime artwork without losing their own identities', () => {
    const slime = monsterDefinitions.find(entry => entry.id === 'MON-EXP-0001');
    const temporary = monsterDefinitions.filter(entry => !['Stormreach', 'Veyrholt'].includes(entry.region));
    assert.equal(temporary.length, 492);
    for (const entry of temporary) {
        assert.equal(entry.imagePlaceholder, true);
        assert.equal(entry.portraitSrc, slime.portraitSrc);
        assert.equal(entry.thumbnailSrc, slime.thumbnailSrc);
        assert.notEqual(entry.name, slime.name);
    }
});

test('the first Skeldrath castle subregion uses the actual final dragon in previews and encounters', () => {
    const dragon = monsterDefinitions.find(entry => entry.name === '백야의 서리룡');
    assert.deepEqual(monstersForStage(monsterDefinitions, { location: 'skeldrath-7', subregion: 'gate' }, true).map(entry => entry.id), [dragon.id]);
    assert.ok(guildDestinationMonsterIds('skeldrath-7', 'gate', true).includes(dragon.id));
    assert.equal(monsterDefinitions.find(entry => entry.location === 'skeldrath-7' && entry.subregion === 'gate' && entry.isBoss).name, '빙벽방패 문지기');
});

test('themed assignments stay balanced and produce valid stats and skills at every level', () => {
    for (const [field, count, minimum, maximum] of [['zodiac', 12, 55, 55], ['job', 6, 110, 110], ['element', 5, 132, 132]]) {
        const values = [...new Set(monsterDefinitions.map((entry) => entry[field]))];
        assert.equal(values.length, count);
        for (const value of values) {
            const total = monsterDefinitions.filter((entry) => entry[field] === value).length;
            assert.ok(total >= minimum && total <= maximum, `${field}: ${value} = ${total}`);
        }
    }
    for (let level = 1; level <= 5; level += 1) {
        const roster = generateRosters(growthRows, level).monsters;
        assert.equal(roster.length, 660);
        for (const entry of roster) {
            assert.equal(entry.level, level);
            assert.ok(Object.values(entry.stats).every(Number.isFinite));
            assert.ok(entry.stats.maxHp > 0);
            assert.equal(entry.skills.length, 4);
            assert.ok(entry.skills[0].isBasicAttack);
            assert.equal(new Set(entry.skills.map((skill) => skill.id)).size, 4);
        }
    }
});


test('regular destination details hide dispatch information and ignore dispatch-only limits', () => {
    const dispatches = Array.from({ length: 4 }, (_, index) => ({ id: index, status: 'active', destination: { location: 'meadow', subregion: 'north' } }));
    const regular = guildDestinationMarkup({ destination: 'meadow', regularExpedition: true, dispatches });
    assert.equal(regular.includes('guild-destination-dispatch-panel'), false);
    assert.match(regular, />원정지 선택<\/button>/);
    assert.doesNotMatch(regular.match(/<button class="guild-destination-select[^]*?<\/button>/)[0], /disabled/);
    const dispatch = guildDestinationMarkup({ destination: 'meadow', dispatches });
    assert.equal(dispatch.includes('guild-destination-dispatch-panel'), true);
    assert.match(dispatch, /파견 한도를 초과 했습니다/);
});
