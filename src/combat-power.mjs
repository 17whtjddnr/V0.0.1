import { createCombatEngine } from './combat-engine.mjs';
import { battleTargetFor, normalizedCombatEffect } from './combat-rules.mjs';

export const POWER_EVALUATION_ROUNDS = 5;
export const POWER_DISPLAY_SCALE = 100;
export const RECOMMENDED_CLEAR_RATE = 0.8;
export const FORECAST_TRIALS = 24;
export const basicForecastSkill = Object.freeze({ id: 'BASIC_ATTACK', name: '기본 공격', target: 'enemy', isBasicAttack: true, cooldown: 0, damageCoefficients: [0.85, 0, 0, 0], effects: [] });
let profileResolver = (actor) => actor;
const powerCache = new Map();
const forecastCache = new Map();

export function configureCombatPower({ resolveProfile = (actor) => actor } = {}) {
    profileResolver = resolveProfile;
    powerCache.clear();
    forecastCache.clear();
}

// Presentation, current combat HP, effects and cooldowns do not change preparation ratings.
export function combatProfile(actor) {
    return {
        id: actor.id || '', level: Number(actor.level) || 1, job: actor.job || '', isBoss: actor.isBoss === true,
        stats: { ...actor.stats },
        skills: (actor.skills === undefined ? [basicForecastSkill] : actor.skills).map((skill) => ({
            id: skill.id, target: skill.target, cooldown: skill.cooldown || 0, isBasicAttack: !!skill.isBasicAttack,
            damageCoefficient: skill.damageCoefficient, damageCoefficients: skill.damageCoefficients,
            healingCoefficients: skill.healingCoefficients, heal: skill.heal,
            effects: (skill.effects || []).map((effect) => ({ code: effect.code, type: effect.type, chance: effect.chance, value: effect.value,
                duration: effect.duration, turns: effect.turns, effectTarget: effect.effectTarget, unit: effect.unit })),
        })),
    };
}

