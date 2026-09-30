const targetMultipliers = { 적: 1, 자신: 1, 아군: 1, '아군과 자신': 1.6, 적전체: 2.4, 아군전체: 2.4 };
const integerEffectUnits = new Set(['추가 턴 수', '턴 수', '초기화 스킬 수', '해제 개수', '연장 턴 수', '단축 턴 수', '전이 개수']);
const scoreTolerance = 0.02;

function roundToStep(value, step) {
    return Number((Math.round(value / step) * step).toFixed(4));
}

function rebalanceEffectValue(effect, scale) {
    if (['활성 플래그', '주회복 실행 플래그'].includes(effect.unit) || ['REVIVE', 'AUTO_REVIVE'].includes(effect.code)) return effect.value;
    const value = effect.value * scale;
    if (integerEffectUnits.has(effect.unit)) return Math.max(1, Math.round(value));
    return Math.max(0.05, roundToStep(value, 0.05));
}

function calculateScore(skill) {
    const targetMultiplier = targetMultipliers[skill.target] || 1;
    const damage = targetMultiplier * skill.damageCoefficients.reduce((sum, value) => sum + value, 0);
    const healing = targetMultiplier * 1.4 * skill.healingCoefficients.reduce((sum, value) => sum + value, 0);
    const effectCountFactor = 1 + 0.08 * Math.max(0, skill.effects.length - 1);
    const effects = targetMultiplier * effectCountFactor * skill.effects.reduce((sum, effect) => {
        const valueRatio = effect.baseValue ? effect.value / effect.baseValue : 1;
        const durationRatio = (1 + effect.duration) / (1 + effect.baseDuration);
        return sum + effect.baseCost * effect.chance * valueRatio * durationRatio;
    }, 0);
    const allowedCost = 1.1 + 0.8 * skill.cooldown;
    return (damage + healing + effects) / allowedCost;
}

function withScale(skill, scale) {
    return {
        ...skill,
        damageCoefficients: skill.damageCoefficients.map((value) => roundToStep(value * scale, 0.01)),
        healingCoefficients: skill.healingCoefficients.map((value) => roundToStep(value * scale, 0.01)),
        effects: skill.effects.map((effect) => {
            const fixedChance = ['REVIVE', 'AUTO_REVIVE'].includes(effect.code);
            return {
                ...effect,
                value: rebalanceEffectValue(effect, scale),
                chance: fixedChance ? effect.chance : Math.max(0.05, Math.min(1, roundToStep(effect.chance * scale, 0.05))),
                duration: effect.duration,
            };
        }),
    };
}

function scaleToTarget(skill, targetScore) {
    const scoreAt = (scale) => calculateScore(withScale(skill, scale));
    const minScore = scoreAt(0);
    const maxScore = scoreAt(64);
    if (targetScore < minScore) {
        const balanced = withScale(skill, 0);
        return { skill: balanced, scale: 0, scoreAfter: calculateScore(balanced) };
    }
    if (targetScore > maxScore) {
        const balanced = withScale(skill, 64);
        return { skill: balanced, scale: 64, scoreAfter: calculateScore(balanced) };
    }
    if (Math.abs(scoreAt(1) - targetScore) <= 0.000001) {
        const balanced = withScale(skill, 1);
        return { skill: balanced, scale: 1, scoreAfter: calculateScore(balanced) };
    }

    let low = 0;
    let high = 64;
    for (let iteration = 0; iteration < 48; iteration += 1) {
        const middle = (low + high) / 2;
        if (scoreAt(middle) < targetScore) low = middle;
        else high = middle;
    }
    const scale = Math.abs(scoreAt(low) - targetScore) < Math.abs(scoreAt(high) - targetScore) ? low : high;
    const balanced = withScale(skill, scale);
    return { skill: balanced, scale, scoreAfter: calculateScore(balanced) };
}

