import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { statusEffectIcons } from '../src/status-effect-icons.mjs';
import { battleEffectVisuals, approvedEffectDurations, containedImageBounds } from '../src/battle-effect-visuals.mjs';
import { createCombatEngine } from '../src/combat-engine.mjs';

const make = id => ({ id, hp: 100, maxHp: 100, stats: { maxHp:100, attack:10, defense:5, speed:5, critChance:0, critDamage:5, effectHit:0, effectResist:0 }, effects:[], cooldowns:{}, skills:[] });
function setup() {
    const hero=make('hero'), enemy=make('enemy'), events=[];
    const engine=createCombatEngine({ party:[hero], state:{ enemies:[enemy] }, random:()=>.5,
        onEffect:(target,effect)=>events.push([target.id,effect.code]),
        onImpact:(target,kind,code)=>events.push([target.id,code||kind]),
    });
    return { hero,enemy,events,engine };
}
test('every one of the 55 effects has an approved animation and background-free white icon',()=>{
    assert.equal(Object.keys(battleEffectVisuals).length,55);
    assert.deepEqual(Object.keys(battleEffectVisuals).sort(),Object.keys(statusEffectIcons).sort());
    for(const [code,visual] of Object.entries(battleEffectVisuals)) {
        assert.ok(approvedEffectDurations[visual.animation],code);
        const svg=readFileSync(`public${visual.icon}`,'utf8');
        assert.doesNotMatch(svg, /#087CF0|#E83D36/);
        assert.match(svg, /mask="url\(#glyph\)"/);
        assert.match(svg,/white|#fff/i);
    }
    assert.equal(battleEffectVisuals.ATTACK_UP.direction,'up');
    assert.equal(battleEffectVisuals.ATTACK_DOWN.direction,'down');
});
test('contained monster bitmap center respects aspect ratio and bottom alignment',()=>{
    assert.deepEqual(containedImageBounds({left:10,top:20,width:200,height:400},100,100,true),{left:10,top:220,width:200,height:200});
    assert.deepEqual(containedImageBounds({left:10,top:20,width:200,height:400},100,100,false),{left:10,top:120,width:200,height:200});
});
test('effect animation is emitted once on application and not on immunity or failed probability',()=>{
    const {hero,enemy,events,engine}=setup();
    engine.addCombatEffect(hero,hero,{code:'ATTACK_UP',duration:2,value:.5},true);
    assert.deepEqual(events,[['hero','ATTACK_UP']]);
    engine.addCombatEffect(enemy,enemy,{code:'IMMUNITY',duration:2},true);events.length=0;
    assert.equal(engine.addCombatEffect(enemy,hero,{code:'STUN',duration:2},true),false);
    assert.equal(engine.addCombatEffect(hero,hero,{code:'DEFENSE_UP',duration:2,chance:0}),false);
    assert.deepEqual(events,[]);
});
test('critical hit uses approved critical animation without also emitting normal hit',()=>{
    const {hero,enemy,events,engine}=setup();hero.stats.critChance=10;
    engine.executeCombatSkill(hero,{id:'attack',damageCoefficient:1,target:'enemy'},[enemy]);
    assert.deepEqual(events,[['enemy','critical-punch']]);
});
test('instant cleanse, cooldown, revive and extra turn emit their own icons on correct targets',()=>{
    const {hero,enemy,events,engine}=setup();
    engine.addCombatEffect(hero,enemy,{code:'POISON',value:.1,duration:2},true);events.length=0;
    engine.executeCombatSkill(hero,{id:'clean',target:'self',effects:[{code:'CLEANSE_DEBUFF',value:1}]},[hero]);
    assert.deepEqual(events,[['hero','CLEANSE_DEBUFF']]);events.length=0;
    engine.executeCombatSkill(hero,{id:'extra',target:'self',effects:[{code:'EXTRA_TURN'}]},[hero]);
    assert.deepEqual(events,[['hero','EXTRA_TURN']]);events.length=0;
    hero.hp=0;engine.executeCombatSkill(enemy,{id:'revive',target:'enemy',effects:[{code:'REVIVE',value:.5}]},[hero]);
    assert.deepEqual(events,[['hero','REVIVE']]);
});
test('healing, lifesteal, periodic healing and auto revive preserve their distinct visuals',()=>{
    const {hero,enemy,events,engine}=setup();hero.hp=50;
    engine.healCombatant(hero,10,'LIFESTEAL');assert.deepEqual(events,[['hero','LIFESTEAL']]);
    events.length=0;engine.addCombatEffect(hero,hero,{code:'CONTINUOUS_HEAL',duration:2,value:.1},true);events.length=0;
    engine.beginNaturalTurn(hero);assert.deepEqual(events,[['hero','CONTINUOUS_HEAL']]);
    engine.addCombatEffect(hero,hero,{code:'AUTO_REVIVE',duration:3},true);events.length=0;
    engine.applyDirectDamage(enemy,hero,1000);assert.deepEqual(events,[['hero','punch'],['hero','AUTO_REVIVE']]);
});
