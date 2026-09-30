import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import XLSX from 'xlsx';

const sourcePath = fileURLToPath(new URL('../public/data/import/Skill_List_500.xlsx', import.meta.url));
const effectsPath = fileURLToPath(new URL('../public/data/import/Skill_Effects_55.xlsx', import.meta.url));
const outputPath = fileURLToPath(new URL('../public/data/import/Skill_List_2000.xlsx', import.meta.url));
const balanceSource = await readFile(new URL('../src/skill-balance.js', import.meta.url), 'utf8');
const { rebalanceSkill } = await import(`data:text/javascript;base64,${Buffer.from(balanceSource).toString('base64')}`);

const categories = ['공격', '회복', '버프', '디버프'];
const categoryCount = 250;
const hybridCategoryCounts = { '공격|버프': 334, '공격|디버프': 333, '회복|버프': 333 };
const totalSkillCount = 2000;
const basicAttackCount = 100;
const targetNames = { 적: '적 1명', 적전체: '모든 적', 자신: '자신', 아군: '아군 1명', '아군과 자신': '아군과 자신', 아군전체: '생존 아군 전체' };

const buffCodes = new Set([
    'ATTACK_UP', 'ATTACK_UP_GREATER', 'DEFENSE_UP', 'SPEED_UP', 'CRITICAL_CHANCE_UP', 'CRITICAL_DAMAGE_UP',
    'EFFECTIVENESS_UP', 'EFFECT_RESISTANCE_UP', 'EVASION_UP', 'CRITICAL_RESISTANCE_UP', 'HIT_CHANCE_UP',
    'CONTINUOUS_HEAL', 'LIFESTEAL', 'BARRIER', 'INVINCIBILITY', 'IMMORTALITY', 'IMMUNITY', 'STEALTH',
    'DAMAGE_REDUCTION', 'DAMAGE_SHARING', 'DAMAGE_REFLECTION', 'AUTO_REVIVE', 'COUNTERATTACK',
    'ADDITIONAL_DAMAGE', 'EXTRA_TURN', 'EXTRA_ATTACK', 'SKILL_COOLDOWN_DOWN', 'SKILL_COOLDOWN_RESET',
    'DEFENSE_PENETRATION', 'CLEANSE_DEBUFF', 'BUFF_DURATION_UP',
]);
const debuffCodes = new Set([
    'ATTACK_DOWN', 'DEFENSE_DOWN', 'SPEED_DOWN', 'HIT_CHANCE_DOWN', 'STUN', 'SLEEP', 'PROVOKE', 'HEAL_BLOCK',
    'BUFF_BLOCK', 'COUNTERATTACK_BLOCK', 'POISON', 'BLEED', 'TARGET', 'CURSE', 'INJURY', 'EXTINCTION',
    'REVIVE_BLOCK', 'SKILL_COOLDOWN_UP', 'DISPEL_BUFF', 'BUFF_DURATION_DOWN', 'DEBUFF_DURATION_UP', 'TRANSFER_DEBUFF',
]);
const recoveryCodes = new Set(['HEAL', 'REVIVE']);
const basicEffectCodes = ['ATTACK_DOWN', 'DEFENSE_DOWN', 'SPEED_DOWN', 'HIT_CHANCE_DOWN', 'TARGET', 'POISON', 'ATTACK_UP', 'SPEED_UP'];
const effectValueUnits = new Set(['활성 플래그', '주회복 실행 플래그']);
const integerUnits = new Set(['추가 턴 수', '턴 수', '초기화 스킬 수', '해제 개수', '연장 턴 수', '단축 턴 수', '전이 개수']);
const targetMultiplier = { 적: 1, 자신: 1, 아군: 1, '아군과 자신': 1.6, 적전체: 2.4, 아군전체: 2.4 };

