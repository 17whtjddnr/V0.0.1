import { statusStatModifiers, normalizedCombatEffect as normalizeEffect, resolvedEffectTarget, battleTargetFor } from './combat-rules.mjs';

// Both interactive battles and forecasts use these exact damage, status and cooldown rules.
export function createCombatEngine(context) {
    const random = context.random || Math.random;
    const now = context.now || Date.now;
    const normalizedCombatEffect = context.normalizedCombatEffect || normalizeEffect;
    const showCombatNumber = context.showCombatNumber || (() => {});
    const playWebSound = context.playWebSound || (() => {});
    const onPrevented = context.onPrevented || (() => {});
    const onEffect = context.onEffect || (() => {});
    const onImpact = context.onImpact || (() => {});
    function addCombatEffect(target, source, rawEffect, chancePassed = false) {
        const effect = normalizedCombatEffect(rawEffect);
        if (!effect.code || effect.duration <= 0 && effect.code !== 'INJURY') return false;
        target.effects ||= [];
        if (effect.category === 'debuff' && target.effects.some((active) => active.code === 'IMMUNITY' && active.turnsRemaining > 0)) return false;
        if (effect.category === 'buff' && target.effects.some((active) => active.code === 'BUFF_BLOCK' && active.turnsRemaining > 0)) return false;
        if (!chancePassed && random() >= effect.chance) return false;
        const family = effect.code === 'ATTACK_UP_GREATER' ? 'ATTACK_UP' : effect.code;
        const related = target.effects.filter((active) => (active.code === 'ATTACK_UP_GREATER' ? 'ATTACK_UP' : active.code) === family);
        const strongest = related.reduce((value, active) => Math.max(value, active.value), -Infinity);
        const longest = related.reduce((value, active) => Math.max(value, active.turnsRemaining), 0);
        if (related.length) {
            effect.value = Math.max(effect.value, strongest);
            effect.duration = Math.max(effect.duration, longest);
        }
        target.effects = target.effects.filter((active) => !related.includes(active));
        target.effects.push({
            code: effect.code,
            name: effect.name,
            value: effect.value,
            unit: effect.unit,
            turnsRemaining: effect.duration,
            category: effect.category,
            appliedTurn: Number(target.naturalTurnSerial || 0),
            sourceId: source.id,
            sourceAttack: Number(source.stats?.attack || 0),
            shield: effect.code === 'BARRIER' ? target.maxHp * effect.value : 0,
        });
        if (effect.code === 'INJURY') {
            target.originalMaxHp ||= target.maxHp;
            const injury = target.effects.filter((active) => active.code === 'INJURY').reduce((sum, active) => sum + active.value, 0);
            target.maxHp = Math.max(1, Math.round(target.originalMaxHp * (1 - Math.min(0.3, injury))));
            target.stats.maxHp = target.maxHp;
            target.hp = Math.min(target.hp, target.maxHp);
        }
        onEffect(target, effect);
        return true;
    }
    
    function combatStat(actor, stat) {
        const base = Number(actor.stats?.[stat] || 0);
        const modifier = statusStatModifiers;
        let multiplier = 1;
        (actor.effects || []).forEach((effect) => {
            const spec = modifier[effect.code];
            if (spec?.[0] === stat) multiplier += spec[1] * effect.value;
        });
        const flatCodes = {
            critChance: ['CRITICAL_CHANCE_UP'], critDamage: ['CRITICAL_DAMAGE_UP'],
            effectHit: ['EFFECTIVENESS_UP'], effectResist: ['EFFECT_RESISTANCE_UP'],
        };
        const flat = (flatCodes[stat] || []).reduce((sum, code) => sum + (actor.effects || []).filter((effect) => effect.code === code).reduce((value, effect) => value + effect.value * 100, 0), 0);
        if (stat === 'critChance') return Math.max(0, base * 10 + flat);
        if (stat === 'critDamage') return Math.max(100, 100 + base * 10 + flat);
        if (stat === 'effectHit' || stat === 'effectResist') return Math.max(0, base * 10 + flat);
        return Math.max(0, base * Math.max(0, multiplier) + flat);
    }
    
    function tickActorEffects(actor) {
        actor.effects = (actor.effects || []).map((effect) => ({
            ...effect,
            turnsRemaining: effect.appliedTurn === actor.naturalTurnSerial ? effect.turnsRemaining : effect.turnsRemaining - 1,
        })).filter((effect) => effect.turnsRemaining > 0 || effect.code === 'INJURY');
    }
    
    function hasCombatEffect(actor, code) {
        return (actor.effects || []).some((effect) => effect.code === code && (effect.turnsRemaining > 0 || effect.code === 'INJURY'));
    }
    
    function combatTargets(actor, skill, targetIndex = null) {
        const actorIsHero = context.party.includes(actor);
        const allies = actorIsHero ? context.party : context.state.enemies;
        const enemies = actorIsHero ? context.state.enemies : context.party;
        const canRevive = (skill.effects || []).some((effect) => normalizedCombatEffect(effect).code === 'REVIVE');
        const targetType = battleTargetFor(skill);
        if (targetType === 'self') return [actor];
        if (targetType === 'selfAndAllies' || targetType === 'allyAll') return allies.filter((target) => target.hp > 0 || canRevive);
        if (targetType === 'enemyAll') return enemies.filter((target) => target.hp > 0);
        if (targetType === 'ally' || targetType === 'enemy') {
            const list = targetType === 'ally' ? allies : enemies;
            const target = targetIndex === null ? null : list[targetIndex];
            const hidden = target && hasCombatEffect(target, 'STEALTH') && list.some((ally) => ally !== target && ally.hp > 0);
            if (hidden && targetType === 'enemy') return [];
            return !target || target.hp <= 0 && !(targetType === 'ally' && canRevive) ? [] : [target];
        }
        return [actor];
    }
    
    function effectRecipients(effect, actor, primaryTargets, skill) {
        const effectTarget = resolvedEffectTarget(skill, effect);
        if (effectTarget === '자신') return [actor];
        if (effectTarget === '사망 아군') return primaryTargets.filter((target) => target.hp <= 0);
        if (effectTarget === '아군') {
            const allies = context.party.includes(actor) ? context.party : context.state.enemies;
            const selectedAllies = primaryTargets.filter((target) => allies.includes(target));
            return selectedAllies.length ? selectedAllies : [actor];
        }
        if (['자신→대상', '원래 공격 대상', '이번 주공격'].includes(effectTarget)) return primaryTargets;
        if (effect.category === 'buff' && ['enemy', 'enemyAll'].includes(battleTargetFor(skill))) return [actor];
        return primaryTargets.length ? primaryTargets : [actor];
    }
    
    function healCombatant(target, amount, effectCode = 'HEAL') {
        if (!target || target.hp <= 0 || hasCombatEffect(target, 'HEAL_BLOCK')) return 0;
        const healing = Math.max(0, Math.min(Math.round(amount), target.maxHp - target.hp));
        target.hp += healing;
        if (healing) { showCombatNumber(target, 'healing', healing); onImpact(target, 'heal', effectCode); }
        return healing;
    }
    
    function removeCombatEffects(target, category, count = 1) {
        let removed = 0;
        target.effects ||= [];
        for (let index = target.effects.length - 1; index >= 0 && removed < count; index -= 1) {
            const effect = target.effects[index];
            if (effect.category !== category || ['INJURY', 'AUTO_REVIVE'].includes(effect.code)) continue;
            target.effects.splice(index, 1);
            removed += 1;
        }
        return removed;
    }
    
    function applyDirectDamage(attacker, target, amount, allowReactions = true, allowCounter = allowReactions, impact = 'punch') {
        if (!target || target.hp <= 0 || amount <= 0) return 0;
        if (hasCombatEffect(target, 'INVINCIBILITY')) { onPrevented(target, Math.max(1, Math.round(amount))); return 0; }
        let incoming = Math.max(1, Math.round(amount));
        const originalIncoming = incoming;
        const reduction = Math.max(0, ...(target.effects || []).filter((effect) => effect.code === 'DAMAGE_REDUCTION').map((effect) => effect.value));
        const marked = (target.effects || []).filter((effect) => effect.code === 'TARGET').reduce((sum, effect) => sum + effect.value, 0);
        incoming = Math.max(0, Math.round(incoming * (1 - reduction + marked)));
        const barrier = [...(target.effects || [])].filter((effect) => effect.code === 'BARRIER' && effect.shield > 0).sort((left, right) => right.shield - left.shield)[0];
        if (barrier && incoming > 0) {
            const absorbed = Math.min(incoming, barrier.shield);
            barrier.shield -= absorbed;
            incoming -= absorbed;
            if (barrier.shield <= 0) target.effects = target.effects.filter((effect) => effect !== barrier);
        }
        onPrevented(target, Math.max(0, originalIncoming - incoming));
        if (allowReactions && incoming > 0) {
            const team = context.party.includes(target) ? context.party : context.state.enemies;
            const sharing = team.find((ally) => ally !== target && ally.hp > 0 && hasCombatEffect(ally, 'DAMAGE_SHARING'));
            if (sharing) {
                const share = Math.min(incoming, Math.round(incoming * (sharing.effects.find((effect) => effect.code === 'DAMAGE_SHARING')?.value || 0.3)));
                incoming -= share;
                applyDirectDamage(attacker, sharing, share, false);
            }
        }
        const previousHp = target.hp;
        const lethalHp = hasCombatEffect(target, 'IMMORTALITY') ? 1 : 0;
        target.hp = Math.max(lethalHp, target.hp - incoming);
        const actualDamage = previousHp - target.hp;
        if (actualDamage > 0) {
            if (context.onImpact) onImpact(target, impact);
            else playWebSound('hit');
            target.hitAt = now();
            showCombatNumber(target, 'damage', actualDamage);
            target.effects = (target.effects || []).filter((effect) => effect.code !== 'SLEEP');
        }
        if (target.hp <= 0 && !target.extinct && !hasCombatEffect(target, 'REVIVE_BLOCK')) {
            const autoReviveIndex = (target.effects || []).findIndex((effect) => effect.code === 'AUTO_REVIVE');
            if (autoReviveIndex >= 0 && !target.reviveUsed) {
                target.reviveUsed = true;
                target.hp = target.maxHp;
                target.effects.splice(autoReviveIndex, 1);
                target.effects = target.effects.filter((effect) => effect.category === 'buff' && !effect.code.startsWith('DEBUFF'));
                showCombatNumber(target, 'healing', target.hp);
                onEffect(target, { code: 'AUTO_REVIVE' });
            }
        }
        if (allowReactions && actualDamage > 0 && attacker?.hp > 0) {
            const team = context.party.includes(target) ? context.party : context.state.enemies;
            team.filter((ally) => ally !== target && ally.hp > 0).forEach((ally) => {
                const curse = (ally.effects || []).find((effect) => effect.code === 'CURSE');
                if (curse) applyDirectDamage(attacker, ally, actualDamage * curse.value, false);
            });
            const reflection = Math.max(0, ...(target.effects || []).filter((effect) => effect.code === 'DAMAGE_REFLECTION').map((effect) => effect.value));
            if (reflection) applyDirectDamage(target, attacker, actualDamage * reflection, false);
            if (allowCounter && hasCombatEffect(target, 'COUNTERATTACK') && !hasCombatEffect(target, 'COUNTERATTACK_BLOCK') && !target.counteredThisTurn && attacker.hp > 0) {
                target.counteredThisTurn = true;
                const counter = (target.effects || []).find((effect) => effect.code === 'COUNTERATTACK');
                applyDirectDamage(target, attacker, combatStat(target, 'attack') * (counter?.value || 0.4), false);
            }
        }
        return actualDamage;
    }
    
    function skillHasDamage(skill) {
        return (skill.damageCoefficients || []).some((value) => value > 0) || Number(skill.damageCoefficient) > 0;
    }
    
    function skillHealingAmount(actor, skill) {
        const coefficients = skill.healingCoefficients || [];
        if (coefficients[0] > 0) return combatStat(actor, 'attack') * coefficients[0];
        if (coefficients[1] > 0) return combatStat(actor, 'maxHp') * coefficients[1];
        if (skill.heal?.attackCoefficient) return combatStat(actor, 'attack') * skill.heal.attackCoefficient;
        if (skill.heal?.maxHpCoefficient) return combatStat(actor, 'maxHp') * skill.heal.maxHpCoefficient;
        return 0;
    }
    
    function applyInstantEffect(source, skill, target, effect, directDamage) {
        const code = effect.code;
        if (code === 'HEAL') return;
        if (['BUFF_DURATION_UP', 'BUFF_DURATION_DOWN', 'DEBUFF_DURATION_UP'].includes(code)) {
            const category = code === 'DEBUFF_DURATION_UP' ? 'debuff' : 'buff';
            const amount = Math.max(1, Math.round(effect.value));
            target.effects = (target.effects || []).map((active) => active.category !== category ? active : {
                ...active,
                turnsRemaining: code === 'BUFF_DURATION_DOWN'
                    ? Math.max(0, active.turnsRemaining - amount)
                    : active.turnsRemaining + amount,
            }).filter((active) => active.turnsRemaining > 0 || active.code === 'INJURY');
            onEffect(target, effect);
            return;
        }
        if (code === 'REVIVE') {
            if (target.hp > 0 || target.reviveUsed || target.extinct || hasCombatEffect(target, 'REVIVE_BLOCK')) return;
            target.reviveUsed = true;
            target.hp = Math.max(1, Math.round(target.maxHp * effect.value));
            target.effects = (target.effects || []).filter((active) => active.category === 'buff');
            showCombatNumber(target, 'healing', target.hp);
            onEffect(target, effect);
            return;
        }
        if (code === 'DISPEL_BUFF' || code === 'CLEANSE_DEBUFF') {
            const removed = removeCombatEffects(target, code === 'DISPEL_BUFF' ? 'buff' : 'debuff', Math.max(1, Math.round(effect.value)));
            if (removed) onEffect(target, effect);
            return removed;
        }
        if (code === 'TRANSFER_DEBUFF') {
            const transferable = source.effects?.findLast((active) => active.category === 'debuff' && !['STUN', 'SLEEP', 'PROVOKE', 'INJURY', 'EXTINCTION', 'REVIVE_BLOCK'].includes(active.code));
            if (transferable) {
                source.effects = source.effects.filter((active) => active !== transferable);
                if (addCombatEffect(target, source, { ...transferable, chance: 1 }, true)) onEffect(target, effect);
            }
            return;
        }
        if (code === 'SKILL_COOLDOWN_DOWN' || code === 'SKILL_COOLDOWN_UP' || code === 'SKILL_COOLDOWN_RESET') {
            target.cooldowns ||= {};
            const eligible = (target.skills || []).filter((item) => item.id !== skill.id && item.cooldown > 0 && !item.effects?.some((active) => active.code === 'EXTRA_TURN'));
            if (code === 'SKILL_COOLDOWN_RESET') {
                const reset = eligible.find((item) => (target.cooldowns[item.id] || 0) > 0);
                if (reset) target.cooldowns[reset.id] = 0;
            } else eligible.forEach((item) => {
                const current = target.cooldowns[item.id] || 0;
                target.cooldowns[item.id] = code === 'SKILL_COOLDOWN_DOWN' ? Math.max(0, current - Math.max(1, effect.value)) : Math.min(item.cooldown, current + Math.max(1, effect.value));
            });
            onEffect(target, effect);
            return;
        }
        if (code === 'LIFESTEAL' && directDamage > 0) return healCombatant(source, directDamage * effect.value, 'LIFESTEAL');
        if (code === 'ADDITIONAL_DAMAGE' || code === 'EXTRA_ATTACK') {
            const coefficient = effect.value;
            const damage = applyDirectDamage(source, target, combatStat(source, 'attack') * coefficient, false);
            if (damage) onEffect(target, effect);
            return damage;
        }
        if (code === 'EXTRA_TURN') {
            if (!source.extraTurnUsed) {
                source.extraTurnUsed = true;
                source.extraTurnPending = true;
                onEffect(source, effect);
            }
            return;
        }
        if (code === 'EXTINCTION' && target.hp <= 0) {
            target.extinct = true;
            onEffect(target, effect);
            return;
        }
        if (code === 'DEFENSE_PENETRATION') {
            skill.penetration = Math.max(skill.penetration || 0, effect.value);
            onEffect(source, effect);
            return;
        }
        if (code === 'INJURY') {
            target.originalMaxHp ||= target.maxHp;
            const injury = ((target.effects || []).find((active) => active.code === 'INJURY')?.value || 0) + effect.value;
            addCombatEffect(target, source, { ...effect, value: injury, chance: 1 }, true);
            return;
        }
        addCombatEffect(target, source, { ...effect, chance: 1 }, true);
    }
    
    const preAttackEffectCodes = new Set([
        'DISPEL_BUFF', 'CLEANSE_DEBUFF', 'TRANSFER_DEBUFF', 'BUFF_DURATION_UP', 'BUFF_DURATION_DOWN',
        'DEBUFF_DURATION_UP', 'DEFENSE_PENETRATION',
    ]);
    
    function rollSkillEffects(source, skill, primaryTargets) {
        const rolled = [];
        for (const effect of skill.effects || []) {
            const normalized = normalizedCombatEffect(effect);
            const targets = effectRecipients(normalized, source, primaryTargets, skill);
            for (const target of targets) {
                const opponents = context.party.includes(source) ? context.state.enemies : context.party;
                const accuracyAdjustment = opponents.includes(target)
                    ? (combatStat(source, 'effectHit') - combatStat(target, 'effectResist')) / 100
                    : 0;
                const chance = Math.max(0, Math.min(1, normalized.chance + accuracyAdjustment));
                if (random() < chance) rolled.push({ effect: normalized, target });
            }
        }
        return rolled;
    }
    
    function applySkillEffects(source, skill, rolledEffects, damageByTarget, totalDamage, preAttack, opponentTeam) {
        for (const { effect, target } of rolledEffects) {
            if (preAttackEffectCodes.has(effect.code) !== preAttack) continue;
            if (!preAttack && opponentTeam.includes(target) && skillHasDamage(skill) && !damageByTarget.has(target)) continue;
            const damage = damageByTarget.has(target) ? damageByTarget.get(target) : totalDamage;
            applyInstantEffect(source, skill, target, effect, damage);
        }
    }
    
    function beginNaturalTurn(actor) {
        actor.naturalTurnSerial = (actor.naturalTurnSerial || 0) + 1;
        actor.extraTurnUsed = false;
        actor.counteredThisTurn = false;
        actor.cooldowns ||= {};
        Object.keys(actor.cooldowns).forEach((skillId) => {
            actor.cooldowns[skillId] = Math.max(0, actor.cooldowns[skillId] - 1);
        });
        for (const effect of actor.effects || []) {
            if (effect.code === 'POISON' && applyDirectDamage(effect.source || null, actor, actor.maxHp * effect.value, false)) onEffect(actor, effect);
            if (effect.code === 'BLEED' && applyDirectDamage(effect.source || null, actor, effect.sourceAttack * effect.value, false)) onEffect(actor, effect);
            if (effect.code === 'CONTINUOUS_HEAL') healCombatant(actor, actor.maxHp * effect.value, 'CONTINUOUS_HEAL');
        }
    }
    
    function finishNaturalTurn(actor) {
        tickActorEffects(actor);
        actor.counteredThisTurn = false;
    }
    
    function executeCombatSkill(actor, skill, targets) {
        actor.cooldowns ||= {};
        if (actor.cooldowns[skill.id] > 0) return { damage: 0, healing: 0 };
        if (skill.cooldown > 0) actor.cooldowns[skill.id] = skill.cooldown;
        const ownTeam = context.party.includes(actor) ? context.party : context.state.enemies;
        const opponentTeam = context.party.includes(actor) ? context.state.enemies : context.party;
        const healingAmount = skillHealingAmount(actor, skill);
        const damageByTarget = new Map();
        const rolledEffects = rollSkillEffects(actor, skill, targets);
        applySkillEffects(actor, skill, rolledEffects, damageByTarget, 0, true, opponentTeam);
        let totalDamage = 0;
        let totalHealing = 0;
        for (const target of targets) {
            if (opponentTeam.includes(target) && skillHasDamage(skill) && target.hp > 0) {
                const { damage, critical, hit } = calculateDamage(actor, skill, target);
                if (!hit) {
                    showCombatNumber(target, 'miss', '회피');
                    continue;
                }
                const dealt = applyDirectDamage(actor, target, damage, true, targets.length === 1, critical ? 'critical-punch' : 'punch');
                if (critical && dealt > 0) showCombatNumber(target, 'critical', dealt);
                damageByTarget.set(target, dealt);
                totalDamage += dealt;
            }
            if (ownTeam.includes(target) && target.hp > 0 && healingAmount > 0) totalHealing += healCombatant(target, healingAmount);
        }
        applySkillEffects(actor, skill, rolledEffects, damageByTarget, totalDamage, false, opponentTeam);
        return { damage: totalDamage, healing: totalHealing };
    }
    
    
    function calculateDamage(attacker, skill, target) {
        const attack = combatStat(attacker, 'attack');
        const coefficient = Number(skill.damageCoefficient || 0);
        const coefficients = skill.damageCoefficients;
        const rawDamage = Array.isArray(coefficients)
            ? Math.max(1,
                attack * Number(coefficients[0] || 0)
                + combatStat(attacker, 'defense') * Number(coefficients[1] || 0)
                + combatStat(attacker, 'speed') * Number(coefficients[2] || 0)
                + combatStat(attacker, 'maxHp') * Number(coefficients[3] || 0))
            : Math.max(1, attack * coefficient);
        const attackerEffects = attacker.effects || [];
        const targetEffects = target?.effects || [];
        const chanceFrom = (effects, code) => effects.filter((effect) => effect.code === code).reduce((sum, effect) => sum + effect.value * 100, 0);
        const hitChance = Math.max(0, Math.min(100,
            100 + chanceFrom(attackerEffects, 'HIT_CHANCE_UP')
            - chanceFrom(attackerEffects, 'HIT_CHANCE_DOWN')
            - chanceFrom(targetEffects, 'EVASION_UP')
            + chanceFrom(targetEffects, 'TARGET')));
        if (random() * 100 >= hitChance) return { damage: 0, critical: false, hit: false };
        const critChance = Math.max(0, Math.min(100, combatStat(attacker, 'critChance') - chanceFrom(targetEffects, 'CRITICAL_RESISTANCE_UP')));
        const critical = random() * 100 < critChance;
        const critDamage = combatStat(attacker, 'critDamage') / 100;
        return { damage: Math.max(1, Math.round(critical ? rawDamage * critDamage : rawDamage)), critical, hit: true };
    }
    
    return { addCombatEffect, combatStat, hasCombatEffect, combatTargets, healCombatant, applyDirectDamage, skillHasDamage, skillHealingAmount, beginNaturalTurn, finishNaturalTurn, executeCombatSkill, calculateDamage, effectRecipients };
}
