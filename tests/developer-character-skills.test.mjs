import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import XLSX from 'xlsx';
import { generateRosters } from '../src/roster-generation.mjs';

registerHooks({ load(url, context, nextLoad) {
    if (url.endsWith('/src/skill-balance.js')) return { format: 'module', source: readFileSync(fileURLToPath(url), 'utf8'), shortCircuit: true };
    return nextLoad(url, context);
} });
const stored = new Map();
globalThis.localStorage = { getItem: (key) => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value) };
const developerSkills = await import('../src/developer-skills.mjs');
const workbook = XLSX.read(readFileSync(new URL('../public/data/import/Zodiac_Stats_Merged.xlsx', import.meta.url)), { type: 'buffer' });
const rows = XLSX.utils.sheet_to_json(workbook.Sheets['성장분해'], { header: 1, defval: '', blankrows: false });
const growthRows = rows.slice(6).map((row) => Object.fromEntries(rows[5].map((key, index) => [key, row[index]])));
const pool = Array.from({ length: 5 }, (_, index) => ({ id: 'ASSIGN_' + index, name: '배정 스킬 ' + index, target: '적', cooldown: index, effects: [], damageCoefficients: [1, 0, 0, 0], healingCoefficients: [0, 0], isBasicAttack: index === 0 }));
developerSkills.configureDeveloperSkills(pool);
let sequence = 0;
async function fresh() {
    const dev = await import('../src/developer-characters.mjs?skills-test=' + sequence++);
    dev.configureDeveloperCharacters(growthRows, pool);
    return dev;
}

test('four assigned skill IDs preserve order across levels, jobs, stale combat snapshots and reloads', async () => {
    stored.clear();
    const dev = await fresh();
    const original = generateRosters(growthRows, 1).characters[0];
    const ids = ['ASSIGN_4', 'ASSIGN_2', 'ASSIGN_0', 'ASSIGN_3'];
    dev.saveCharacterEdit(original, { skillIds: ids });
    ids.reverse(); // Saving must own its data rather than the caller array.
    const expected = ['ASSIGN_4', 'ASSIGN_2', 'ASSIGN_0', 'ASSIGN_3'];
    assert.deepEqual(dev.characterSkills({ ...original, skills: [{ id: 'stale' }] }).map((skill) => skill.id), expected);
    for (let level = 1; level <= 5; level++) {
        const entry = generateRosters(growthRows, level).characters[0];
        const otherJob = growthRows.find((row) => row['직업'] !== entry.job)['직업'];
        dev.saveCharacterEdit(entry, { job: otherJob });
        assert.deepEqual(dev.developerCharacter(entry).skills.map((skill) => skill.id), expected);
        assert.equal(dev.developerCharacter(entry).level, level);
    }
    assert.deepEqual((await fresh()).characterSkillIds(original), expected);
});

test('invalid, duplicate, incomplete and disabled assignments cannot overwrite the saved loadout', async () => {
    stored.clear();
    const dev = await fresh();
    const original = generateRosters(growthRows, 1).characters[0];
    const ids = pool.slice(0, 4).map((skill) => skill.id);
    dev.saveCharacterEdit(original, { skillIds: ids });
    for (const invalid of [[], ids.slice(0, 3), [...ids, 'ASSIGN_4'], ['ASSIGN_0', 'ASSIGN_0', 'ASSIGN_2', 'ASSIGN_3'], ['missing', ...ids.slice(1)]]) {
        assert.throws(() => dev.saveCharacterEdit(original, { skillIds: invalid }));
        assert.deepEqual(dev.characterSkillIds(original), ids);
    }
    developerSkills.saveSkillSettings('ASSIGN_4', { enabled: false });
    assert.throws(() => dev.saveCharacterEdit(original, { skillIds: ['ASSIGN_4', ...ids.slice(1)] }));
    developerSkills.saveSkillSettings('ASSIGN_4', { enabled: true });
});

test('assigned skills reflect skill editing and disabling without substituting default skills', async () => {
    stored.clear();
    const dev = await fresh();
    const original = generateRosters(growthRows, 1).characters[0];
    const ids = pool.slice(0, 4).map((skill) => skill.id);
    dev.saveCharacterEdit(original, { skillIds: ids });
    developerSkills.saveSkillSettings('ASSIGN_0', { values: { ...pool[0], name: '수정된 배정 스킬' } });
    assert.equal(dev.characterSkills(original)[0].name, '수정된 배정 스킬');
    for (const id of ids) developerSkills.saveSkillSettings(id, { enabled: false });
    assert.deepEqual(dev.characterSkills(original, [{ id: 'fallback' }]), []);
    assert.deepEqual(dev.characterSkillIds(original), ids);
    for (const id of ids) developerSkills.saveSkillSettings(id, { enabled: true });
});

test('characters without manual assignments retain their existing automatic skills', async () => {
    stored.clear();
    const dev = await fresh();
    const original = generateRosters(growthRows, 1).characters[0];
    assert.deepEqual(dev.developerCharacter(original).skills, developerSkills.activeSkills(original.skills));
    assert.deepEqual(dev.characterSkills({ id: 'CHAR-OLD', skills: [] }, pool), developerSkills.activeSkills(pool));
});