const prefixes = [
    '서릿달', '청람', '심연', '별무리', '칠흑', '여명', '황혼', '진홍', '백은', '태고', '유성', '월식',
    '일식', '천공', '용혈', '폭풍', '은하', '무명', '고요', '흑요', '설원의', '새벽', '공허', '수정',
    '잊힌', '푸른', '붉은', '그림자', '찬란한', '몰락한',
];
const motifs = [
    '별자리', '달빛', '성운', '운명', '영혼', '왕관', '파편', '서약', '심장', '룬문자', '가시', '파도',
    '불꽃', '빙결', '날개', '메아리', '수정', '안개', '회랑', '별빛', '고대왕', '유리', '검은 태양', '천뢰',
];
const endings = {
    공격: ['검무', '일섬', '관통', '낙성', '강습', '비검', '쇄도', '심판', '파열', '화살의 궤적'],
    회복: ['은총', '성가', '재생', '생명의 서약', '달빛 기도', '소생', '치유 파동', '영혼의 숨결', '성역', '회생의 노래'],
    버프: ['가호', '수호진', '각성', '맹세', '결계', '왕의 서약', '비전', '은폐', '축복', '불멸의 장막'],
    디버프: ['저주', '봉인', '악몽', '쇠약', '침묵', '낙인', '공포', '오염', '속박', '파멸의 인장'],
    '공격|버프': ['수호검무', '가호의 검격', '각성의 비검', '성운 강습', '서약의 일섬', '결계 관통', '왕관의 낙성', '축복의 쇄도', '비전 심판', '불멸의 파열'],
    '공격|디버프': ['쇠약의 검무', '봉인의 일섬', '저주 관통', '침묵의 낙성', '악몽 강습', '오염의 비검', '속박의 쇄도', '공포 심판', '낙인의 파열', '파멸 화살'],
    '회복|버프': ['가호의 은총', '재생의 수호진', '각성의 성가', '결계의 치유', '왕관의 서약', '축복의 소생', '비전 회복진', '불멸의 숨결', '성역의 가호', '생명 각성'],
};

const sourceWorkbook = XLSX.readFile(sourcePath);
const skillRows = XLSX.utils.sheet_to_json(sourceWorkbook.Sheets['스킬 500종'], { header: 1, defval: '', blankrows: false });
const skillHeaders = [...skillRows[4]];
for (let slot = 4; slot >= 1; slot -= 1) {
    const chanceIndex = skillHeaders.indexOf(`스킬효과${slot}확률`);
    skillHeaders.splice(chanceIndex + 1, 0, `스킬효과${slot}지속턴`);
}
skillHeaders.push('기본공격여부');

const rulesRows = XLSX.utils.sheet_to_json(sourceWorkbook.Sheets['효과 규칙 55종'], { header: 1, defval: '', blankrows: false });
const ruleHeaders = rulesRows[2];
const effectRules = new Map(rulesRows.slice(3).filter((row) => row[0]).map((row) => [row[0], Object.fromEntries(ruleHeaders.map((key, index) => [key, row[index] ?? '']))]));
const effectWorkbook = XLSX.readFile(effectsPath);
const effectListRows = XLSX.utils.sheet_to_json(effectWorkbook.Sheets['스킬효과 목록'], { header: 1, defval: '', blankrows: false });
const effectListHeaders = effectListRows[4];
const effectDetails = new Map(effectListRows.slice(5).filter((row) => row[1]).map((row) => [row[1], Object.fromEntries(effectListHeaders.map((key, index) => [key, row[index] ?? '']))]));

const allEffectCodes = new Set(effectRules.keys());
const classifiedCodes = new Set([...buffCodes, ...debuffCodes, ...recoveryCodes]);
if (allEffectCodes.size !== 55 || classifiedCodes.size !== 55 || [...allEffectCodes].some((code) => !classifiedCodes.has(code))) {
    throw new Error(`Effect classification mismatch: ${allEffectCodes.size} rules, ${classifiedCodes.size} classifications.`);
}
if ([...buffCodes].some((code) => debuffCodes.has(code)) || [...recoveryCodes].some((code) => buffCodes.has(code) || debuffCodes.has(code))) {
    throw new Error('Buff, debuff, and recovery effect groups must not overlap.');
}

const roundTo = (value, step) => Number((Math.round(value / step) * step).toFixed(4));

function hashSeed(seed, salt = 0) {
    let value = (seed ^ Math.imul(salt + 1, 0x9e3779b9)) >>> 0;
    value = Math.imul(value ^ (value >>> 16), 0x45d9f3b) >>> 0;
    value = Math.imul(value ^ (value >>> 16), 0x45d9f3b) >>> 0;
    return (value ^ (value >>> 16)) >>> 0;
}

