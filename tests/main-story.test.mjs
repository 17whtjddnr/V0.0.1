import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import XLSX from 'xlsx';
import { mainStoryScenes, storyCast } from '../src/main-story-data.mjs';
import { currentMainStory, beginMainStory, advanceMainStory, recruitStoryCompanion, migrateLysiaConcept, STORY_COMPANION_ID, LYSIA_COMPANION_ID } from '../src/main-story.mjs';
import { guildDestinations } from '../src/guild-destination.mjs';
import { generateRosters } from '../src/roster-generation.mjs';
import { syncGuildProgression } from '../src/character-progression.mjs';

const stateFor = (location = 'meadow') => ({ view: 'expedition', room: 0, tutorial: {stage: 'done'},
    expeditionDestination: { location, subregion: guildDestinations[location].subregions[0][0] } });
const finish = state => { let result; do { result = advanceMainStory(state); } while (result && !result.finished); return result; };

test('all 45 destinations have short scenes and a closing scene, with one extra Meadow boss scene', () => {
    const ids = Object.keys(guildDestinations);
    assert.equal(mainStoryScenes.length, 96);
    assert.equal(new Set(mainStoryScenes.map(scene => scene.id)).size, 96);
    for (const id of ids) {
        const scenes = mainStoryScenes.filter(scene => scene.location === id && scene.trigger !== 'epilogue');
        assert.equal(scenes.length, id === 'meadow' ? 3 : 2);
        assert.equal(scenes.filter(scene => scene.trigger === 'result').length, 1);
        for (const scene of scenes) {
            assert.ok(scene.lines.length >= 3 && scene.lines.length <= 7);
            for (const line of scene.lines) {
                assert.ok(storyCast[line.speaker]);
                assert.ok(line.text.length <= 160);
            }
        }
    }
});

test('story is excluded from tutorials, dispatch and every other subregion', () => {
    for (const scene of mainStoryScenes) {
        const state = stateFor(scene.location);
        state.room = scene.room || 0;
        state.tutorial.stage = 'battle';
        assert.equal(beginMainStory(state, guildDestinations, scene.trigger, 'explore'), false);
        state.tutorial.stage = 'done';
        state.view = 'guild';
        assert.equal(beginMainStory(state, guildDestinations, scene.trigger, 'explore'), false);
        state.view = 'expedition';
        state.expeditionDestination.subregion = guildDestinations[scene.location].subregions[1][0];
        assert.equal(beginMainStory(state, guildDestinations, scene.trigger, 'explore'), false);
    }
});

test('a finished scene is not replayed but its separate closing scene still plays', () => {
    const state = stateFor();
    assert.equal(beginMainStory(state, guildDestinations, 'start', 'explore'), true);
    assert.equal(advanceMainStory(state).finished, false);
    assert.equal(currentMainStory(state).index, 1);
    const restored = JSON.parse(JSON.stringify(state));
    assert.equal(currentMainStory(restored).index, 1);
    assert.equal(finish(restored).resume, 'explore');
    assert.equal(beginMainStory(restored, guildDestinations, 'start', 'explore'), false);
    assert.equal(beginMainStory(restored, guildDestinations, 'result', 'result'), true);
    assert.equal(finish(restored).resume, 'result');
    assert.equal(beginMainStory(restored, guildDestinations, 'result', 'result'), false);
});

test('room scenes only start in their assigned room and persist the room continuation', () => {
    const state = stateFor('mistwood');
    assert.equal(beginMainStory(state, guildDestinations, 'start', 'explore'), false);
    assert.equal(beginMainStory(state, guildDestinations, 'room', 'room'), false);
    state.room = 2;
    assert.equal(beginMainStory(state, guildDestinations, 'room', 'room'), true);
    assert.equal(finish(state).resume, 'room');
});

