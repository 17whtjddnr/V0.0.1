export const buffEffectCodes = new Set([
    'ATTACK_UP', 'ATTACK_UP_GREATER', 'DEFENSE_UP', 'SPEED_UP', 'CRITICAL_CHANCE_UP', 'CRITICAL_DAMAGE_UP',
    'EFFECTIVENESS_UP', 'EFFECT_RESISTANCE_UP', 'EVASION_UP', 'CRITICAL_RESISTANCE_UP', 'HIT_CHANCE_UP',
    'CONTINUOUS_HEAL', 'LIFESTEAL', 'BARRIER', 'INVINCIBILITY', 'IMMORTALITY', 'IMMUNITY', 'STEALTH',
    'DAMAGE_REDUCTION', 'DAMAGE_SHARING', 'DAMAGE_REFLECTION', 'AUTO_REVIVE', 'COUNTERATTACK',
    'EXTRA_TURN', 'DEFENSE_PENETRATION', 'BUFF_DURATION_UP', 'SKILL_COOLDOWN_DOWN', 'SKILL_COOLDOWN_RESET',
]);

export function resolvedEffectTarget(skill, effect) {
    const effectTarget = effect.effectTarget || '대상';
    const skillTarget = skill.target;
    const enemyTargeted = ['적', '적전체', 'enemy', 'enemyAll'].includes(skillTarget);
    if (buffEffectCodes.has(effect.code) && enemyTargeted && ['대상', '아군'].includes(effectTarget)) return '자신';
    if (effectTarget === '아군' && !['아군', '아군전체', '아군과 자신', 'ally', 'allyAll', 'selfAndAllies'].includes(skillTarget)) return '자신';
    return effectTarget;
}

const legacyEffectCodes = {
    stun: 'STUN', sleep: 'SLEEP', poison: 'POISON', bleed: 'BLEED', provoke: 'PROVOKE',
    attackUp: 'ATTACK_UP', attackDown: 'ATTACK_DOWN', defenseUp: 'DEFENSE_UP', defenseDown: 'DEFENSE_DOWN',
    speedUp: 'SPEED_UP', speedDown: 'SPEED_DOWN', revive: 'REVIVE',
};
const debuffEffectCodes = new Set([
    'ATTACK_DOWN', 'DEFENSE_DOWN', 'SPEED_DOWN', 'HIT_CHANCE_DOWN', 'STUN', 'SLEEP', 'PROVOKE', 'HEAL_BLOCK',
    'BUFF_BLOCK', 'COUNTERATTACK_BLOCK', 'POISON', 'BLEED', 'TARGET', 'CURSE', 'INJURY', 'REVIVE_BLOCK', 'EXTINCTION',
    'BUFF_DURATION_DOWN', 'DEBUFF_DURATION_UP', 'SKILL_COOLDOWN_UP',
]);
export const statusStatModifiers = {
    ATTACK_UP: ['attack', 1], ATTACK_UP_GREATER: ['attack', 1], ATTACK_DOWN: ['attack', -1],
    DEFENSE_UP: ['defense', 1], DEFENSE_DOWN: ['defense', -1], SPEED_UP: ['speed', 1], SPEED_DOWN: ['speed', -1],
};

export function normalizedCombatEffect(effect) {
    const code = effect.code || legacyEffectCodes[effect.type] || String(effect.type || '').toUpperCase();
    const rawChance = Number(effect.chance ?? 1);
    return {
        ...effect,
        code,
        name: effect.name || code,
        chance: rawChance > 1 ? rawChance / 100 : rawChance,
        duration: Number(effect.duration ?? effect.turns ?? 0),
        value: Number(effect.value ?? 0),
        category: buffEffectCodes.has(code) ? 'buff' : debuffEffectCodes.has(code) ? 'debuff' : 'status',
    };
}

export function battleTargetFor(skill) {
    const targets = { 적: 'enemy', 적전체: 'enemyAll', 아군: 'ally', 아군전체: 'allyAll', 자신: 'self', '아군과 자신': 'selfAndAllies' };
    return targets[skill?.target] || skill?.target || 'enemy';
}
