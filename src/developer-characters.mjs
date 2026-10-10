import { applyRosterProfile } from './roster-generation.mjs';
import { activeSkills } from './developer-skills.mjs';
import { createDeveloperContentStore } from './developer-content-store.mjs';

const store = createDeveloperContentStore('characters');
let growthRows = [];
let skillPool = [];
export function configureDeveloperCharacters(rows, skills) {
    growthRows = rows;
    skillPool = skills;
}

export function characterEnabled(id) {
    return store.settings[id]?.enabled !== false;
}

export function saveCharacterSettings(id, patch) {
    return store.save(id, patch);
}

export function characterSkillIds(entry) {
    const ids = store.settings[entry.id]?.skillIds;
    return Array.isArray(ids) ? [...ids] : (entry.skills || []).map((skill) => skill.id);
}

export function characterSkills(entry, fallback = []) {
    const ids = store.settings[entry.id]?.skillIds;
    if (!Array.isArray(ids)) return activeSkills(entry.skills?.length ? entry.skills : fallback);
    const byId = new Map(skillPool.map((skill) => [skill.id, skill]));
    return activeSkills(ids.map((id) => byId.get(id)).filter(Boolean));
}

export function developerCharacter(entry) {
    const saved = store.settings[entry.id];
    if (!saved) return { ...entry, skills: activeSkills(entry.skills || []) };
    const profile = applyRosterProfile(entry, {
        name: saved.name ?? entry.name,
        element: saved.element ?? entry.element,
        grade: saved.grade ?? entry.grade,
        zodiac: saved.zodiac ?? entry.zodiac,
        job: saved.job ?? entry.job,
        portraitSrc: saved.portraitSrc ?? entry.portraitSrc,
        thumbnailSrc: saved.thumbnailSrc ?? entry.thumbnailSrc,
    }, growthRows, activeSkills(skillPool));
    return { ...profile, skills: characterSkills(profile) };
}

export function saveCharacterEdit(entry, values) {
    if (values.skillIds !== undefined) {
        const available = new Set(activeSkills(skillPool).map((skill) => skill.id));
        if (!Array.isArray(values.skillIds) || values.skillIds.length !== 4 || new Set(values.skillIds).size !== 4) {
            throw new Error('서로 다른 스킬을 4개 배정해주세요.');
        }
        if (values.skillIds.some((id) => !available.has(id))) throw new Error('등록되어 활성화된 스킬을 선택해주세요.');
        values = { ...values, skillIds: [...values.skillIds] };
    }
    return saveCharacterSettings(entry.id, {
        ...values,
        statsByLevel: undefined,
        stats: undefined,
    });
}