function neighboringSkills(skill, targetScore) {
    const candidates = [];
    const maxEffectDuration = skill.isBasicAttack ? 1 : 2;
    const adjustArray = (key, step, minimum) => {
        skill[key].forEach((value, index) => {
            if (value <= 0) return;
            for (const direction of [-1, 1]) {
                const nextValue = roundToStep(value + direction * step, step);
                if (nextValue < minimum) continue;
                const values = [...skill[key]];
                values[index] = nextValue;
                candidates.push({ ...skill, [key]: values });
            }
        });
    };
    adjustArray('damageCoefficients', 0.01, 0.01);
    adjustArray('healingCoefficients', 0.01, 0.01);
    skill.effects.forEach((effect, index) => {
        const fixedEffect = ['REVIVE', 'AUTO_REVIVE'].includes(effect.code);
        const effects = skill.effects;
        if (!fixedEffect) {
            for (const direction of [-1, 1]) {
                const chance = roundToStep(effect.chance + direction * 0.05, 0.05);
                if (chance < 0.05 || chance > 1) continue;
                candidates.push({ ...skill, effects: effects.map((item, itemIndex) => itemIndex === index ? { ...item, chance } : item) });
            }
            if (!['활성 플래그', '주회복 실행 플래그'].includes(effect.unit)) {
                const integerUnit = integerEffectUnits.has(effect.unit);
                const step = integerUnit ? 1 : 0.05;
                const minimum = integerUnit ? 1 : 0.05;
                const maximum = integerUnit ? 10 : Math.max(effect.baseValue * 3, effect.value * 2, 0.1);
                for (const direction of [-1, 1]) {
                    const value = roundToStep(effect.value + direction * step, step);
                    if (value < minimum || value > maximum) continue;
                    const changedValue = effects.map((item, itemIndex) => itemIndex === index ? { ...item, value } : item);
                    candidates.push({ ...skill, effects: changedValue });
                    const noChanceScore = calculateScore({ ...skill, effects: changedValue.map((item, itemIndex) => itemIndex === index ? { ...item, chance: 0 } : item) });
                    const fullChanceScore = calculateScore({ ...skill, effects: changedValue.map((item, itemIndex) => itemIndex === index ? { ...item, chance: 1 } : item) });
                    if (fullChanceScore <= noChanceScore) continue;
                    const requiredChance = (targetScore - noChanceScore) / (fullChanceScore - noChanceScore);
                    const chanceSteps = [Math.floor(requiredChance / 0.05) * 0.05, Math.ceil(requiredChance / 0.05) * 0.05];
                    chanceSteps.forEach((combinedChance) => {
                        if (combinedChance < 0.05 || combinedChance > 1) return;
                        candidates.push({ ...skill, effects: changedValue.map((item, itemIndex) => itemIndex === index ? { ...item, chance: roundToStep(combinedChance, 0.05) } : item) });
                    });
                }
            }
        }
        if (effect.duration > 0 && effect.baseDuration > 0) {
            for (const direction of [-1, 1]) {
                const duration = effect.duration + direction;
                if (duration < 1 || duration > maxEffectDuration) continue;
                candidates.push({ ...skill, effects: effects.map((item, itemIndex) => itemIndex === index ? { ...item, duration } : item) });
            }
        }
    });
    for (const cooldown of [skill.cooldown - 1, skill.cooldown + 1]) {
        if (cooldown >= 1 && cooldown <= 5) candidates.push({ ...skill, cooldown });
    }
    return candidates;
}

function improveQuantizedSkill(skill, score, targetScore) {
    let current = skill;
    let currentScore = score;
    for (let iteration = 0; iteration < 80 && Math.abs(currentScore - targetScore) > scoreTolerance; iteration += 1) {
        let best = null;
        for (const candidate of neighboringSkills(current, targetScore)) {
            const candidateScore = calculateScore(candidate);
            const error = Math.abs(candidateScore - targetScore);
            if (error < Math.abs(currentScore - targetScore) - 0.000001 && (!best || error < best.error)) {
                best = { skill: candidate, score: candidateScore, error };
            }
        }
        if (!best) break;
        current = best.skill;
        currentScore = best.score;
    }
    return { skill: current, scoreAfter: currentScore };
}

export function rebalanceSkill(skill, targetScore = 0.9) {
    const maxEffectDuration = skill.isBasicAttack ? 1 : 2;
    const sourceSkill = {
        ...skill,
        effects: skill.effects.map((effect) => ({ ...effect, duration: Math.min(effect.duration, maxEffectDuration) })),
    };
    let result = scaleToTarget(sourceSkill, targetScore);
    if (Math.abs(result.scoreAfter - targetScore) > scoreTolerance && sourceSkill.effects.length) {
        let durations = sourceSkill.effects.map((effect) => effect.duration);
        let current = result;
        for (let pass = 0; pass < 8 && Math.abs(current.scoreAfter - targetScore) > scoreTolerance; pass += 1) {
            let best = null;
            for (let slot = 0; slot < sourceSkill.effects.length; slot += 1) {
                const sourceEffect = sourceSkill.effects[slot];
                const choices = sourceEffect.baseDuration === 0 && sourceEffect.duration === 0
                    ? [0]
                    : Array.from({ length: maxEffectDuration }, (_, index) => index + 1);
                for (const duration of choices) {
                    if (duration === durations[slot]) continue;
                    const candidateDurations = [...durations];
                    candidateDurations[slot] = duration;
                    const candidateSkill = {
                        ...sourceSkill,
                        effects: sourceSkill.effects.map((effect, index) => ({ ...effect, duration: candidateDurations[index] })),
                    };
                    const candidate = scaleToTarget(candidateSkill, targetScore);
                    const error = Math.abs(candidate.scoreAfter - targetScore);
                    const durationChange = candidateDurations.reduce((sum, value, index) => sum + Math.abs(value - sourceSkill.effects[index].duration), 0);
                    const cost = error + durationChange * 0.0001;
                    if (!best || cost < best.cost) best = { ...candidate, durations: candidateDurations, cost };
                }
            }
            if (!best || Math.abs(best.scoreAfter - targetScore) >= Math.abs(current.scoreAfter - targetScore) - 0.0001) break;
            durations = best.durations;
            current = best;
        }
        result = current;
    }

    const improved = Math.abs(result.scoreAfter - targetScore) > scoreTolerance
        ? improveQuantizedSkill(result.skill, result.scoreAfter, targetScore)
        : { skill: result.skill, scoreAfter: result.scoreAfter };
    const balanced = improved.skill;
    const scoreAfter = improved.scoreAfter;
    return {
        ...balanced,
        scoreAfter,
        targetScore,
        balanceScale: result.scale,
        balanceReached: Math.abs(scoreAfter - targetScore) <= scoreTolerance,
        durationAdjusted: balanced.effects.some((effect, index) => effect.duration !== skill.effects[index].duration),
    };
}