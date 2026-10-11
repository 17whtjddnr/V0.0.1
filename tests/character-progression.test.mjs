import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import XLSX from 'xlsx';
import { generateRosters, applyRosterProfile } from '../src/roster-generation.mjs';
import { recruitmentTerms, encounterLevel, syncGuildProgression, awardCharacterExperience, levelUpCharactersAtWeekStart } from '../src/character-progression.mjs';
import { recruitGuildMember, levelUpAtWeekStart } from '../src/guild-recruitment.mjs';
import { createMasterCharacter, MASTER_CHARACTER_ID } from '../src/master-character.mjs';
import { experienceRequired } from '../src/experience-progression.mjs';

const workbook = XLSX.read(readFileSync(new URL('../public/data/import/Zodiac_Stats_Merged.xlsx', import.meta.url)), { type: 'buffer' });
const rows = XLSX.utils.sheet_to_json(workbook.Sheets['성장분해'], { header: 1, defval: '', blankrows: false });
const growthRows = rows.slice(6).map((row) => Object.fromEntries(rows[5].map((key, index) => [key, row[index]])));
const roster = generateRosters(growthRows, 1).characters;
const profile = roster.find((member) => member.grade === 3);
const actor = (entry = profile) => ({ ...structuredClone(entry), ...recruitmentTerms(entry), isGuildMember: true,
    baseStats: { ...entry.stats }, hp: entry.stats.maxHp, maxHp: entry.stats.maxHp, effects: [], cooldowns: {} });

test('characters at the player cap retain at most full experience until the player levels up', () => {
    const member = actor();
    const state = { userLevel: 1, guildMembers: [member], recruits: [structuredClone(member)] };
    awardCharacterExperience(state, [member], 450);
    assert.equal(member.experience, 100);
    levelUpCharactersAtWeekStart(state, [], growthRows);
    assert.equal(member.level, 1);
    assert.equal(member.experience, 100);
    awardCharacterExperience(state, [member], 50);
    assert.equal(member.experience, 100);
    state.userLevel = 2;
    levelUpCharactersAtWeekStart(state, [], growthRows);
    assert.equal(member.level, 2);
    assert.equal(member.experience, 0);
    assert.equal(state.recruits[0].level, 2);
    awardCharacterExperience(state, [member], 500);
    levelUpCharactersAtWeekStart(state, [], growthRows);
    assert.equal(member.level, 2);
    assert.equal(member.experience, 200);
});

test('over-level saved characters and their copies are capped with stats and fixed wages preserved', () => {
    const member = actor(applyRosterProfile(profile, { level: 4 }, growthRows));
    member.experience = 999;
    const state = { userLevel: 2, guildMembers: [member], recruits: [structuredClone(member)] };
    syncGuildProgression(state, [], growthRows);
    for (const copy of [member, state.recruits[0]]) {
        assert.equal(copy.level, 2);
        assert.equal(copy.experience, 200);
        assert.equal(copy.experienceToNextLevel, 200);
        assert.deepEqual(copy.stats, applyRosterProfile(profile, { level: 2 }, growthRows).stats);
        assert.equal(copy.weeklyWage, 120);
    }
});

test('only expedition participants gain experience and different levels follow the player table', () => {
    const first = actor();
    const second = actor(applyRosterProfile(roster[1], { level: 3 }, growthRows));
    const waiting = actor(roster[2]);
    const state = { userLevel: 8, guildMembers: [first, second, waiting], recruits: [] };
    const party = [structuredClone(first), structuredClone(second)];
    syncGuildProgression(state, party, growthRows);
    awardCharacterExperience(state, party, 50);
    levelUpCharactersAtWeekStart(state, party, growthRows);
    assert.deepEqual(state.guildMembers.map(member => member.experience), [50, 50, 0]);
    assert.deepEqual(state.guildMembers.map(member => member.level), [1, 3, 1]);
    assert.equal(second.experienceToNextLevel, experienceRequired(3));
    assert.equal(second.experienceToNextLevel, 400);
    awardCharacterExperience(state, party, 50);
    levelUpCharactersAtWeekStart(state, party, growthRows);
    assert.equal(first.level, 2);
    assert.equal(first.experience, 0);
    assert.equal(first.experienceToNextLevel, 200);
    assert.equal(second.level, 3);
    assert.equal(second.experience, 100);
    assert.equal(party[0].level, 2);
    assert.equal(party[1].experience, 100);
    const restored = JSON.parse(JSON.stringify(state));
    syncGuildProgression(restored, [], growthRows);
    assert.deepEqual(restored.guildMembers, state.guildMembers);
});

