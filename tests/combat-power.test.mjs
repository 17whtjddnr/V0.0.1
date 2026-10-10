import test from 'node:test';
import assert from 'node:assert/strict';
import { createCombatEngine } from '../src/combat-engine.mjs';
import { configureCombatPower, combatTeamPower, basicForecastSkill, simulateCombat, simulateExpedition, estimateExpeditionClearRate } from '../src/combat-power.mjs';

const unit = (id, patch = {}) => ({ id, level: 1, stats: { attack: 10, maxHp: 100, defense: 5, speed: 5, critChance: 0, critDamage: 5, effectHit: 0, effectResist: 0, ...patch }, skills: [{ ...basicForecastSkill }] });
const prepared = (profile) => ({ ...structuredClone(profile), hp: profile.stats.maxHp, maxHp: profile.stats.maxHp, effects: [], cooldowns: {} });
function fixture(random = () => 0.5) {
    const hero = prepared(unit('hero')), enemy = prepared(unit('enemy'));
    const engine = createCombatEngine({ party: [hero], state: { enemies: [enemy] }, random });
    return { hero, enemy, engine };
}

test('shared damage preserves integer rounding, critical conversion and absence of passive defense mitigation', () => {
    const { hero, enemy, engine } = fixture();
    const attack = { ...basicForecastSkill, damageCoefficients: [1, 0, 0, 0] };
    assert.deepEqual(engine.calculateDamage(hero, attack, enemy), { damage: 10, critical: false, hit: true });
    enemy.stats.defense = 10000;
    assert.equal(engine.calculateDamage(hero, attack, enemy).damage, 10);
    hero.stats.critChance = 10;
    assert.equal(engine.calculateDamage(hero, attack, enemy).damage, 15);
    hero.stats.defense = 20;
    assert.equal(engine.calculateDamage(hero, { ...attack, damageCoefficients: [0, 1, 0, 0] }, enemy).damage, 30);
});

test('shared cooldown and extra turn follow natural-turn rules', () => {
    const { hero, enemy, engine } = fixture();
    const skill = { ...basicForecastSkill, id: 'extra', cooldown: 2, effects: [{ code: 'EXTRA_TURN', chance: 1 }] };
    engine.beginNaturalTurn(hero);
    engine.executeCombatSkill(hero, skill, [enemy]);
    assert.equal(hero.cooldowns.extra, 2);
    assert.equal(hero.extraTurnPending, true);
    assert.equal(hero.extraTurnUsed, true);
    engine.finishNaturalTurn(hero);
    engine.beginNaturalTurn(hero);
    assert.equal(hero.cooldowns.extra, 1);
    assert.equal(hero.extraTurnUsed, false);
    engine.finishNaturalTurn(hero);
    engine.beginNaturalTurn(hero);
    assert.equal(hero.cooldowns.extra, 0);
});

test('shared healing caps overheal, respects healing block, and barrier absorbs actual incoming damage', () => {
    const { hero, enemy, engine } = fixture();
    hero.hp = 95;
    assert.equal(engine.healCombatant(hero, 50), 5);
    engine.addCombatEffect(hero, enemy, { code: 'HEAL_BLOCK', value: 1, duration: 2 }, true);
    hero.hp = 50;
    assert.equal(engine.healCombatant(hero, 20), 0);
    engine.addCombatEffect(hero, hero, { code: 'BARRIER', value: 0.2, duration: 2 }, true);
    assert.equal(engine.applyDirectDamage(enemy, hero, 30), 10);
    assert.equal(hero.hp, 40);
});

test('effect accuracy, resistance, immunity and natural-turn duration remain shared', () => {
    const { hero, enemy, engine } = fixture();
    const stun = { id: 'stun', target: 'enemy', effects: [{ code: 'STUN', chance: 0.6, duration: 1 }] };
    enemy.stats.effectResist = 2;
    engine.executeCombatSkill(hero, stun, [enemy]);
    assert.equal(engine.hasCombatEffect(enemy, 'STUN'), false);
    hero.stats.effectHit = 4;
    engine.executeCombatSkill(hero, stun, [enemy]);
    assert.equal(engine.hasCombatEffect(enemy, 'STUN'), true);
    engine.beginNaturalTurn(enemy);
    engine.finishNaturalTurn(enemy);
    assert.equal(engine.hasCombatEffect(enemy, 'STUN'), false);
    engine.addCombatEffect(enemy, enemy, { code: 'IMMUNITY', duration: 2 }, true);
    engine.executeCombatSkill(hero, stun, [enemy]);
    assert.equal(engine.hasCombatEffect(enemy, 'STUN'), false);
});

