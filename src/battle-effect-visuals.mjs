import { statusEffectIcons } from './status-effect-icons.mjs';

// All 55 stable effect codes reuse the 17 approved animations, with a unique icon.
const families = {
    buff: ['ATTACK_UP','ATTACK_UP_GREATER','DEFENSE_UP','SPEED_UP','CRITICAL_CHANCE_UP','CRITICAL_DAMAGE_UP','EFFECTIVENESS_UP','EFFECT_RESISTANCE_UP','EVASION_UP','CRITICAL_RESISTANCE_UP','HIT_CHANCE_UP','STEALTH','DAMAGE_REFLECTION','EXTRA_TURN','COUNTERATTACK','SKILL_COOLDOWN_DOWN','SKILL_COOLDOWN_RESET','BUFF_DURATION_UP'],
    debuff: ['ATTACK_DOWN','DEFENSE_DOWN','SPEED_DOWN','HIT_CHANCE_DOWN','TARGET','CURSE','SKILL_COOLDOWN_UP','BUFF_DURATION_DOWN','DEBUFF_DURATION_UP','TRANSFER_DEBUFF'],
    stun: ['STUN'], sleep: ['SLEEP'], poison: ['POISON'], bleed: ['BLEED'], wound: ['INJURY'],
    bind: ['PROVOKE','HEAL_BLOCK','BUFF_BLOCK','COUNTERATTACK_BLOCK','EXTINCTION','REVIVE_BLOCK'],
    heal: ['HEAL','CONTINUOUS_HEAL','LIFESTEAL'], shield: ['BARRIER','DAMAGE_REDUCTION','DAMAGE_SHARING'],
    invincible: ['INVINCIBILITY','IMMORTALITY'], immunity: ['IMMUNITY'], revive: ['REVIVE','AUTO_REVIVE'],
    punch: ['ADDITIONAL_DAMAGE','EXTRA_ATTACK','DEFENSE_PENETRATION'],
    dispel: ['DISPEL_BUFF'], cleanse: ['CLEANSE_DEBUFF'],
};
const downward = new Set([...families.debuff, ...families.bind, 'STUN','SLEEP','POISON','BLEED','INJURY','DISPEL_BUFF','ADDITIONAL_DAMAGE','EXTRA_ATTACK']);
export const battleEffectVisuals = Object.fromEntries(Object.entries(families).flatMap(([animation, codes]) => codes.map(code => [code, {
    animation, direction: downward.has(code) ? 'down' : 'up',
    icon: statusEffectIcons[code]?.replace('/status-effects/', '/status-effects-white/'),
}])));
export const approvedEffectDurations = { punch: .85, 'critical-punch': 1.1, heal: 1.7, buff: 1.65, revive: 2.2, debuff: 1.65, stun: 2.2, poison: 2.2, bleed: 1.9, shield: 2.2, invincible: 2.2, immunity: 2.2, wound: 1.75, sleep: 2.4, cleanse: 2.2, bind: 2.65, dispel: 1.65 };

// The actual contained bitmap, rather than its larger layout box.
export function containedImageBounds(box, naturalWidth, naturalHeight, bottomAligned = false) {
    if (!naturalWidth || !naturalHeight) return box;
    const ratio = Math.min(box.width / naturalWidth, box.height / naturalHeight);
    const width = naturalWidth * ratio, height = naturalHeight * ratio;
    return { left: box.left + (box.width-width)/2, top: box.top + (box.height-height)*(bottomAligned ? 1 : .5), width, height };
}