test('characters share player weekly timing, overflow reset and one level per week', () => {
    const member = actor();
    const state = { userLevel: 1, experience: 450, guildMembers: [member], recruits: [] };
    awardCharacterExperience(state, [member], 450);
    assert.equal(member.level, 1);
    levelUpAtWeekStart(state);
    levelUpCharactersAtWeekStart(state, [], growthRows);
    assert.equal(member.level, state.userLevel);
    assert.equal(member.experience, state.experience);
    assert.equal(member.experienceToNextLevel, state.experienceToNextLevel);
    levelUpCharactersAtWeekStart(state, [], growthRows);
    assert.equal(member.level, 2);
});

test('recruitment price and starting wage grow with level while free characters remain free', () => {
    for (const [grade, base] of [[3, 30], [4, 55], [5, 85]]) {
        for (const level of [1, 2, 3, 4, 5, 8]) {
            assert.deepEqual(recruitmentTerms({ grade, level }), { price: base * level, weeklyWage: base * level });
        }
    }
    assert.deepEqual(recruitmentTerms({ grade: 5, level: 8, wageExempt: true }), { price: 0, weeklyWage: 0 });
});

test('encounter levels range from one through player level, including both endpoints', () => {
    for (const playerLevel of [1, 2, 5, 8]) {
        assert.equal(encounterLevel(playerLevel, () => 0), 1);
        assert.equal(encounterLevel(playerLevel, () => .999999), playerLevel);
        assert.equal(encounterLevel(playerLevel, () => 1), playerLevel);
        for (const roll of [.1, .25, .5, .75, .9]) {
            const level = encounterLevel(playerLevel, () => roll);
            assert.ok(level >= 1 && level <= playerLevel);
        }
    }
});

test('character experience levels up independently while preserving health ratio, effects and contracts', () => {
    const member = actor();
    member.hp = member.maxHp / 2;
    member.effects = [{ code: 'ATTACK_UP', value: .3, turnsRemaining: 2 }];
    member.cooldowns = { skill: 2 };
    const selected = structuredClone(member);
    const fighter = structuredClone(member);
    fighter.hp = 0;
    const mercenary = { ...actor(roster[1]), isGuildMember: false };
    const state = { userLevel: 1, experience: 100, experienceToNextLevel: 100,
        guildMembers: [member], recruits: [selected, mercenary] };
    awardCharacterExperience(state, [fighter, fighter], 100);
    levelUpAtWeekStart(state);
    levelUpCharactersAtWeekStart(state, [fighter], growthRows);
    const expected = applyRosterProfile(profile, { level: 2 }, growthRows);
    for (const copy of [member, selected, fighter]) {
        assert.equal(copy.level, 2);
        assert.deepEqual(copy.stats, expected.stats);
        assert.deepEqual(copy.baseStats, expected.stats);
        assert.equal(copy.weeklyWage, 30);
        assert.equal(copy.contractWeeklyWage, 30);
        assert.deepEqual(copy.effects, member.effects);
        assert.deepEqual(copy.cooldowns, { skill: 2 });
    }
    assert.equal(member.hp, Math.max(1, Math.round(expected.stats.maxHp / 2)));
    assert.equal(fighter.hp, 0);
    assert.equal(mercenary.level, 1);
    selected.stats.attack = 999;
    assert.notEqual(member.stats.attack, 999);
});