export function seededCombatRandom(seed = 1) {
    let value = seed >>> 0;
    return () => {
        value += 0x6D2B79F5;
        let next = Math.imul(value ^ value >>> 15, 1 | value);
        next ^= next + Math.imul(next ^ next >>> 7, 61 | next);
        return ((next ^ next >>> 14) >>> 0) / 4294967296;
    };
}
function cached(cache, key, calculate) {
    if (cache.has(key)) return cache.get(key);
    const value = calculate();
    if (cache.size >= 256) cache.delete(cache.keys().next().value);
    cache.set(key, value);
    return value;
}
export function freshCombatant(profile) {
    const actor = structuredClone(combatProfile(profile));
    return { ...actor, hp: Math.max(0, Number(actor.stats.maxHp) || 0), maxHp: Math.max(0, Number(actor.stats.maxHp) || 0), effects: [], cooldowns: {} };
}
function averageDamage(engine, actor, skill) {
    const coefficients = skill.damageCoefficients;
    const raw = Array.isArray(coefficients)
        ? ['attack', 'defense', 'speed', 'maxHp'].reduce((sum, stat, index) => sum + engine.combatStat(actor, stat) * (Number(coefficients[index]) || 0), 0)
        : engine.combatStat(actor, 'attack') * (Number(skill.damageCoefficient) || 0);
    if (!engine.skillHasDamage(skill)) return 0;
    const chance = Math.min(1, engine.combatStat(actor, 'critChance') / 100);
    return (1 - chance) * Math.max(1, Math.round(raw)) + chance * Math.max(1, Math.round(raw * engine.combatStat(actor, 'critDamage') / 100));
}
function actionValue(engine, actor, skill, targets, allies, opponents) {
    let value = 0;
    const heal = engine.skillHealingAmount(actor, skill);
    for (const target of targets) {
        if (opponents.includes(target)) value += Math.min(target.hp, averageDamage(engine, actor, skill));
        else if (!engine.hasCombatEffect(target, 'HEAL_BLOCK')) value += Math.max(0, Math.min(Math.round(heal), target.maxHp - target.hp));
    }
    for (const raw of skill.effects || []) {
        const effect = normalizedCombatEffect(raw);
        for (const target of engine.effectRecipients(effect, actor, targets, skill)) {
            const hostile = opponents.includes(target);
            if (hostile && effect.category === 'debuff' && engine.hasCombatEffect(target, 'IMMUNITY')) continue;
            if (!hostile && effect.category === 'buff' && engine.hasCombatEffect(target, 'BUFF_BLOCK')) continue;
            const chance = Math.max(0, Math.min(1, effect.chance + (hostile ? (engine.combatStat(actor, 'effectHit') - engine.combatStat(target, 'effectResist')) / 100 : 0)));
            const duration = Math.max(1, effect.duration);
            const existing = engine.hasCombatEffect(target, effect.code);
            let amount = 0;
            if (['STUN', 'SLEEP'].includes(effect.code) && !existing) amount = averageDamage(engine, target, basicForecastSkill) * duration;
            if (effect.code === 'POISON' && !existing) amount = target.maxHp * effect.value * duration;
            if (effect.code === 'BLEED' && !existing) amount = actor.stats.attack * effect.value * duration;
            if (effect.code === 'BARRIER' && !existing) amount = Math.min(target.maxHp * effect.value, opponents.reduce((sum, enemy) => sum + averageDamage(engine, enemy, basicForecastSkill), 0) / Math.max(1, allies.length));
            if (effect.code === 'CONTINUOUS_HEAL' && !existing) amount = Math.min(target.maxHp - target.hp, target.maxHp * effect.value * duration);
            if (['DAMAGE_REDUCTION', 'INVINCIBILITY', 'IMMORTALITY', 'EVASION_UP'].includes(effect.code) && !existing) amount = averageDamage(engine, opponents[0] || actor, basicForecastSkill) * duration * (effect.code === 'INVINCIBILITY' ? 1 : effect.value || 0.5);
            if (['ATTACK_UP', 'ATTACK_UP_GREATER', 'ATTACK_DOWN'].includes(effect.code) && !existing) amount = averageDamage(engine, target, basicForecastSkill) * effect.value * duration;
            if (effect.code === 'EXTRA_TURN' && !actor.extraTurnUsed) amount = averageDamage(engine, actor, basicForecastSkill);
            if (['ADDITIONAL_DAMAGE', 'EXTRA_ATTACK'].includes(effect.code)) amount = Math.min(target.hp, actor.stats.attack * effect.value);
            if (effect.code === 'LIFESTEAL') amount = Math.min(actor.maxHp - actor.hp, value * effect.value);
            if (effect.code === 'REVIVE' && target.hp <= 0 && !target.extinct && !target.reviveUsed && !engine.hasCombatEffect(target, 'REVIVE_BLOCK')) amount = target.maxHp * effect.value + averageDamage(engine, target, basicForecastSkill);
            if (effect.code === 'CLEANSE_DEBUFF') amount = (target.effects || []).filter((item) => item.category === 'debuff').length * averageDamage(engine, target, basicForecastSkill);
            if (effect.code === 'DISPEL_BUFF') amount = (target.effects || []).filter((item) => item.category === 'buff').length * averageDamage(engine, target, basicForecastSkill) * 0.5;
            value += Math.max(0, amount) * chance;
        }
    }
    return value;
}