function pick(items, seed, salt = 0) {
    return items[hashSeed(seed, salt) % items.length];
}

function skillNames(category, count) {
    const result = [];
    for (const ending of endings[category]) {
        for (const prefix of prefixes) {
            for (const motif of motifs) {
                result.push(`${prefix} ${motif}의 ${ending}`);
                if (result.length === count) return result;
            }
        }
    }
    throw new Error(`Not enough unique RPG names for ${category}.`);
}

function effectValue(rule, seed, basicAttack = false, hybrid = false) {
    const unit = String(rule['값 단위'] || '');
    const base = Number(rule['기본값']) || 1;
    if (effectValueUnits.has(unit)) return 1;
    const factors = basicAttack ? [0.25, 0.4, 0.55, 0.7] : hybrid ? [0.35, 0.45, 0.55, 0.65] : [0.75, 0.9, 1, 1.1, 1.25];
    const factor = factors[hashSeed(seed, 1) % factors.length];
    if (integerUnits.has(unit)) return Math.max(1, Math.round(base * factor));
    return Math.max(0.05, roundTo(base * factor, 0.05));
}

function makeEffect(code, seed, basicAttack = false, hybrid = false) {
    const rule = effectRules.get(code);
    const details = effectDetails.get(code) || {};
    const unit = rule['값 단위'] || '';
    const fixedChance = ['REVIVE', 'AUTO_REVIVE'].includes(code);
    const chances = basicAttack ? [0.1, 0.15, 0.2, 0.25] : hybrid ? [0.2, 0.3, 0.4, 0.5, 0.6] : [0.4, 0.55, 0.7, 0.85, 1];
    return {
        code,
        name: details['효과명 (name_ko)'] || rule['효과명'] || code,
        englishName: details['영문 이름 (name_en)'] || rule['영문명'] || code,
        value: effectValue(rule, seed, basicAttack, hybrid),
        chance: fixedChance ? 1 : chances[hashSeed(seed, 2) % chances.length],
        duration: Number(rule['지속 턴']) || 0,
        baseValue: Number(rule['기본값']) || 1,
        baseDuration: Number(rule['지속 턴']) || 0,
        baseCost: Number(rule['기준 비용']) || 0,
        unit,
        effectTarget: rule['실제 적용 대상'] || '',
    };
}

function chooseEffects(category, index, isBasicAttack = false) {
    if (isBasicAttack) {
        return hashSeed(index, 3) % 3 !== 0
            ? [makeEffect(pick(basicEffectCodes.filter((code) => debuffCodes.has(code)), index, 4), index, true)]
            : [];
    }
    const parts = category.split('|');
    const hybrid = parts.length > 1;
    if (parts.length === 1 && category === '공격') return [];
    if (category === '회복') return hashSeed(index, 5) % 10 === 0 ? [makeEffect('REVIVE', index * 3)] : [];
    const unavailableHybridCodes = new Set(['REVIVE', 'AUTO_REVIVE', 'INVINCIBILITY', 'IMMORTALITY', 'EXTRA_TURN']);
    const pool = [...new Set([
        ...(parts.includes('버프') ? [...buffCodes] : []),
        ...(parts.includes('디버프') ? [...debuffCodes] : []),
    ])].filter((code) => !hybrid || !unavailableHybridCodes.has(code));
    const count = category === '회복'
        ? [0, 1, 1, 2, 1][hashSeed(index, 5) % 5]
        : hybrid ? 1 + (hashSeed(index, 6) % 2) : 1 + (hashSeed(index, 6) % 3 === 0 ? 1 : 0);
    const selected = [];
    for (let offset = 0; selected.length < count && offset < pool.length * 2; offset += 1) {
        const code = pool[hashSeed(index, offset + 7) % pool.length];
        if (!selected.includes(code)) selected.push(code);
    }
    return selected.map((code, slot) => makeEffect(code, index * 3 + slot, false, hybrid));
}