test('Meadow boss scene resolves the chosen boss name and preserves it across saves', () => {
    const state = stateFor();
    state.room = 6;
    assert.equal(beginMainStory(state, guildDestinations, 'boss', 'room'), true);
    state.mainStory.active.bossName = 'Actual boss';
    assert.ok(currentMainStory(state).line.text.includes('Actual boss'));
    const restored = JSON.parse(JSON.stringify(state));
    assert.ok(currentMainStory(restored).line.text.includes('Actual boss'));
    assert.equal(finish(restored).resume, 'room');
    assert.equal(beginMainStory(restored, guildDestinations, 'boss', 'room'), false);
});

test('the free companion is granted once after the early Veyrholt scene and retains independent growth', () => {
    const workbook = XLSX.read(readFileSync(new URL('../public/data/import/Zodiac_Stats_Merged.xlsx', import.meta.url)), { type: 'buffer' });
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets['성장분해'], { header: 1, defval: '', blankrows: false });
    const growthRows = rows.slice(6).map(row => Object.fromEntries(rows[5].map((key, index) => [key, row[index]])));
    const base = generateRosters(growthRows, 1).characters.find(character => character.id === STORY_COMPANION_ID);
    const state = { ...stateFor('veyrholt-1'), userLevel: 3, gold: 50, guildMembers: [], recruits: [] };
    beginMainStory(state, guildDestinations, 'start', 'explore');
    assert.equal(advanceMainStory(state).recruit, undefined);
    assert.equal(state.guildMembers.length, 0);
    assert.equal(finish(state).recruit, true);
    const member = recruitStoryCompanion(state, base, growthRows);
    assert.equal(member.id, STORY_COMPANION_ID);
    assert.equal(member.level, 1);
    assert.equal(member.weeklyWage, 0);
    assert.equal(member.isGuildMember, true);
    assert.equal(state.gold, 50);
    assert.equal(recruitStoryCompanion(state, base, growthRows), member);
    syncGuildProgression(state, [], growthRows);
    assert.equal(member.weeklyWage, 0);
    assert.equal(member.contractWeeklyWage, 0);
    assert.equal(member.level, 1);
    assert.equal(state.guildMembers.length, 1);
});

test('Eldermere recruits the two-handed warrior once after the boss, with capped independent growth and a fixed contract', () => {
    const workbook = XLSX.read(readFileSync(new URL('../public/data/import/Zodiac_Stats_Merged.xlsx', import.meta.url)), { type: 'buffer' });
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets['성장분해'], { header: 1, defval: '', blankrows: false });
    const growthRows = rows.slice(6).map(row => Object.fromEntries(rows[5].map((key, index) => [key, row[index]])));
    const base = generateRosters(growthRows, 1).characters.find(character => character.job === '전사' && character.grade === 5);
    const state = { ...stateFor('eldermere-1'), userLevel: 3, gold: 50, guildMembers: [], recruits: [] };
    assert.ok(beginMainStory(state, guildDestinations, 'start', 'explore'));
    assert.equal(finish(state).recruit, false);
    assert.ok(beginMainStory(state, guildDestinations, 'result', 'result'));
    const result = finish(state);
    assert.equal(result.recruitKey, 'lysia');
    const member = recruitStoryCompanion(state, base, growthRows, [], result.recruitKey);
    assert.equal(member.id, LYSIA_COMPANION_ID);
    assert.equal(member.name, '비올라');
    assert.equal(member.grade, 5);
    assert.equal(member.job, '전사');
    assert.equal(member.weapon, '양손 전투망치');
    assert.equal(member.level, 3);
    assert.equal(member.experienceToNextLevel, 400);
    assert.equal(member.weeklyWage, 255);
    assert.equal(member.contractWeeklyWage, 255);
    assert.equal(member.price, 0);
    assert.equal(member.wageExempt, false);
    assert.equal(member.skills.length, 4);
    assert.equal(state.gold, 50);
    assert.equal(recruitStoryCompanion(state, base, growthRows, [], 'lysia'), member);
    state.userLevel = 4;
    syncGuildProgression(state, [], growthRows);
    assert.equal(member.level, 3);
    assert.equal(member.weeklyWage, 255);
    assert.equal(state.guildMembers.length, 1);
});

