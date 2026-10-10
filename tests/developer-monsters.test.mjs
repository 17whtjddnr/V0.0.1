import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import XLSX from 'xlsx';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';

// Vite treats application .js files as ES modules despite the root CommonJS package.
registerHooks({ load(url, context, nextLoad) {
    if (url.endsWith('/src/skill-balance.js')) return { format: 'module', source: readFileSync(fileURLToPath(url), 'utf8'), shortCircuit: true };
    return nextLoad(url, context);
} });
import { generateRosters, applyRosterProfile } from '../src/roster-generation.mjs';
import { monstersForStage } from '../src/monster-catalog.mjs';

const workbook = XLSX.read(readFileSync(new URL('../public/data/import/Zodiac_Stats_Merged.xlsx', import.meta.url)), { type: 'buffer' });
const rows = XLSX.utils.sheet_to_json(workbook.Sheets['성장분해'], { header: 1, defval: '', blankrows: false });
const growthRows = rows.slice(6).map((row) => Object.fromEntries(rows[5].map((key, index) => [key, row[index]])));
const storageKey = 'game-developer-monsters-v1';
let stored = new Map();
let failWrite = false;
globalThis.localStorage = {
    getItem: (key) => stored.get(key) ?? null,
    setItem: (key, value) => { if (failWrite) throw Error('Storage full'); stored.set(key, value); },
};
let sequence = 0;
async function fresh() {
    const module = await import('../src/developer-monsters.mjs?test=' + sequence++);
    module.configureDeveloperMonsters(growthRows, []);
    return module;
}

test('monster edits recalculate each level without changing stage identity or boss role', async () => {
    stored = new Map();
    const dev = await fresh();
    const base = generateRosters(growthRows, 5).monsters[0];
    const other = generateRosters(growthRows, 5).monsters.find((entry) => entry.job !== base.job && entry.zodiac !== base.zodiac);
    const changes = { name: '편집한 몬스터', element: other.element, zodiac: other.zodiac, job: other.job, grade: 5, portraitSrc: '/custom/full.webp', thumbnailSrc: '/custom/thumb.webp' };
    dev.saveMonsterEdit(base, changes);
    for (let level = 1; level <= 5; level++) {
        const original = generateRosters(growthRows, level).monsters[0];
        const effective = dev.developerMonster(original);
        assert.deepEqual(effective.stats, applyRosterProfile(original, changes, growthRows).stats);
        assert.deepEqual(effective.skills, applyRosterProfile(original, changes, growthRows).skills);
        assert.equal(effective.name, changes.name);
        assert.equal(effective.portraitSrc, changes.portraitSrc);
        assert.equal(effective.thumbnailSrc, changes.thumbnailSrc);
        for (const key of ['id', 'location', 'subregion', 'stageName', 'size', 'concept', 'isBoss']) assert.equal(effective[key], original[key]);
        assert.equal(effective.isBoss, false); // Grade 5 does not turn an ordinary monster into a boss.
    }
    const reloaded = await fresh();
    assert.equal(reloaded.developerMonster(base).name, changes.name);
    assert.equal(reloaded.monsterEnabled(base.id), true);
    assert.equal(stored.has('game-developer-characters-v1'), false);
});

test('activation persists independently of edits and excludes only disabled stage monsters', async () => {
    stored = new Map();
    const dev = await fresh();
    const roster = generateRosters(growthRows, 3).monsters;
    const base = roster[0];
    dev.saveMonsterSettings(base.id, { enabled: false });
    dev.saveMonsterEdit(base, { name: '비활성 몬스터' });
    assert.equal(dev.monsterEnabled(base.id), false);
    const effective = roster.map(dev.developerMonster).filter((entry) => dev.monsterEnabled(entry.id));
    assert.equal(monstersForStage(effective, base).length, 2);
    assert.equal(monstersForStage(effective, base, true).length, 1);
    const reloaded = await fresh();
    assert.equal(reloaded.monsterEnabled(base.id), false);
    reloaded.saveMonsterSettings(base.id, { enabled: true });
    assert.equal(reloaded.developerMonster(base).name, '비활성 몬스터');
    assert.equal(reloaded.monsterEnabled(base.id), true);
});

test('image reset restores original monster assets and failed storage writes keep prior state', async () => {
    stored = new Map();
    const dev = await fresh();
    const base = generateRosters(growthRows, 5).monsters[0];
    dev.saveMonsterEdit(base, { portraitSrc: '/custom.webp', thumbnailSrc: '/custom-thumb.webp' });
    dev.saveMonsterEdit(base, { portraitSrc: '', thumbnailSrc: '' });
    assert.equal(dev.developerMonster(base).portraitSrc, base.portraitSrc);
    assert.equal(dev.developerMonster(base).thumbnailSrc, base.thumbnailSrc);
    failWrite = true;
    try { assert.throws(() => dev.saveMonsterSettings(base.id, { enabled: false }), /Storage full/); }
    finally { failWrite = false; }
    assert.equal(dev.monsterEnabled(base.id), true);
    assert.equal((await fresh()).monsterEnabled(base.id), true);
});

test('invalid local storage safely falls back to original definitions', async () => {
    for (const value of ['{broken', 'null', '[]']) {
        stored = new Map([[storageKey, value]]);
        const dev = await fresh();
        const base = generateRosters(growthRows, 1).monsters[0];
        assert.deepEqual(dev.developerMonster(base), base);
        assert.equal(dev.monsterEnabled(base.id), true);
    }
});