function targetFor(category, index, effects, isBasicAttack = false) {
    if (effects.some((effect) => effect.code === 'REVIVE')) return '아군';
    const parts = category.split('|');
    if (parts.includes('공격')) return pick(isBasicAttack ? ['적', '적', '적전체', '적'] : ['적', '적', '적전체', '적', '적전체'], index, 11);
    if (parts.includes('회복')) return pick(['아군', '아군전체', '자신', '아군과 자신'], index, 11);
    const options = {
        버프: ['자신', '아군', '아군전체', '아군과 자신'],
        디버프: ['적', '적전체', '적', '적전체'],
    };
    return pick(options[parts[0]], index, 11);
}

function damageCoefficients(index, isBasicAttack, hybrid = false) {
    const coefficients = [0, 0, 0, 0];
    coefficients[0] = isBasicAttack
        ? 0.28 + (hashSeed(index, 13) % 43) * 0.01
        : hybrid ? 0.25 + (hashSeed(index, 14) % 46) * 0.01 : 0.65 + (hashSeed(index, 14) % 91) * 0.01;
    if (isBasicAttack && hashSeed(index, 15) % 3 === 0) {
        const secondary = 1 + (hashSeed(index, 16) % 3);
        coefficients[secondary] = secondary === 3
            ? 0.02 + (hashSeed(index, 17) % 8) * 0.01
            : 0.03 + (hashSeed(index, 18) % 12) * 0.01;
    } else if (!isBasicAttack && hashSeed(index, 19) % (hybrid ? 5 : 3) !== 0) {
        const secondary = 1 + (hashSeed(index, 20) % 3);
        coefficients[secondary] = secondary === 3
            ? (hybrid ? 0.01 + (hashSeed(index, 21) % 5) * 0.01 : 0.04 + (hashSeed(index, 21) % 10) * 0.02)
            : (hybrid ? 0.02 + (hashSeed(index, 22) % 7) * 0.01 : 0.06 + (hashSeed(index, 22) % 18) * 0.02);
    }
    return coefficients;
}

function healingCoefficients(index, hybrid = false) {
    if (hybrid) return hashSeed(index, 23) % 2 === 0
        ? [0.25 + (hashSeed(index, 24) % 41) * 0.01, 0]
        : [0, 0.025 + (hashSeed(index, 25) % 36) * 0.002];
    return hashSeed(index, 23) % 2 === 0
        ? [0.45 + (hashSeed(index, 24) % 100) * 0.01, 0]
        : [0, 0.04 + (hashSeed(index, 25) % 80) * 0.005];
}

function skillTargetScore(skill) {
    return Number(skill.balanceTargetScore) || (skill.isBasicAttack ? 0.4 : skill.category.includes('|') ? 0.68 : 0.9);
}

function tooltipText(skill) {
    const target = { 적: '적 1명', 적전체: '모든 적', 자신: '자신', 아군: '아군 1명', '아군과 자신': '아군과 자신', 아군전체: '생존 아군 전체' }[skill.target] || skill.target;
    const damageLabels = ['공격력', '방어력', '속도', '생명력'];
    const damage = skill.damageCoefficients.map((value, index) => value > 0 ? `${damageLabels[index]} ${value.toFixed(2)}배` : '').filter(Boolean);
    const healing = skill.healingCoefficients.map((value, index) => value > 0 ? `${index === 0 ? '공격력 비례' : '최대 생명력 비례'} ${value.toFixed(2)}배 회복` : '').filter(Boolean);
    const effects = skill.effects.map((effect) => `${effect.name} ${effect.value} · ${Math.round(effect.chance * 100)}%`);
    const parts = [...damage, ...healing, ...effects];
    return `대상: ${target}. ${parts.join('. ')}${parts.length ? '. ' : ''}쿨타임 ${skill.cooldown}턴.`;
}