test('forecasts are seeded, bounded and leave input data unchanged', () => {
    const heroes = [unit('hero')], monsters = [unit('mob'), { ...unit('boss'), isBoss: true }];
    const before = JSON.stringify([heroes, monsters]);
    assert.deepEqual(simulateCombat(heroes, monsters, { seed: 82 }), simulateCombat(heroes, monsters, { seed: 82 }));
    assert.equal(estimateExpeditionClearRate(heroes, monsters), estimateExpeditionClearRate(heroes, monsters));
    assert.equal(JSON.stringify([heroes, monsters]), before);
    const pacifist = { ...unit('pacifist'), skills: [] };
    assert.equal(simulateCombat([pacifist], [pacifist], { maxRounds: 5 }).rounds, 5);
    assert.equal(simulateExpedition([pacifist], [pacifist]), false);
});

test('team power accounts for loadout and criticals but does not grant unused defense or elemental bonuses', () => {
    const base = unit('hero');
    const score = combatTeamPower([base]);
    assert.equal(combatTeamPower([{ ...base, stats: { ...base.stats, defense: 500 } }]), score);
    assert.equal(combatTeamPower([{ ...base, element: 'fire' }]), score);
    assert.ok(combatTeamPower([{ ...base, stats: { ...base.stats, critChance: 10, critDamage: 10 } }]) > score);
    assert.ok(combatTeamPower([{ ...base, skills: [] }]) < score);
    const aoe = { ...base, skills: [{ ...basicForecastSkill, target: 'enemyAll' }] };
    assert.ok(combatTeamPower([aoe]) > score);
});

test('healing and usable protection contribute in a real party without counting overheal or idle shields', () => {
    const fighter = unit('fighter');
    const healer = { ...unit('healer'), skills: [{ id: 'heal', target: 'allyAll', healingCoefficients: [1.2, 0], cooldown: 1, effects: [] }] };
    const idle = { ...healer, skills: [] };
    assert.ok(combatTeamPower([fighter, healer]) > combatTeamPower([fighter, idle]));
    const shield = { ...healer, skills: [{ id: 'shield', target: 'allyAll', cooldown: 2, effects: [{ code: 'BARRIER', value: 0.2, duration: 2, chance: 1 }] }] };
    assert.ok(combatTeamPower([fighter, shield]) > combatTeamPower([fighter, idle]));
});

test('expedition forecast retains HP across consecutive encounters', () => {
    const hero = unit('hero', { maxHp: 25, attack: 12, speed: 10 });
    const mob = unit('mob', { maxHp: 10, attack: 10, speed: 1 });
    assert.equal(simulateCombat([hero], [mob, mob], { seed: 1 }).won, true);
    const winSeeds = Array.from({ length: 24 }, (_, index) => simulateExpedition([hero], [mob, { ...mob, id: 'mob-2' }, { ...unit('boss', { maxHp: 1, attack: 0 }), isBoss: true }], { seed: index + 1 }));
    assert.ok(winSeeds.some((won) => !won));
});


test('five-round forecast honors cooldown rotation instead of summing all equipped skills', () => {
    const opponent = unit('dummy', { attack: 0, maxHp: 1000, critChance: 0 });
    const withCooldown = (cooldown) => ({ ...unit('hero'), skills: [{ ...basicForecastSkill }, { id: 'heavy', target: 'enemy', damageCoefficients: [2, 0, 0, 0], cooldown, effects: [] }] });
    assert.equal(simulateCombat([withCooldown(2)], [opponent], { maxRounds: 5 }).metrics.damage, 78);
    assert.equal(simulateCombat([withCooldown(3)], [opponent], { maxRounds: 5 }).metrics.damage, 67);
});

test('resistance changes real control outcomes and extra turns contribute usable actions', () => {
    const controller = { ...unit('controller', { attack: 0, maxHp: 20, speed: 20 }), skills: [{ id: 'lock', target: 'enemy', cooldown: 1, effects: [{ code: 'STUN', duration: 1, chance: 1 }] }] };
    assert.equal(simulateCombat([unit('hero')], [controller], { maxRounds: 10 }).won, false);
    assert.equal(simulateCombat([unit('hero', { effectResist: 10 })], [controller], { maxRounds: 10 }).won, true);
    const actor = unit('hero');
    const extra = { ...actor, skills: [{ ...basicForecastSkill, effects: [{ code: 'EXTRA_TURN', chance: 1 }] }] };
    assert.ok(combatTeamPower([extra]) > combatTeamPower([actor]));
});

test('live loadout resolution invalidates cached power while ignoring transient battle HP', () => {
    const actor = unit('hero');
    let skills = actor.skills;
    configureCombatPower({ resolveProfile: (entry) => ({ ...entry, skills }) });
    try {
        const original = combatTeamPower([actor]);
        assert.equal(combatTeamPower([{ ...actor, hp: 1, cooldowns: { BASIC_ATTACK: 2 } }]), original);
        skills = [];
        assert.ok(combatTeamPower([actor]) < original);
        skills = actor.skills;
        assert.equal(combatTeamPower([actor]), original);
    } finally { configureCombatPower(); }
});
