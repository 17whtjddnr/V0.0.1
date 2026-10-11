import { mainStoryScenes } from './main-story-data.mjs';
import { characterPortraitAsset, characterThumbnailAsset } from './character-assets.mjs';
import { applyRosterProfile } from './roster-generation.mjs';
import { experienceRequired } from './experience-progression.mjs';
import { recruitmentTerms } from './character-progression.mjs';
import { storyCompanionNames, storyCompanionIds } from './character-identity.mjs';
import { consolidateCharacterRecords } from './character-deduplication.mjs';

export const STORY_COMPANION_ID = storyCompanionIds.lora;
export const LYSIA_COMPANION_ID = storyCompanionIds.lysia;

export function syncWillowArtwork(state, party, profile) {
    if (!profile) return;
    for (const member of new Set([...(state.guildMembers || []), ...(state.recruits || []), ...party])) {
        if (member.id !== STORY_COMPANION_ID) continue;
        member.portraitSrc = profile.portraitSrc || characterPortraitAsset('0069_F_M.webp');
        member.thumbnailSrc = profile.thumbnailSrc || characterThumbnailAsset('0069_F_M.webp');
    }
}

export function currentMainStory(state) {
    const active = state.mainStory?.active;
    const scene = mainStoryScenes.find(scene => scene.id === active?.id);
    const line = scene?.lines[active?.line || 0];
    return line ? { scene, line: { ...line, text: line.text.replaceAll('{{bossName}}', active.bossName || '괴물') }, index: active.line || 0 } : null;
}

export function beginMainStory(state, destinations, trigger, resume) {
    if (state.view !== 'expedition' || state.tutorial?.stage && state.tutorial.stage !== 'done') return false;
    if (currentMainStory(state)) return true;
    const destination = state.expeditionDestination;
    const location = destinations[destination?.location];
    if (!location || destination.subregion !== location.subregions[0]?.[0]) return false;
    state.mainStory ||= { seen: [], active: null };
    state.mainStory.seen ||= [];
    const scene = mainStoryScenes.find(scene => scene.location === destination.location && scene.trigger === trigger
        && (trigger !== 'room' || scene.room === state.room) && !state.mainStory.seen.includes(scene.id));
    if (!scene) {
        // Existing clears may already have the old finale marked as read.
        if (trigger !== 'result' || destination.location !== 'skeldrath-7') return false;
        const continuation = mainStoryScenes.find(scene => scene.trigger === 'epilogue' && !state.mainStory.seen.includes(scene.id));
        if (!continuation) return false;
        state.mainStory.active = { id: continuation.id, line: 0, resume };
        return true;
    }
    state.mainStory.active = { id: scene.id, line: 0, resume };
    return true;
}

export function advanceMainStory(state) {
    const current = currentMainStory(state);
    if (!current) return null;
    if (current.index + 1 < current.scene.lines.length) {
        state.mainStory.active.line++;
        return { finished: false };
    }
    const resume = state.mainStory.active.resume;
    if (state.mainStory.active.bossName) {
        state.mainStory.records ||= {};
        state.mainStory.records[current.scene.id] = { bossName: state.mainStory.active.bossName };
    }
    state.mainStory.seen = [...new Set([...state.mainStory.seen, current.scene.id])];
    if (current.scene.partOneEnd) state.mainStory.partOneComplete = true;
    const next = mainStoryScenes.find(scene => scene.id === current.scene.next);
    if (next && !state.mainStory.seen.includes(next.id)) {
        state.mainStory.active = { id: next.id, line: 0, resume };
        return { finished: false };
    }
    state.mainStory.active = null;
    return { finished: true, resume, recruit: Boolean(current.scene.recruit), recruitKey: typeof current.scene.recruit === 'string' ? current.scene.recruit : 'lora' };
}

export function recruitStoryCompanion(state, base, growthRows, skills = [], companion = 'lora') {
    if (!base || !['lora', 'lysia'].includes(companion)) return null;
    const lysia = companion === 'lysia';
    const id = lysia ? LYSIA_COMPANION_ID : STORY_COMPANION_ID;
    const name = lysia ? storyCompanionNames['CHAR-STORY-LYSIA'] : storyCompanionNames['CHAR-STORY-LORA'];
    const level = lysia ? Math.max(1, Math.floor(Number(state.userLevel) || 1)) : 1;
    state.guildMembers ||= [];
    consolidateCharacterRecords(state, []);
    const existing = state.guildMembers.find(member => member.id === id);
    if (existing) {
        existing.name = name;
        existing.storyCompanion = true;
        if (!lysia) Object.assign(existing, { wageExempt: true, weeklyWage: 0, contractWeeklyWage: 0 });
        return existing;
    }
    const profile = applyRosterProfile(base, { level, name, ...(lysia ? lysiaConcept : {}) }, growthRows, skills);
    const weeklyWage = lysia ? recruitmentTerms({ ...profile, wageExempt: false }).weeklyWage : 0;
    const member = { ...profile, id, name, storyCompanion: true,
        isGuildMember: true, price: 0, weeklyWage, contractWeeklyWage: weeklyWage, wageExempt: !lysia,
        experience: 0, experienceToNextLevel: experienceRequired(level), stats: { ...profile.stats }, baseStats: { ...profile.stats },
        hp: profile.stats.maxHp, maxHp: profile.stats.maxHp, effects: [], cooldowns: {} };
    // A guaranteed story reward must not evict an existing contracted member.
    state.guildMembers.push(member);
    return member;
}

const lysiaConcept = { job: '전사', grade: 5, weapon: '양손 전투망치', characterConceptVersion: 2,
    portraitSrc: characterPortraitAsset('0005_F_W.webp'), thumbnailSrc: characterThumbnailAsset('0005_F_W.webp') };

export function migrateLysiaConcept(state, party, growthRows, skills = []) {
    const references = [...(state.guildMembers || []), ...(state.recruits || []), ...party,
        ...(state.guildDispatches || []).flatMap(dispatch => dispatch.members || [])];
    for (const member of new Set(references)) {
        if (member.id !== LYSIA_COMPANION_ID || !member.storyCompanion || member.characterConceptVersion === 2) continue;
        const ratio = member.hp == null ? 1 : Math.max(0, Math.min(1, member.hp / Math.max(1, member.maxHp || member.stats.maxHp)));
        const profile = applyRosterProfile(member, lysiaConcept, growthRows, skills);
        Object.assign(member, profile, { stats: { ...profile.stats }, baseStats: { ...profile.stats }, maxHp: profile.stats.maxHp,
            hp: ratio === 0 ? 0 : Math.max(1, Math.round(profile.stats.maxHp * ratio)) });
    }
}