function makeSkill(category, categoryIndex, globalIndex, seed, isBasicAttack, names) {
    const parts = category.split('|');
    const hybrid = parts.length > 1;
    const effects = chooseEffects(category, seed, isBasicAttack);
    const target = targetFor(category, seed, effects, isBasicAttack);
    const balanceTargetScore = isBasicAttack
        ? 0.28 + (hashSeed(seed, 32) % 13) * 0.01
        : hybrid
            ? 0.58 + (hashSeed(seed, 33) % 17) * 0.01
            : 0.82 + (hashSeed(seed, 34) % 13) * 0.01;
    const skill = {
        id: `SKILL_${String(globalIndex + 1).padStart(4, '0')}`,
        name: names[categoryIndex],
        icon: '',
        target,
        category,
        isBasicAttack,
        balanceTargetScore,
        cooldown: isBasicAttack ? 0 : 1 + (hashSeed(seed, 26) % 5),
        damageCoefficients: parts.includes('공격') ? damageCoefficients(seed, isBasicAttack, hybrid) : [0, 0, 0, 0],
        healingCoefficients: parts.includes('회복') ? healingCoefficients(seed, hybrid) : [0, 0],
        effects,
    };
    let balanced = rebalanceSkill(skill, skillTargetScore(skill));
    if (parts.includes('공격') && !balanced.damageCoefficients.some((value) => value > 0)) {
        skill.effects = [];
        balanced = rebalanceSkill(skill, skillTargetScore(skill));
    }
    if (parts.includes('회복') && !balanced.healingCoefficients.some((value) => value > 0)) {
        skill.effects = [];
        balanced = rebalanceSkill(skill, skillTargetScore(skill));
    }
    return {
        ...balanced,
        tooltipKo: tooltipText(balanced),
        tooltipEn: `A ${category.toLowerCase()} technique. Target: ${target}. Cooldown: ${balanced.cooldown} turns.`,
    };
}

function behaviorFingerprint(skill) {
    return JSON.stringify({
        category: skill.category,
        isBasicAttack: skill.isBasicAttack,
        target: skill.target,
        cooldown: skill.cooldown,
        damageCoefficients: skill.damageCoefficients,
        healingCoefficients: skill.healingCoefficients,
        effects: skill.effects.map((effect) => [effect.code, effect.value, effect.chance, effect.duration, effect.effectTarget]),
    });
}

function rowFromSkill(skill) {
    const row = {
        스킬ID: skill.id,
        이름: skill.name,
        아이콘: '',
        대상: skill.target,
        공격력피해계수: skill.damageCoefficients[0],
        방어력피해계수: skill.damageCoefficients[1],
        속도피해계수: skill.damageCoefficients[2],
        생명력피해계수: skill.damageCoefficients[3],
        공격력비례회복량계수: skill.healingCoefficients[0],
        최대생명력비례회복량계수: skill.healingCoefficients[1],
        쿨타임: skill.cooldown,
        툴팁한글: skill.tooltipKo,
        툴팁영어: skill.tooltipEn,
        유형: skill.category,
        기본공격여부: skill.isBasicAttack ? 'TRUE' : 'FALSE',
        목표사용률: skill.balanceTargetScore,
    };
    for (let slot = 1; slot <= 4; slot += 1) {
        const effect = skill.effects[slot - 1];
        row[`스킬효과${slot}`] = effect?.code || '';
        row[`스킬효과${slot}값`] = effect?.value ?? '';
        row[`스킬효과${slot}확률`] = effect?.chance ?? '';
        row[`스킬효과${slot}지속턴`] = effect?.duration ?? '';
    }
    return row;
}

function verificationMetrics(skill) {
    const target = targetMultiplier[skill.target] || 1;
    const damage = target * skill.damageCoefficients.reduce((sum, value) => sum + value, 0);
    const healing = target * 1.4 * skill.healingCoefficients.reduce((sum, value) => sum + value, 0);
    const effectCountFactor = 1 + 0.08 * Math.max(0, skill.effects.length - 1);
    const effects = target * effectCountFactor * skill.effects.reduce((sum, effect) => {
        const valueRatio = effect.baseValue ? effect.value / effect.baseValue : 1;
        const durationRatio = (1 + effect.duration) / (1 + effect.baseDuration);
        return sum + effect.baseCost * effect.chance * valueRatio * durationRatio;
    }, 0);
    const total = damage + healing + effects;
    const allowed = 1.1 + 0.8 * skill.cooldown;
    return { target, damage, healing, effects, total, allowed, useRate: total / allowed };
}

function setWorkbookSheet(workbook, oldName, newName, sheet) {
    const index = workbook.SheetNames.indexOf(oldName);
    if (index < 0) throw new Error(`Workbook is missing ${oldName}.`);
    delete workbook.Sheets[oldName];
    workbook.SheetNames[index] = newName;
    workbook.Sheets[newName] = sheet;
}

