// icon_01–55 are extracted unchanged from OriginalData/SVG_Icon/status_effect_icons_clean.svg.
// Order matches the numbered effects in Skill_Effects_55.xlsx; lookup uses stable effect codes.
const codes = [
    'ATTACK_UP', 'ATTACK_UP_GREATER', 'DEFENSE_UP', 'SPEED_UP', 'CRITICAL_CHANCE_UP',
    'CRITICAL_DAMAGE_UP', 'EFFECTIVENESS_UP', 'EFFECT_RESISTANCE_UP', 'EVASION_UP', 'CRITICAL_RESISTANCE_UP',
    'HIT_CHANCE_UP', 'ATTACK_DOWN', 'DEFENSE_DOWN', 'SPEED_DOWN', 'HIT_CHANCE_DOWN',
    'STUN', 'SLEEP', 'PROVOKE', 'HEAL_BLOCK', 'BUFF_BLOCK',
    'COUNTERATTACK_BLOCK', 'POISON', 'BLEED', 'TARGET', 'CURSE',
    'INJURY', 'ADDITIONAL_DAMAGE', 'HEAL', 'CONTINUOUS_HEAL', 'LIFESTEAL',
    'BARRIER', 'INVINCIBILITY', 'IMMORTALITY', 'IMMUNITY', 'STEALTH',
    'DAMAGE_REDUCTION', 'DAMAGE_SHARING', 'DAMAGE_REFLECTION', 'REVIVE', 'AUTO_REVIVE',
    'EXTINCTION', 'REVIVE_BLOCK', 'EXTRA_TURN', 'EXTRA_ATTACK', 'COUNTERATTACK',
    'SKILL_COOLDOWN_DOWN', 'SKILL_COOLDOWN_RESET', 'SKILL_COOLDOWN_UP', 'DEFENSE_PENETRATION', 'DISPEL_BUFF',
    'CLEANSE_DEBUFF', 'BUFF_DURATION_UP', 'BUFF_DURATION_DOWN', 'DEBUFF_DURATION_UP', 'TRANSFER_DEBUFF',
];
export const statusEffectIcons = Object.fromEntries(codes.map((code, index) =>
    [code, `/assets/icons/status-effects/icon_${String(index + 1).padStart(2, '0')}.svg`]));
