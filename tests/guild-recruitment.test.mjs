import test from 'node:test';
import assert from 'node:assert/strict';
import { guildRecruitmentRelationship, canInviteGuildMember, recruitGuildMember, levelUpAtWeekStart } from '../src/guild-recruitment.mjs';
const offer = () => ({ id: 'a', name: '테스트 대원', affinity: 30, weeklyWage: 30, stats: { maxHp: 100, attack: 20 } });
const makeState = () => ({ userLevel: 2, experience: 0, experienceToNextLevel: 100, gold: 100, guildMembers: [], recruits: [], plazaOffers: [], plazaGuildInvitedIds: [], affinityByCharacterId: {}, plazaCurrentOffer: offer() });

test('full experience levels up once, discards overflow, and doubles the next requirement', () => {
    const state = makeState();
    state.userLevel = 1;
    state.experience = 150;
    assert.deepEqual(levelUpAtWeekStart(state), { previousLevel: 1, level: 2, maximumExperience: 200 });
    assert.equal(state.experience, 0);
    assert.equal(levelUpAtWeekStart(state), null);
    state.experience = 200;
    levelUpAtWeekStart(state);
    assert.equal(state.userLevel, 3);
    assert.equal(state.experienceToNextLevel, 400);
    state.experience = 399;
    assert.equal(levelUpAtWeekStart(state), null);
});

test('invitation requires level two, enough wage, an open slot, and a new candidate', () => {
    const state = makeState();
    state.userLevel = 1;
    assert.equal(canInviteGuildMember(state), false);
    state.userLevel = 2;
    state.gold = 29;
    assert.equal(canInviteGuildMember(state), false);
    state.gold = 30;
    assert.equal(canInviteGuildMember(state), true);
    state.guildMembers = Array.from({ length: 4 }, (_, i) => ({ id: `b${i}` }));
    assert.equal(canInviteGuildMember(state), false);
    state.guildMembers = [{ id: 'a' }];
    assert.equal(canInviteGuildMember(state), false);
});

test('all relationship boundaries use the displayed success rates', () => {
    const state = makeState();
    for (const [affinity, chance] of [[0,10],[1,30],[10,30],[11,50],[20,50],[21,70],[50,70],[51,90],[90,90],[91,100],[100,100]]) {
        state.affinityByCharacterId.a = affinity;
        assert.equal(guildRecruitmentRelationship(state, offer()).chance, chance);
    }
});

test('acceptance pays the first wage once, joins the guild, and preserves a current party slot', () => {
    const state = makeState();
    const candidate = state.plazaCurrentOffer;
    state.recruits.push({ ...candidate });
    const result = recruitGuildMember(state, candidate, () => 0.49);
    assert.equal(result.success, true);
    assert.equal(state.gold, 70);
    assert.equal(state.guildMembers.length, 1);
    assert.equal(state.guildMembers[0].weeklyWage, 30);
    assert.equal(state.recruits[0].isGuildMember, true);
    assert.equal(state.plazaCurrentOffer, null);
    assert.equal(recruitGuildMember(state, candidate, () => 0), null);
    assert.equal(state.gold, 70);
    state.guildMembers[0].stats.maxHp = 90;
    assert.equal(candidate.stats.maxHp, 100);
});

test('rejection costs nothing and cannot be attempted again until the weekly reset', () => {
    const state = makeState();
    const candidate = state.plazaCurrentOffer;
    assert.equal(recruitGuildMember(state, candidate, () => 0.7).success, false);
    assert.equal(state.gold, 100);
    assert.equal(state.guildMembers.length, 0);
    assert.equal(state.plazaCurrentOffer, candidate);
    assert.equal(recruitGuildMember(state, candidate, () => 0), null);
    state.plazaGuildInvitedIds = [];
    assert.equal(canInviteGuildMember(state), true);
});

test('hostile relationship has a ten percent boundary and soulmates always accept', () => {
    const state = makeState();
    state.affinityByCharacterId.a = 0;
    assert.equal(recruitGuildMember(state, state.plazaCurrentOffer, () => 0.1).success, false);
    state.plazaGuildInvitedIds = [];
    assert.equal(recruitGuildMember(state, state.plazaCurrentOffer, () => 0.099999).success, true);
    state.guildMembers = [];
    state.plazaCurrentOffer = offer();
    state.plazaGuildInvitedIds = [];
    state.affinityByCharacterId.a = 100;
    assert.equal(recruitGuildMember(state, state.plazaCurrentOffer, () => 0.999999).success, true);
});