export function chooseForecastAction(engine, actor, allies, opponents, random, enemyAI = false) {
    const available = actor.skills.filter((skill) => !(actor.cooldowns[skill.id] > 0));
    const taunt = actor.effects.find((effect) => effect.code === 'PROVOKE' && opponents.some((target) => target.id === effect.sourceId && target.hp > 0));
    const forcedIndex = taunt ? opponents.findIndex((target) => target.id === taunt.sourceId && target.hp > 0) : -1;
    if (enemyAI) {
        const attacks = available.filter((skill) => ['enemy', 'enemyAll'].includes(battleTargetFor(skill)) && engine.skillHasDamage(skill));
        const fallback = actor.skills.find((skill) => skill.isBasicAttack) || actor.skills[0];
        const pool = forcedIndex >= 0 ? attacks.length ? attacks : [fallback] : available.length ? available : [fallback];
        if (!pool[0]) return null;
        const skill = pool[Math.floor(random() * pool.length)];
        // Matches the current monster AI, including its target-index selection for ally skills.
        const index = forcedIndex >= 0 ? forcedIndex : Math.floor(random() * opponents.length);
        return { skill, targets: engine.combatTargets(actor, skill, index) };
    }
    let best = null;
    for (const skill of available) {
        const type = battleTargetFor(skill);
        if (forcedIndex >= 0 && !['enemy', 'enemyAll'].includes(type)) continue;
        const indices = type === 'enemy' ? forcedIndex >= 0 ? [forcedIndex] : opponents.map((_, index) => index) : type === 'ally' ? allies.map((_, index) => index) : [null];
        for (const index of indices) {
            const targets = engine.combatTargets(actor, skill, index);
            if (!targets.length) continue;
            const score = actionValue(engine, actor, skill, targets, allies, opponents);
            if (!best || score > best.score) best = { skill, targets, score };
        }
    }
    return best;
}

// No DOM, timers or writes to player data. Supplied preparedHeroes retain expedition attrition.
export function simulateCombat(heroes, opponents, { seed = 1, random = seededCombatRandom(seed), maxRounds = 40, preparedHeroes = null } = {}) {
    const party = preparedHeroes || heroes.map(freshCombatant);
    const enemies = opponents.map(freshCombatant);
    const metrics = { damage: 0, healing: 0, prevented: 0, control: 0 };
    const engine = createCombatEngine({ party, state: { enemies }, random, now: () => 0,
        showCombatNumber(target, type, amount) {
            if (type === 'damage' && enemies.includes(target)) metrics.damage += amount;
            if (type === 'healing' && party.includes(target)) metrics.healing += amount;
        },
        onPrevented(target, amount) { if (party.includes(target)) metrics.prevented += amount; },
    });
    let rounds = 0;
    for (; rounds < maxRounds && party.some((actor) => actor.hp > 0) && enemies.some((actor) => actor.hp > 0); rounds += 1) {
        const order = [...party, ...enemies].filter((actor) => actor.hp > 0).sort((a, b) => engine.combatStat(b, 'speed') - engine.combatStat(a, 'speed'));
        for (const actor of order) {
            if (!party.some((item) => item.hp > 0) || !enemies.some((item) => item.hp > 0)) break;
            if (actor.hp <= 0) continue;
            engine.beginNaturalTurn(actor);
            if (actor.hp > 0 && (engine.hasCombatEffect(actor, 'STUN') || engine.hasCombatEffect(actor, 'SLEEP'))) {
                if (enemies.includes(actor)) metrics.control += averageDamage(engine, actor, basicForecastSkill);
            } else if (actor.hp > 0) {
                const isHero = party.includes(actor);
                for (let action = 0; action < 2; action += 1) {
                    const selected = chooseForecastAction(engine, actor, isHero ? party : enemies, isHero ? enemies : party, random, !isHero);
                    if (!selected) break;
                    engine.executeCombatSkill(actor, selected.skill, selected.targets);
                    const extra = actor.extraTurnPending;
                    actor.extraTurnPending = false;
                    if (!extra || actor.hp <= 0 || !party.some((item) => item.hp > 0) || !enemies.some((item) => item.hp > 0)) break;
                }
            }
            engine.finishNaturalTurn(actor);
        }
    }
    return { won: party.some((actor) => actor.hp > 0) && enemies.every((actor) => actor.hp <= 0), party, enemies, rounds, metrics };
}

