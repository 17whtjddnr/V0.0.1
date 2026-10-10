import test from 'node:test';
import assert from 'node:assert/strict';
import { recommendedExpeditionPower } from '../src/expedition-forecast.mjs';
import { basicForecastSkill } from '../src/combat-power.mjs';
const monster = (id, attack, hp, isBoss = false) => ({ id, level: 1, isBoss, stats: { attack, maxHp: hp, defense: 2, speed: 2, critChance: 1, critDamage: 2, effectHit: 1, effectResist: 1 }, skills: [basicForecastSkill] });
test('recommendation calibrates an attrition expedition toward eighty percent and is deterministic', () => {
    const monsters = [monster('mob-a', 2, 4), monster('mob-b', 2, 4), monster('mob-c', 2, 4), monster('boss', 4, 8, true)];
    const before = JSON.stringify(monsters);
    const result = recommendedExpeditionPower(monsters);
    assert.ok(result.power > 0);
    assert.ok(result.calibrated);
    assert.ok(result.clearRate >= 0.8);
    assert.deepEqual(recommendedExpeditionPower(monsters), result);
    assert.equal(JSON.stringify(monsters), before);
    const stronger = recommendedExpeditionPower(monsters.map((actor) => ({ ...actor, stats: { ...actor.stats, attack: actor.stats.attack * 3, maxHp: actor.stats.maxHp * 3 } })));
    assert.ok(stronger.power > result.power);
    assert.equal(recommendedExpeditionPower([]).power, 0);
});


test('a missing boss or a reference roster unable to clear does not advertise a false eighty-percent recommendation', () => {
    const normal = monster('normal', 2, 4);
    assert.equal(recommendedExpeditionPower([normal]).power, 0);
    const inactive = { id: 'inactive', stats: { attack: 1, maxHp: 10, speed: 1 }, skills: [] };
    const result = recommendedExpeditionPower([{ ...normal, isBoss: true }], [inactive]);
    assert.equal(result.power, 0);
    assert.equal(result.calibrated, false);
});
