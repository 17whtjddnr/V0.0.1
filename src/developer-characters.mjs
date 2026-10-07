import { applyRosterProfile } from './roster-generation.mjs';
import { activeSkills } from './developer-skills.mjs';

const storageKey = 'game-developer-characters-v1';
let growthRows = [];
let skillPool = [];
export function configureDeveloperCharacters(rows, skills) {
    growthRows = rows;
    skillPool = skills;
}
let settings = {};
try {
    const stored = JSON.parse(localStorage.getItem(storageKey) || '{}');
    if (stored && typeof stored === 'object' && !Array.isArray(stored)) settings = stored;
} catch { /* Invalid local settings fall back to the original data. */ }

export function characterEnabled(id) {
    return settings[id]?.enabled !== false;
}

export function saveCharacterSettings(id, patch) {
    const next = { ...settings, [id]: { ...settings[id], ...patch } };
    localStorage.setItem(storageKey, JSON.stringify(next));
    settings = next;
}

export function developerCharacter(entry) {
    const saved = settings[entry.id];
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
    return { ...profile, skills: activeSkills(profile.skills || []) };
}

export function saveCharacterEdit(entry, values) {
    saveCharacterSettings(entry.id, {
        ...values,
        statsByLevel: undefined,
        stats: undefined,
    });
}