const classifiedEffectCodes = new Set([...buffCodes, ...debuffCodes, ...recoveryCodes]);
if (effectRules.size !== 55 || classifiedEffectCodes.size !== 55 || [...effectRules.keys()].some((code) => !classifiedEffectCodes.has(code))) {
    throw new Error('Effect polarity sets must classify each of the 55 workbook effects exactly once.');
}

const categoryCounts = { ...Object.fromEntries(categories.map((category) => [category, categoryCount])), ...hybridCategoryCounts };
const skillGroups = Object.entries(categoryCounts);
const namesByCategory = Object.fromEntries(skillGroups.map(([category, count]) => [category, skillNames(category, count)]));
const generated = [];
for (const category of Object.keys(categoryCounts)) categoryCounts[category] = 0;
const behaviorFingerprints = new Set();
for (const [groupIndex, [category, count]] of skillGroups.entries()) {
    for (let categoryIndex = 0; categoryIndex < count; categoryIndex += 1) {
        const isBasicAttack = category === '공격' && categoryIndex < basicAttackCount;
        let skill = null;
        for (let attempt = 0; attempt < 600; attempt += 1) {
            const seed = hashSeed(generated.length + 1, categoryIndex * 211 + attempt * 997 + groupIndex * 8191);
            const candidate = makeSkill(category, categoryIndex, generated.length, seed, isBasicAttack, namesByCategory[category]);
            const fingerprint = behaviorFingerprint(candidate);
            if (!behaviorFingerprints.has(fingerprint)) {
                behaviorFingerprints.add(fingerprint);
                skill = candidate;
                break;
            }
        }
        if (!skill) throw new Error(`Could not create a unique behavior for ${category} skill ${categoryIndex + 1}.`);
        generated.push(skill);
        categoryCounts[category] += 1;
    }
}

if (generated.length !== totalSkillCount || new Set(generated.map((skill) => skill.name)).size !== totalSkillCount) throw new Error(`Generated skills must total ${totalSkillCount} unique names.`);
if (behaviorFingerprints.size !== totalSkillCount) throw new Error(`Skill behavior duplicates remain: ${totalSkillCount - behaviorFingerprints.size}.`);
if (generated.filter((skill) => skill.isBasicAttack).length !== 100) throw new Error('Exactly 100 basic attacks must be generated.');
if (generated.some((skill) => skill.effects.length > 2)) throw new Error('Skills cannot have more than two effects.');
if (generated.some((skill) => skill.cooldown !== 0 && skill.isBasicAttack)) throw new Error('Basic attacks must have zero cooldown.');

const workbook = XLSX.readFile(sourcePath);
const originalSkillRows = XLSX.utils.sheet_to_json(workbook.Sheets['스킬 500종'], { header: 1, defval: '', blankrows: false });
const header = [...originalSkillRows[4]];
for (let slot = 4; slot >= 1; slot -= 1) {
    const chanceIndex = header.indexOf(`스킬효과${slot}확률`);
    header.splice(chanceIndex + 1, 0, `스킬효과${slot}지속턴`);
}
header.push('기본공격여부');
header.push('목표사용률');
const skillRowsOut = [
    ['스킬 2000종 · 단일 유형 1000개 + 복합 유형 1000개 · 행동값 중복 금지'],
    ['공격/회복/버프/디버프 단일 유형 각 250개 · 복합 공격/버프 334개 · 공격/디버프 333개 · 회복/버프 333개'],
    ['효과 2개 이하 · 버프/디버프 동시 포함 없음 · 복합 유형의 계수 및 효과 수치/확률 하향'],
    ['피해 및 회복 계수는 런타임 스탯에 따라 계산하며, 지속시간은 스킬별 효과 열을 우선합니다.'],
    header,
    ...generated.map((skill) => {
        const values = rowFromSkill(skill);
        return header.map((key) => values[key] ?? '');
    }),
];
const skillSheet = XLSX.utils.aoa_to_sheet(skillRowsOut);
skillSheet['!cols'] = header.map((name) => ({ wch: name.includes('툴팁') ? 58 : name.includes('지속턴') ? 12 : name === '이름' ? 30 : 16 }));
setWorkbookSheet(workbook, '스킬 500종', '스킬 2000종', skillSheet);