test('a lower level recruit retains its own level, experience and contract across player level ups and saves', () => {
    const offer = { ...profile, ...recruitmentTerms(profile), affinity: 100 };
    const state = { userLevel: 3, gold: 1000, guildMembers: [], recruits: [], plazaOffers: [offer],
        plazaCurrentOffer: offer, plazaGuildInvitedIds: [], affinityByCharacterId: {} };
    assert.equal(recruitGuildMember(state, offer, () => 0).success, true);
    syncGuildProgression(state, [], growthRows);
    assert.equal(state.guildMembers[0].level, 1);
    assert.equal(state.guildMembers[0].experience, 0);
    assert.equal(state.guildMembers[0].experienceToNextLevel, 100);
    assert.equal(state.guildMembers[0].weeklyWage, 30);
    assert.equal(state.guildMembers[0].price, 30);
    const restored = JSON.parse(JSON.stringify(state));
    restored.userLevel = 5;
    syncGuildProgression(restored, [], growthRows);
    assert.equal(restored.guildMembers[0].level, 1);
    assert.equal(restored.guildMembers[0].weeklyWage, 30);
    assert.equal(recruitmentTerms({ ...profile, level: 5 }).weeklyWage, 150);
});

test('master grows with its own experience at the chosen zodiac and retains zero wage', () => {
    const base = roster.find((member) => member.id === MASTER_CHARACTER_ID);
    const master = createMasterCharacter(base, '양자리', growthRows);
    const state = { userLevel: 4, playerZodiac: '양자리', guildMembers: [master], recruits: [structuredClone(master)] };
    for (let i = 0; i < 3; i++) {
        awardCharacterExperience(state, [state.recruits[0]], 100 * 2 ** i);
        levelUpCharactersAtWeekStart(state, [], growthRows);
    }
    for (const copy of [master, state.recruits[0]]) {
        assert.equal(copy.level, 4);
        assert.equal(copy.zodiac, '양자리');
        assert.deepEqual(copy.stats, applyRosterProfile(base, { level: 4, zodiac: '양자리' }, growthRows).stats);
        assert.equal(copy.weeklyWage, 0);
        assert.equal(copy.contractWeeklyWage, 0);
    }
});

test('existing saves freeze their stored wage and repeated synchronization does not heal or reset combat state', () => {
    const member = { ...actor(), weeklyWage: 17 };
    const state = { userLevel: 3, guildMembers: [member], recruits: [] };
    syncGuildProgression(state, [], growthRows);
    member.hp = 1;
    member.effects.push({ code: 'POISON', turnsRemaining: 2 });
    const before = structuredClone(member);
    syncGuildProgression(state, [], growthRows);
    assert.deepEqual(member, before);
    assert.equal(member.contractWeeklyWage, 17);
    state.userLevel = 4;
    syncGuildProgression(state, [], growthRows);
    assert.equal(member.weeklyWage, 17);
});

test('levels beyond the listed workbook continue growth without capping the displayed guild level', () => {
    const before = structuredClone(growthRows);
    const member = actor();
    const state = { userLevel: 8, guildMembers: [member], recruits: [] };
    for (let i = 0; i < 7; i++) {
        awardCharacterExperience(state, [member], 100 * 2 ** i);
        levelUpCharactersAtWeekStart(state, [], growthRows);
    }
    const fifth = applyRosterProfile(profile, { level: 5 }, growthRows);
    assert.equal(member.level, 8);
    assert.ok(member.stats.attack > fifth.stats.attack);
    assert.ok(member.stats.maxHp > fifth.stats.maxHp);
    assert.ok(Object.values(member.stats).every(Number.isFinite));
    assert.equal(member.weeklyWage, 30);
    assert.deepEqual(growthRows, before);
});