test('the royal invitation chains five saved scenes, then ends aboard the Carewyn ship before rewards', () => {
    const state = stateFor('skeldrath-7');
    assert.ok(beginMainStory(state, guildDestinations, 'result', 'result'));
    let guard = 100;
    while (currentMainStory(state)?.scene.id !== 'part1.bran.prison' && guard--) advanceMainStory(state);
    assert.ok(guard > 0);
    assert.equal(state.mainStory.partOneComplete, undefined);
    const restored = structuredClone(state);
    assert.equal(currentMainStory(restored).scene.background, 'battle-dungeon');
    assert.equal(finish(restored).resume, 'result');
    assert.equal(restored.mainStory.partOneComplete, true);
    assert.equal(restored.mainStory.active, null);
    for (const id of ['part1.bran.arrival', 'part1.bran.court', 'part1.bran.prison', 'part1.bran.escape', 'part1.carewyn.ship']) assert.ok(restored.mainStory.seen.includes(id));
    assert.equal(beginMainStory(restored, guildDestinations, 'result', 'result'), false);
    const oldSave = { ...stateFor('skeldrath-7'), mainStory: { seen: ['skeldrath.07.end'], active: null } };
    assert.ok(beginMainStory(oldSave, guildDestinations, 'result', 'result'));
    assert.equal(currentMainStory(oldSave).scene.id, 'part1.bran.arrival');
});

test('all scenes including the epilogue use valid speakers, short lines, and available original backgrounds', () => {
    for (const scene of mainStoryScenes) {
        assert.ok(scene.lines.length >= 3 && scene.lines.length <= 7, scene.id);
        for (const line of scene.lines) {
            assert.ok(storyCast[line.speaker], `${scene.id}: ${line.speaker}`);
            assert.ok(line.text.length <= 160, `${scene.id}: ${line.text.length}`);
        }
        if (scene.background) assert.ok(existsSync(new URL(`../public/assets/backgrounds/${scene.background}.webp`, import.meta.url)));
    }
    assert.ok(mainStoryScenes.find(scene => scene.partOneEnd).lines.some(line => line.text.includes('케어윈')));
    assert.ok(mainStoryScenes.find(scene => scene.id === 'part1.bran.prison').lines.some(line => line.text.includes('로웬') && line.text.includes('이네스')));
    assert.ok(!mainStoryScenes.some(scene => scene.lines.some(line => line.speaker === 'isa' || line.speaker === 'girl')));
});

test('existing Lysia copies become warriors without changing contracts, experience or current health ratio', () => {
    const workbook = XLSX.read(readFileSync(new URL('../public/data/import/Zodiac_Stats_Merged.xlsx', import.meta.url)), { type: 'buffer' });
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets['성장분해'], { header: 1, defval: '', blankrows: false });
    const growthRows = rows.slice(6).map(row => Object.fromEntries(rows[5].map((key, index) => [key, row[index]])));
    const base = generateRosters(growthRows, 3).characters.find(character => character.job === '마도사' && character.grade === 5);
    const original = { ...base, id: LYSIA_COMPANION_ID, storyCompanion: true, name: '리시아', level: 3, hp: base.stats.maxHp / 2, maxHp: base.stats.maxHp,
        experience: 200, experienceToNextLevel: 400, weeklyWage: 170, contractWeeklyWage: 170, effects: [], cooldowns: {} };
    const state = { guildMembers: [original], recruits: [structuredClone(original)] };
    const party = [structuredClone(original)];
    migrateLysiaConcept(state, party, growthRows);
    for (const member of [...state.guildMembers, ...state.recruits, ...party]) {
        assert.equal(member.job, '전사');
        assert.equal(member.weapon, '양손 전투망치');
        assert.equal(member.experience, 200);
        assert.equal(member.weeklyWage, 170);
        assert.equal(member.contractWeeklyWage, 170);
        assert.ok(Math.abs(member.hp / member.maxHp - .5) < .02);
        assert.equal(member.skills.length, 4);
        assert.ok(member.portraitSrc.split('?')[0].endsWith('0005_F_W.webp'));
    }
    const before = structuredClone(state);
    migrateLysiaConcept(state, party, growthRows);
    assert.deepEqual(state, before);
});