const commonRows = XLSX.utils.sheet_to_json(workbook.Sheets['공통 규칙'], { header: 1, defval: '', blankrows: false });
commonRows[0][0] = '공통 규칙 · 2000종 스킬 구현 및 조정 기준';
commonRows[2][1] = '스킬 2000개: 단일 유형 4종 각 250개와 복합 유형 3종 1000개를 포함하며, 기본 공격 100개는 공격 유형에 포함합니다.';
const durationRule = commonRows.find((row) => row[0] === '지속시간');
if (durationRule) durationRule[1] = '효과코드별 기본 지속시간을 사용하며 스킬별 지속턴 열 값이 있으면 우선합니다. 대상에게 정상 적용된 뒤 다음 자연 턴부터 턴 종료마다 1 감소합니다. 추가 턴은 지속시간을 소모하지 않습니다.';
commonRows.push(
    ['분류 및 효과 제한', '단일 유형 공격·회복·버프·디버프는 각 250개입니다. 복합 유형은 공격/버프 334개, 공격/디버프 333개, 회복/버프 333개입니다. 버프와 디버프를 동시에 포함하지 않으며 스킬당 효과는 최대 2개입니다. 복합 유형은 계수와 효과 수치/확률을 단일 유형보다 낮게 구성합니다.'],
    ['기본 공격', '기본 공격 100개는 공격 유형 250개에 포함합니다. 쿨타임 0이며 낮은 개별 목표 사용률과 낮은 효과 확률/값을 사용합니다.'],
    ['직업별 배치', '모든 용병은 개인 기본 공격 스킬을 참조합니다. 정령사는 회복·버프·디버프 스킬을 우선 배치하고 회복 스킬을 최소 1개 포함합니다. 다른 직업에는 회복 스킬을 배치하지 않습니다.'],
);
const commonSheet = XLSX.utils.aoa_to_sheet(commonRows);
commonSheet['!cols'] = [{ wch: 24 }, { wch: 110 }];
workbook.Sheets['공통 규칙'] = commonSheet;

const verificationRows = [
    ['밸런스 검증 · 스킬 2000종'],
    [],
    ['분류', '개수'],
    ...skillGroups.map(([category]) => [category, categoryCounts[category]]),
    ['기본 공격', generated.filter((skill) => skill.isBasicAttack).length],
    ['효과 전용 버프/디버프', generated.filter((skill) => skill.category.split('|').some((part) => ['버프', '디버프'].includes(part)) && skill.damageCoefficients.every((value) => value === 0) && skill.healingCoefficients.every((value) => value === 0)).length],
    [],
    ['ID', '이름', '유형', '대상', '효과 수', '쿨타임', '목표 점수', '적용 점수', '판정', '기본 공격'],
    ...generated.map((skill) => {
        const score = verificationMetrics(skill).useRate;
        return [skill.id, skill.name, skill.category, skill.target, skill.effects.length, skill.cooldown, skillTargetScore(skill), Number(score.toFixed(4)), Math.abs(score - skillTargetScore(skill)) <= 0.02 ? '정상' : '조정 한계', skill.isBasicAttack ? 'TRUE' : 'FALSE'];
    }),
];
const verificationSheet = XLSX.utils.aoa_to_sheet(verificationRows);
verificationSheet['!cols'] = [{ wch: 16 }, { wch: 30 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 14 }];
workbook.Sheets['밸런스 검증'] = verificationSheet;

await mkdir(new URL('../public/data/import/', import.meta.url), { recursive: true });
XLSX.writeFile(workbook, outputPath);
console.log(`Generated ${outputPath}`);
console.log(`Categories: ${JSON.stringify(categoryCounts)}; basic attacks: ${generated.filter((skill) => skill.isBasicAttack).length}`);
console.log(`Effect-only buff/debuff skills: ${generated.filter((skill) => ['버프', '디버프'].includes(skill.category) && skill.damageCoefficients.every((value) => value === 0) && skill.healingCoefficients.every((value) => value === 0)).length}`);