import { calculateSkillScore } from './skill-balance.js';

const storageKey = 'game-developer-skills-v1';
let settings = {};
let originals = new Map();
let formatDescriptions = null;
try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) || '{}');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) settings = parsed;
} catch { /* Use the workbook when local settings cannot be read. */ }

export function configureDeveloperSkills(skills, formatter) {
    originals = new Map(skills.map((skill) => [skill.id, skill]));
    formatDescriptions = formatter;
}
export function skillEnabled(id) { return settings[id]?.enabled !== false; }
export function saveSkillSettings(id, patch) {
    const next = { ...settings, [id]: { ...settings[id], ...patch } };
    localStorage.setItem(storageKey, JSON.stringify(next));
    settings = next;
}
export function derivedSkill(skill) {
    const scoreAfter = calculateSkillScore(skill);
    const targetScore = Number(skill.balanceTargetScore ?? skill.targetScore ?? .9);
    const damageLabels = ['공격력', '방어력', '속도', '생명력'];
    const healingLabels = ['공격력 비례', '최대 생명력 비례'];
    return {
        ...skill, scoreAfter, targetScore, balanceScale: 1,
        balanceReached: Math.abs(scoreAfter - targetScore) <= .02,
        damage: skill.damageCoefficients.map((value, index) => value > 0 ? `${damageLabels[index]} ${value.toFixed(2)}x` : null).filter(Boolean),
        healing: skill.healingCoefficients.map((value, index) => value > 0 ? `${healingLabels[index]} ${value.toFixed(2)}x` : null).filter(Boolean),
        ...(formatDescriptions ? formatDescriptions(skill) : {}),
        ...(skill.customTooltipKo ? { tooltipKo: skill.customTooltipKo } : {}),
        ...(skill.customTooltipEn ? { tooltipEn: skill.customTooltipEn } : {}),
    };
}
export function effectiveSkill(skill) {
    const original = originals.get(skill.id) || skill;
    const saved = settings[skill.id];
    return saved?.values ? derivedSkill({ ...original, ...saved.values, id: original.id }) : original;
}
export function activeSkills(skills) { return skills.filter((skill) => skillEnabled(skill.id)).map(effectiveSkill); }
export function saveSkillEdit(id, values, enabled = skillEnabled(id)) {
    if (values.effects.length > 4) throw new Error('효과는 최대 4개까지 적용할 수 있습니다.');
    saveSkillSettings(id, { values, enabled });
}
