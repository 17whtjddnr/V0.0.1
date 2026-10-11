import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import XLSX from 'xlsx';
import { generateRosters, applyRosterProfile } from '../src/roster-generation.mjs';
import { MASTER_CHARACTER_ID, createMasterCharacter, selectMasterForExpedition, showPartySwap } from '../src/master-character.mjs';
import { guildMemberCount } from '../src/guild-roster.mjs';
import { guildLobbyOverview } from '../src/guild-lobby.mjs';
import { canInviteGuildMember } from '../src/guild-recruitment.mjs';
import { togglePlazaGuildMember } from '../src/plaza-guild-party.mjs';
import { restoreTutorialState, confirmTutorialMilestone } from '../src/tutorial.mjs';

const workbook = XLSX.read(readFileSync(new URL('../public/data/import/Zodiac_Stats_Merged.xlsx', import.meta.url)), { type: 'buffer' });
const rows = XLSX.utils.sheet_to_json(workbook.Sheets['성장분해'], { header: 1, defval: '', blankrows: false });
const growthRows = rows.slice(6).map((row) => Object.fromEntries(rows[5].map((key, index) => [key, row[index]])));
const original = generateRosters(growthRows, 1).characters.find((member) => member.id === MASTER_CHARACTER_ID);
const edited = JSON.parse(readFileSync(new URL('../data/developer/characters.json', import.meta.url), 'utf8'))[MASTER_CHARACTER_ID];
const profile = { ...original, ...edited, skills: [{ id: 'master-skill' }] };
const createMaster = () => createMasterCharacter(profile, '양자리', growthRows);

test('the edited master uses the chosen zodiac growth profile at level one and retains edited identity and skills', () => {
    const before = structuredClone(profile);
    const attackValues = new Set();
    const zodiacs = [...new Set(growthRows.map((row) => row['별자리']))];
    for (const zodiac of zodiacs) {
        const master = createMasterCharacter(profile, zodiac, growthRows);
        const expected = applyRosterProfile(profile, { zodiac, level: 1 }, growthRows);
        assert.equal(master.id, MASTER_CHARACTER_ID);
        assert.equal(master.name, edited.name);
        assert.equal(master.job, edited.job);
        assert.equal(master.zodiac, zodiac);
        assert.equal(master.level, 1);
        assert.deepEqual(master.stats, expected.stats);
        assert.deepEqual(master.baseStats, expected.stats);
        assert.deepEqual(master.skills, profile.skills);
        assert.equal(master.hp, expected.stats.maxHp);
        assert.equal(master.isGuildMember, true);
        assert.equal(master.guildCapacityExempt, true);
        assert.equal(master.weeklyWage, 0);
        attackValues.add(master.stats.attack);
    }
    assert.ok(attackValues.size > 1);
    assert.deepEqual(profile, before);
});

test('master is selected in slot one without duplicate copies and can be swapped and reselected as a guild member', () => {
    const master = createMaster();
    const companion = { id: 'CHAR-208', isGuildMember: true, stats: { maxHp: 3 } };
    const state = { guildMembers: [master, companion], recruits: [companion] };
    assert.equal(selectMasterForExpedition(state), true);
    assert.equal(selectMasterForExpedition(state), true);
    assert.deepEqual(state.recruits.map((member) => member.id), [MASTER_CHARACTER_ID, companion.id]);
    assert.notEqual(state.recruits[0].stats, master.stats);
    assert.equal(togglePlazaGuildMember(state, MASTER_CHARACTER_ID), true);
    assert.deepEqual(state.recruits.map((member) => member.id), [companion.id]);
    assert.equal(togglePlazaGuildMember(state, MASTER_CHARACTER_ID), true);
    assert.equal(state.recruits[0].id, MASTER_CHARACTER_ID);
    assert.equal(state.guildMembers.length, 2);
});

test('master leaves all four paid guild slots available and contributes no weekly wage', () => {
    const state = {
        userLevel: 2, gold: 1000, guildMembers: [createMaster()], recruits: [],
        plazaCurrentOffer: { id: 'candidate', weeklyWage: 30 },
    };
    assert.equal(guildMemberCount(state), 0);
    for (let index = 0; index < 4; index++) {
        assert.equal(canInviteGuildMember(state), true);
        state.guildMembers.push({ id: `member-${index}`, weeklyWage: 30 });
    }
    assert.equal(state.guildMembers.length, 5);
    assert.equal(guildMemberCount(state), 4);
    assert.equal(canInviteGuildMember(state), false);
    const overview = guildLobbyOverview(state);
    assert.equal(overview.memberCount, 4);
    assert.equal(overview.weeklyWages, 120);
});

test('master and selection survive tutorial saves and swap appears only after the final milestone', () => {
    const master = createMaster();
    const state = { tutorial: { stage: 'meeting' }, guildMembers: [master], recruits: [] };
    selectMasterForExpedition(state);
    state.recruits.push({ id: 'CHAR-208' }, { id: 'mercenary-1' }, { id: 'mercenary-2' });
    assert.equal(state.recruits.length, 4);
    const saved = JSON.parse(JSON.stringify(state));
    const restored = {};
    assert.equal(restoreTutorialState(restored, saved), true);
    assert.equal(restored.recruits[0].id, MASTER_CHARACTER_ID);
    assert.equal(restored.recruits[0].zodiac, '양자리');
    assert.deepEqual(restored.recruits[0].stats, master.stats);
    for (const stage of ['meeting', 'hire-first', 'depart', 'battle', 'founding-story', 'rent', 'final-popup']) {
        assert.equal(showPartySwap({ stage }, master, true), false);
        assert.equal(showPartySwap({ stage }, master, false), false);
    }
    restored.tutorial.stage = 'final-popup';
    confirmTutorialMilestone(restored);
    assert.equal(showPartySwap(restored.tutorial, restored.recruits[0], true), true);
    assert.equal(showPartySwap({ stage: 'done' }, { isGuildMember: false }, true), false);
});
