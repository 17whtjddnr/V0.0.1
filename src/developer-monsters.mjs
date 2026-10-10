import { applyRosterProfile } from './roster-generation.mjs';
import { activeSkills } from './developer-skills.mjs';
import { createDeveloperContentStore } from './developer-content-store.mjs';

const store = createDeveloperContentStore('monsters');
let growthRows = [];
let skillPool = [];
export function configureDeveloperMonsters(rows, skills) {
    growthRows = rows;
    skillPool = skills;
}

export function monsterEnabled(id) {
    return store.settings[id]?.enabled !== false;
}

export function saveMonsterSettings(id, patch) {
    return store.save(id, patch);
}

export function developerMonster(entry) {
    const saved = store.settings[entry.id];
    if (!saved) return { ...entry, skills: activeSkills(entry.skills || []) };
    const profile = applyRosterProfile(entry, {
        name: saved.name ?? entry.name,
        element: saved.element ?? entry.element,
        grade: saved.grade ?? entry.grade,
        zodiac: saved.zodiac ?? entry.zodiac,
        job: saved.job ?? entry.job,
        portraitSrc: saved.portraitSrc || entry.portraitSrc,
        thumbnailSrc: saved.thumbnailSrc || entry.thumbnailSrc,
    }, growthRows, activeSkills(skillPool));
    return { ...profile, skills: activeSkills(profile.skills || []) };
}

export function saveMonsterEdit(entry, values) {
    return saveMonsterSettings(entry.id, {
        ...values,
        statsByLevel: undefined,
        stats: undefined,
    });
}