function referenceEnemies(level, strength) {
    return Array.from({ length: 4 }, (_, index) => ({ id: `reference-${index}`, level, stats: {
        maxHp: Math.round(8 * level * strength), attack: Math.round(2 * level * strength), defense: 2 * level,
        speed: 2 * level, critChance: 2, critDamage: 2, effectHit: 2, effectResist: 2,
    }, skills: [basicForecastSkill, { id: 'reference-status-' + index, target: 'enemy', cooldown: 3,
        damageCoefficients: [0.65, 0, 0, 0], effects: [index % 2
            ? { code: 'POISON', chance: 0.5, value: 0.05, duration: 2 }
            : { code: 'STUN', chance: 0.4, value: 1, duration: 1 }],
    }] }));
}
export function evaluateTeamPower(profiles) {
    const team = profiles.map(combatProfile).filter((actor) => Number(actor.stats.maxHp) > 0);
    if (!team.length) return 0;
    return cached(powerCache, JSON.stringify(team), () => {
        const level = team.reduce((sum, actor) => sum + actor.level, 0) / team.length;
        let contribution = 0;
        const samples = 8;
        for (const strength of [1, 4]) for (let seed = 1; seed <= samples; seed += 1) {
            const { metrics } = simulateCombat(team, referenceEnemies(level, strength), { seed: seed * 7919, maxRounds: POWER_EVALUATION_ROUNDS });
            contribution += (metrics.damage + metrics.healing + metrics.prevented + metrics.control) / (samples * 2 * POWER_EVALUATION_ROUNDS);
        }
        const hp = team.reduce((sum, actor) => sum + Number(actor.stats.maxHp), 0);
        const speed = team.reduce((sum, actor) => sum + (Number(actor.stats.speed) || 0), 0) / team.length;
        const initiative = 1 + 0.1 * (speed + 2 * level > 0 ? (speed - 2 * level) / (speed + 2 * level) : 0);
        return Math.max(1, Math.round(POWER_DISPLAY_SCALE * (hp / POWER_EVALUATION_ROUNDS + contribution) * initiative));
    });
}
export function resolveCombatProfiles(members) { return members.map(profileResolver).map(combatProfile); }
export function combatTeamPower(members) {
    return evaluateTeamPower(resolveCombatProfiles(members));
}

export function simulateExpedition(heroes, monsters, { seed = 1 } = {}) {
    const party = heroes.map(freshCombatant);
    const regular = monsters.filter((actor) => !actor.isBoss);
    const bosses = monsters.filter((actor) => actor.isBoss);
    const random = seededCombatRandom(seed);
    if (!monsters.length || !party.length || !bosses.length) return false;
    for (let encounter = 0; encounter < 4; encounter += 1) {
        let enemies;
        if (encounter === 3) enemies = bosses.length ? [bosses[Math.floor(random() * bosses.length)]] : [];
        else {
            const candidates = [...regular];
            enemies = [];
            const count = 2 + Math.floor(random() * 3);
            while (enemies.length < count && candidates.length) enemies.push(candidates.splice(Math.floor(random() * candidates.length), 1)[0]);
        }
        if (!enemies.length) continue;
        const result = simulateCombat([], enemies, { preparedHeroes: party, random });
        if (!result.won) return false;
    }
    return party.some((actor) => actor.hp > 0);
}
export function estimateExpeditionClearRate(heroes, monsters, trials = FORECAST_TRIALS) {
    if (!heroes.length || !monsters.length) return 0;
    const team = heroes.map(combatProfile), roster = monsters.map(combatProfile);
    return cached(forecastCache, JSON.stringify([team, roster, trials]), () => {
        let wins = 0;
        for (let seed = 1; seed <= trials; seed += 1) if (simulateExpedition(team, roster, { seed: seed * 104729 })) wins += 1;
        return wins / trials;
    });
}
