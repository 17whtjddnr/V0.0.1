import * as XLSX from 'xlsx';
import { rebalanceSkill } from './skill-balance.js';
import { generateRosters } from './roster-generation.mjs';
import { initialAffinityFor, zodiacGlyphs, zodiacNames } from './zodiac-affinity.mjs';
import plazaFirstVisitDialogue from '../data/dialogues/plaza-first-visit.json';
import plazaFirstEncounterDialogue from '../data/dialogues/plaza-first-encounter.json';
import plazaFirstConversationDialogue from '../data/dialogues/plaza-first-conversation.json';

const game = document.querySelector('#game');

let loadingProgress = 4;
let loadingDotCount = 1;
const loadingDots = document.querySelector('#loading-dots');
const loadingProgressFill = document.querySelector('#loading-progress-fill');
const loadingProgressTrack = document.querySelector('#loading-progress-track');
const loadingDotsTimer = window.setInterval(() => {
    loadingDotCount = loadingDotCount % 3 + 1;
    if (loadingDots) loadingDots.textContent = '.'.repeat(loadingDotCount);
}, 350);

function updateLoadingProgress(progress) {
    loadingProgress = Math.max(loadingProgress, Math.min(100, progress));
    if (loadingProgressFill) loadingProgressFill.style.width = `${loadingProgress}%`;
    if (loadingProgressTrack) loadingProgressTrack.setAttribute('aria-valuenow', String(Math.round(loadingProgress)));
}

function waitForBackgroundMusicReady(timeoutMs = 12000) {
    if (backgroundMusic.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) return Promise.resolve();
    return new Promise((resolve) => {
        let finished = false;
        const finish = () => {
            if (finished) return;
            finished = true;
            window.clearTimeout(timeout);
            backgroundMusic.removeEventListener('canplay', finish);
            backgroundMusic.removeEventListener('canplaythrough', finish);
            backgroundMusic.removeEventListener('error', finish);
            resolve();
        };
        const timeout = window.setTimeout(finish, timeoutMs);
        backgroundMusic.addEventListener('canplay', finish);
        backgroundMusic.addEventListener('canplaythrough', finish);
        backgroundMusic.addEventListener('error', finish);
        if (backgroundMusic.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) finish();
    });
}

async function finishInitialLoading() {
    await waitForBackgroundMusicReady();
    updateLoadingProgress(100);
    return new Promise((resolve) => {
        window.setTimeout(() => {
            window.clearInterval(loadingDotsTimer);
            game.classList.remove('loading-screen');
            resolve();
        }, 180);
    });
}

let party = [];

const defaultSkills = [
    { id: 'strike', name: '무기 공격', target: 'enemy', icon: '⚔', damageCoefficient: 0.85, cooldown: 0, description: '선택한 적에게 기본 피해를 줍니다.' },
    { id: 'power', name: '방패 강타', target: 'enemy', icon: '✦', damageCoefficient: 1.45, effects: [{ type: 'stun', chance: 30, turns: 1 }], cooldown: 2, description: '30% 확률로 적을 1턴간 기절시킵니다.' },
    { id: 'recover', name: '전열 정비', target: 'ally', icon: '✚', heal: { attackCoefficient: 1, maxHpCoefficient: 0.06 }, cooldown: 2, description: '선택한 아군을 회복합니다.' },
    { id: 'resolve', name: '정신 집중', target: 'self', icon: '◈', effects: [{ type: 'attackUp', chance: 100, turns: 1, value: 0.2 }], cooldown: 3, description: '1턴간 공격력을 높입니다.' },
];

function battleSkillsFor(actor) {
    return actor?.skills?.length ? actor.skills : defaultSkills;
}

function battleTargetFor(skill) {
    const targets = { 적: 'enemy', 적전체: 'enemyAll', 아군: 'ally', 아군전체: 'allyAll', 자신: 'self', '아군과 자신': 'selfAndAllies' };
    return targets[skill?.target] || skill?.target || 'enemy';
}

const rooms = [
    { name: '잊힌 회랑', type: '탐색', icon: '⌂' },
    { name: '핏빛 문턱', type: '전투', icon: '⚔' },
    { name: '무너진 예배당', type: '탐색', icon: '✦' },
    { name: '버려진 납골당', type: '전투', icon: '⚔' },
    { name: '갈라진 회랑', type: '탐색', icon: '⌂' },
    { name: '고해의 제단', type: '전투', icon: '⚔' },
    { name: '심연의 문', type: '보스', icon: '☠' },
];

const state = {
    view: 'lobby',
    lobbyDialog: '',
    lobbyMessage: '',
    playerSetupStep: 'name',
    playerDraftName: '',
    playerSetupMessage: '',
    playerZodiac: '',
    playerName: '방랑자',
    userLevel: 1,
    experience: 0,
    experienceToNextLevel: 100,
    week: 1,
    guildMembers: [],
    affinityByCharacterId: {},
    fixedCostNoticeShown: false,
    plazaDialog: '',
    activePlazaDialogue: null,
    recruits: [],
    plazaOffers: [],
    plazaCurrentOffer: null,
    plazaMessage: '',
    plazaGiftedIds: [],
    plazaGuildInvitedIds: [],
    catalogReturnView: 'plaza',
    catalogTab: 'skills',
    catalogSearch: '',
    catalogType: '',
    catalogTarget: '',
    catalogEffect: '',
    catalogZodiac: '',
    catalogJob: '',
    catalogGrade: '',
    catalogElement: '',
    catalogLevel: 1,
    catalogSort: { key: '', direction: 'initial' },
    catalogPage: 0,
    characterCodexTab: 'characters',
    catalogSelectedRosterId: 'CHAR-001',
    room: 0,
    gold: 175,
    mode: 'explore',
    turn: 0,
    enemies: [],
    turnOrder: [],
    turnOrderIndex: 0,
    enemyPhase: false,
    actingEnemy: -1,
    enemyAttackLanded: false,
    selectedSkill: null,
    skillNotice: null,
    message: '검은 회랑의 입구에 도착했습니다.',
    log: ['원정대가 검은 회랑의 입구에 도착했습니다.'],
    ended: false,
    expeditionResult: null,
    expeditionRewardBaseline: null,
};

const initialState = JSON.parse(JSON.stringify(state));
const legacySaveStorageKey = 'alpha-guild-master-save-v1';
const saveSlotStorageKeys = {
    autosave: 'alpha-guild-master-autosave-v1',
    slot1: 'alpha-guild-master-slot-1-v1',
    slot2: 'alpha-guild-master-slot-2-v1',
    slot3: 'alpha-guild-master-slot-3-v1',
    slot4: 'alpha-guild-master-slot-4-v1',
};
const saveSlots = [
    { id: 'autosave', label: '오토세이브' },
    { id: 'slot1', label: '세이브 슬롯 1' },
    { id: 'slot2', label: '세이브 슬롯 2' },
    { id: 'slot3', label: '세이브 슬롯 3' },
    { id: 'slot4', label: '세이브 슬롯 4' },
];
const musicVolumeStorageKey = 'alpha-guild-master-volume-v1';
const soundEffectsVolumeStorageKey = 'alpha-guild-master-sfx-volume-v1';
let gameMenuOpen = false;
let gameMenuMode = 'menu';
let gameMenuNotice = '';
const backgroundMusicTracks = {
    lobby: 'Loby.mp3',
    playerSetup: 'Loby.mp3',
    plaza: 'Town.mp3',
    catalog: 'Town.mp3',
    expedition: 'Dungeon.mp3',
};
const backgroundMusic = new Audio();
backgroundMusic.loop = true;
function readStoredVolume(storageKey, fallback, maximum = 1) {
    try {
        const storedValue = localStorage.getItem(storageKey);
        if (storedValue === null) return fallback;
        const storedVolume = Number(storedValue);
        return Number.isFinite(storedVolume) ? Math.min(maximum, Math.max(0, storedVolume)) : fallback;
    } catch {
        return fallback;
    }
}
backgroundMusic.volume = readStoredVolume(musicVolumeStorageKey, 0.4);
let soundEffectsVolume = readStoredVolume(soundEffectsVolumeStorageKey, 0.4);
backgroundMusic.preload = 'auto';

function tryPlayBackgroundMusic() {
    if (!backgroundMusic.paused || backgroundMusic.volume === 0) return;
    backgroundMusic.play().catch((error) => {
        if (error.name !== 'NotAllowedError') console.warn('Background music playback failed.', error);
    });
}

backgroundMusic.addEventListener('canplay', tryPlayBackgroundMusic);
document.addEventListener('pointerdown', tryPlayBackgroundMusic, { capture: true, passive: true });
document.addEventListener('keydown', tryPlayBackgroundMusic, true);

function syncBackgroundMusic() {
    const filename = backgroundMusicTracks[state.view] || backgroundMusicTracks.lobby;
    const source = `/assets/sound/Bgm/${filename}`;
    if (backgroundMusic.getAttribute('src') !== source) {
        backgroundMusic.src = source;
        backgroundMusic.load();
    }
    tryPlayBackgroundMusic();
}

syncBackgroundMusic();

let webSoundContext;

function playWebSound(kind) {
    if (soundEffectsVolume === 0) return;
    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextConstructor) return;
    try {
        webSoundContext ||= new AudioContextConstructor();
        if (webSoundContext.state === 'suspended') void webSoundContext.resume();
        const profiles = {
            hover: { frequency: 720 + Math.random() * 90, endFrequency: 910, duration: 0.055, volume: 0.14, type: 'sine' },
            click: { frequency: 470 + Math.random() * 40, endFrequency: 310, duration: 0.075, volume: 0.24, type: 'triangle' },
            hit: { frequency: 115 + Math.random() * 65, endFrequency: 58, duration: 0.14, volume: 0.64, type: 'triangle' },
        };
        const profile = profiles[kind];
        if (!profile) return;
        const oscillator = webSoundContext.createOscillator();
        const gain = webSoundContext.createGain();
        const now = webSoundContext.currentTime;
        oscillator.type = profile.type;
        oscillator.frequency.setValueAtTime(profile.frequency, now);
        oscillator.frequency.exponentialRampToValueAtTime(profile.endFrequency, now + profile.duration);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(profile.volume * soundEffectsVolume, now + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + profile.duration);
        oscillator.connect(gain);
        gain.connect(webSoundContext.destination);
        oscillator.start(now);
        oscillator.stop(now + profile.duration);
    } catch (error) {
        console.warn('A web sound could not be played.', error);
    }
}

const statLabels = [
    ['attack', '공격력'], ['defense', '방어력'], ['maxHp', '체력'], ['critChance', '치명타 확률'],
    ['critDamage', '치명타 피해'], ['effectHit', '효과 적중'], ['effectResist', '효과 저항'], ['speed', '속도'],
];

const targetLabels = { self: '자신', ally: '아군', allyAll: '아군 전체', selfAndAllies: '자신과 아군', enemy: '적군', enemyAll: '적군 전체', 자신: '자신', 아군: '아군 1명', 아군전체: '아군 전체', '아군과 자신': '아군과 자신', 적: '적 1명', 적전체: '적 전체' };

const effectLabels = {
    stun: (effect) => `대상을 ${effect.turns}턴간 기절`,
    poison: (effect) => `대상에게 중독 ${effect.turns}턴 부여`,
    attackUp: (effect) => `${effect.turns}턴간 공격력 ${Math.round(effect.value * 100)}% 증가`,
    attackDown: (effect) => `대상에게 공격력 감소 ${effect.turns}턴 부여`,
    defenseDown: (effect) => `대상에게 방어력 감소 ${effect.turns}턴 부여`,
    defenseUp: (effect) => `${effect.turns}턴간 방어력 ${Math.round(effect.value * 100)}% 증가`,
    revive: () => '사망한 대상 부활',
};

function skillDamagePreview(actor, skill) {
    if (!actor || !skillHasDamage(skill)) return null;
    const statSources = [
        ['attack', '공격력'], ['defense', '방어력'], ['speed', '속도'], ['maxHp', '최대 생명력'],
    ];
    const coefficients = skill.damageCoefficients;
    const components = [];
    let rawDamage = 0;
    if (Array.isArray(coefficients)) {
        statSources.forEach(([key, label], index) => {
            const coefficient = Number(coefficients[index] || 0);
            if (coefficient <= 0) return;
            const value = combatStat(actor, key);
            rawDamage += value * coefficient;
            components.push({ label, value, coefficient });
        });
    } else {
        const coefficient = Number(skill.damageCoefficient || 0);
        if (coefficient > 0) {
            const value = combatStat(actor, 'attack');
            rawDamage = value * coefficient;
            components.push({ label: '공격력', value, coefficient });
        }
    }
    const damage = Math.max(1, Math.round(Math.max(1, rawDamage)));
    const formatValue = (value) => Number(value.toFixed(2)).toString();
    return {
        damage,
        calculation: components.length
            ? `${components.map(({ label, value, coefficient }) => `${label} ${formatValue(value)} × ${coefficient.toFixed(2)}`).join(' + ')} = ${damage}`
            : `최소 피해 적용 = ${damage}`,
        coefficients: components.length
            ? components.map(({ label, coefficient }) => `${label} ${coefficient.toFixed(2)}x`).join(' + ')
            : '최소 피해',
    };
}

function skillTooltip(skill, actor = null) {
    const rows = [`<div class="tooltip-row"><span>스킬 대상</span><strong>${targetLabels[skill.target] || skill.target}</strong></div>`];
    const damagePreview = skillDamagePreview(actor, skill);
    if (damagePreview) {
        rows.push(`<div class="tooltip-row"><span>계산 피해량</span><strong>${damagePreview.damage}</strong></div>`);
        rows.push(`<div class="skill-damage-calculation">${escapeHtml(damagePreview.calculation)}</div>`);
        rows.push(`<div class="skill-coefficient-note">계수 · ${escapeHtml(damagePreview.coefficients)}</div>`);
    } else if (skill.damage?.length) rows.push(`<div class="tooltip-row"><span>피해계수</span><strong>${skill.damage.map(escapeHtml).join(' + ')}</strong></div>`);
    else if (skill.damageCoefficient) rows.push(`<div class="tooltip-row"><span>피해계수</span><strong>${skill.damageCoefficient.toFixed(2)}x</strong></div>`);
    if (skill.healing?.length) rows.push(`<div class="tooltip-row"><span>회복계수</span><strong>${skill.healing.map(escapeHtml).join(' + ')}</strong></div>`);
    if (skill.heal) {
        const ratios = [];
        if (skill.heal.attackCoefficient) ratios.push(`공격력 ${skill.heal.attackCoefficient.toFixed(2)}x`);
        if (skill.heal.maxHpCoefficient) ratios.push(`생명력 ${(skill.heal.maxHpCoefficient * 100).toFixed(1)}%`);
        if (skill.heal.damageCoefficient) ratios.push(`피해량 ${skill.heal.damageCoefficient.toFixed(2)}x`);
        rows.push(`<div class="tooltip-row"><span>회복비례</span><strong>${ratios.join(' + ')}</strong></div>`);
    }
    const effects = skill.effects || (skill.effect ? [skill.effect] : []);
    effects.slice(0, 4).forEach((effect) => {
        const code = effect.code || effect.type;
        const effectText = effect.name || effectLabels[effect.type]?.(effect) || code;
        const chance = Number(effect.chance ?? 1);
        const chancePercent = chance > 1 ? chance : chance * 100;
        const magnitude = effect.code ? effectMagnitude(effect, 'ko') : '';
        const duration = Number(effect.duration ?? effect.turns ?? 0);
        const chanceText = `${Math.round(chancePercent)}% 확률로 `;
        const durationText = duration > 0 ? ` · ${duration}턴` : '';
        rows.push(`<div class="tooltip-row"><span>효과</span><strong>${chanceText}${effectText}${magnitude ? ` ${magnitude}` : ''}${durationText} · 효과 대상: ${describeEffectTarget(skill, effect)}</strong></div>`);
    });
    rows.push(`<div class="tooltip-row"><span>쿨타임</span><strong>${skill.cooldown ? `${skill.cooldown}턴` : '없음'}</strong></div>`);
    return `<div class="skill-tooltip"><div class="tooltip-title">${skill.name}</div>${rows.join('')}</div>`;
}

function characterTooltip(hero) {
    const rows = statLabels.map(([key, label]) => `<div class="character-stat-row"><span>${label}</span><b>${hero.baseStats?.[key] ?? hero.stats?.[key] ?? 0}</b><strong>${Math.round(combatStat(hero, key) * 100) / 100}</strong></div>`);
    return `<div class="character-tooltip"><div class="character-tooltip-title">${hero.name}<small>${hero.element} · ${hero.job}</small></div><div class="character-stat-head"><span>기준</span><span>현재</span></div>${rows.join('')}</div>`;
}

function workbookNumber(value) {
    return value === '' || value === null || value === undefined ? undefined : Number(value);
}

function workbookSkill(row) {
    const skill = {
        id: String(row.id || '').trim(),
        name: String(row.name || '').trim(),
        icon: String(row.icon || '✦').trim(),
        target: String(row.target || 'enemy').trim(),
        description: String(row.description || '').trim(),
        cooldown: workbookNumber(row.cooldown) || 0,
    };
    const damageCoefficient = workbookNumber(row.damageCoefficient);
    const healAttackCoefficient = workbookNumber(row.healAttackCoefficient);
    const healMaxHpCoefficient = workbookNumber(row.healMaxHpCoefficient);
    const effectTurns = workbookNumber(row.effectTurns);
    const effectValue = workbookNumber(row.effectValue);
    if (damageCoefficient !== undefined) skill.damageCoefficient = damageCoefficient;
    if (healAttackCoefficient !== undefined || healMaxHpCoefficient !== undefined) {
        skill.heal = { attackCoefficient: healAttackCoefficient, maxHpCoefficient: healMaxHpCoefficient };
    }
    const effects = [1, 2, 3, 4].map((slot) => {
        const type = String(row[`effect${slot}Type`] || '').trim();
        if (!type) return null;
        return {
            type,
            chance: workbookNumber(row[`effect${slot}Chance`]) ?? 100,
            turns: workbookNumber(row[`effect${slot}Turns`]),
            value: workbookNumber(row[`effect${slot}Value`]),
        };
    }).filter(Boolean);
    if (effects.length) skill.effects = effects;
    if (!effects.length && row.effectType) skill.effects = [{ type: String(row.effectType).trim(), chance: 100, turns: effectTurns, value: effectValue }];
    return skill;
}

async function loadSkills() {
    for (const filename of ['skills-editable.xlsx', 'skills.xlsx']) {
        try {
            const response = await fetch(`/data/${filename}`, { cache: 'no-store' });
            if (!response.ok) continue;
            const workbook = XLSX.read(await response.arrayBuffer(), { type: 'array' });
            const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' });
            const loaded = rows.map(workbookSkill).filter((skill) => skill.id && skill.name);
            if (loaded.length === defaultSkills.length) {
                updateLoadingProgress(20);
                return loaded;
            }
        } catch (error) {
            console.warn(`${filename} could not be loaded.`, error);
        }
    }
    console.warn('No valid skill workbook could be loaded; using built-in defaults.');
    updateLoadingProgress(20);
    return defaultSkills;
}

const skills = await loadSkills();

let catalogWorkbookLoadsComplete = 0;
const catalogWorkbookLoadTotal = 5;

function workbookTable(sheet, headerIndex) {
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: false });
    const headers = rows[headerIndex] || [];
    return rows.slice(headerIndex + 1)
        .filter((row) => row.some((value) => value !== '' && value !== null && value !== undefined))
        .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])));
}

async function readWorkbookTable(filename, sheetName, headerIndex) {
    const response = await fetch(`/data/import/${filename}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`${filename} returned ${response.status}`);
    const workbook = XLSX.read(await response.arrayBuffer(), { type: 'array' });
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) throw new Error(`${filename} is missing the ${sheetName} sheet`);
    const rows = workbookTable(sheet, headerIndex);
    catalogWorkbookLoadsComplete += 1;
    updateLoadingProgress(20 + catalogWorkbookLoadsComplete / catalogWorkbookLoadTotal * 74);
    return rows;
}

const integerEffectUnits = new Set(['추가 턴 수', '턴 수', '초기화 스킬 수', '해제 개수', '연장 턴 수', '단축 턴 수', '전이 개수']);
const targetNames = {
    ko: { 적: '적 1명', 적전체: '모든 적', 자신: '자신', 아군: '아군 1명', '아군과 자신': '선택한 아군과 자신', 아군전체: '생존 아군 전체' },
    en: { 적: 'one enemy', 적전체: 'all enemies', 자신: 'self', 아군: 'one ally', '아군과 자신': 'one ally and self', 아군전체: 'all living allies' },
};
const effectTargetNames = {
    ko: { 자신: '시전자', '사망 아군': '사망한 아군', 아군: '선택한 아군', '이번 주공격': '이번 공격의 대상' },
    en: { 자신: 'caster', '사망 아군': 'fallen ally', 아군: 'selected ally', '이번 주공격': 'target of this attack' },
};
const buffEffectCodes = new Set([
    'ATTACK_UP', 'ATTACK_UP_GREATER', 'DEFENSE_UP', 'SPEED_UP', 'CRITICAL_CHANCE_UP', 'CRITICAL_DAMAGE_UP',
    'EFFECTIVENESS_UP', 'EFFECT_RESISTANCE_UP', 'EVASION_UP', 'CRITICAL_RESISTANCE_UP', 'HIT_CHANCE_UP',
    'CONTINUOUS_HEAL', 'LIFESTEAL', 'BARRIER', 'INVINCIBILITY', 'IMMORTALITY', 'IMMUNITY', 'STEALTH',
    'DAMAGE_REDUCTION', 'DAMAGE_SHARING', 'DAMAGE_REFLECTION', 'AUTO_REVIVE', 'COUNTERATTACK',
    'EXTRA_TURN', 'DEFENSE_PENETRATION', 'BUFF_DURATION_UP', 'SKILL_COOLDOWN_DOWN', 'SKILL_COOLDOWN_RESET',
]);

function resolvedEffectTarget(skill, effect) {
    const effectTarget = effect.effectTarget || '대상';
    const skillTarget = skill.target;
    const enemyTargeted = ['적', '적전체', 'enemy', 'enemyAll'].includes(skillTarget);
    if (buffEffectCodes.has(effect.code) && enemyTargeted && ['대상', '아군'].includes(effectTarget)) return '자신';
    if (effectTarget === '아군' && !['아군', '아군전체', '아군과 자신', 'ally', 'allyAll', 'selfAndAllies'].includes(skillTarget)) return '자신';
    return effectTarget;
}

function describeEffectTarget(skill, effect, language = 'ko') {
    const effectTarget = resolvedEffectTarget(skill, effect);
    const skillTarget = targetNames[language][skill.target] || skill.target;
    if (effectTarget === '대상') return language === 'ko' ? `스킬 대상 (${skillTarget})` : `skill target (${skillTarget})`;
    if (effectTarget === '원래 공격 대상') return language === 'ko' ? `원래 공격 대상 (${skillTarget})` : `original attack target (${skillTarget})`;
    if (effectTarget === '자신→대상') return language === 'ko' ? `시전자 → ${skillTarget}` : `caster → ${skillTarget}`;
    return effectTargetNames[language][effectTarget] || effectTarget;
}

function effectMagnitude(effect, language) {
    const { unit, value } = effect;
    if (['활성 플래그', '주회복 실행 플래그'].includes(unit)) return '';
    if (integerEffectUnits.has(unit)) {
        if (language === 'en') return unit.includes('턴') ? `${value} turn${value === 1 ? '' : 's'}` : `${value} ${unit.includes('개') || unit.includes('스킬 수') || unit.includes('전이') ? 'effect(s)' : 'time(s)'}`;
        return unit.includes('턴') ? `${value}턴` : `${value}개`;
    }
    if (unit.includes('계수')) return `${Number(value).toFixed(2)}x`;
    if (unit.includes('비율')) return `${Math.round(value * 100)}%`;
    return String(value);
}

function skillTooltips(skill) {
    const damageLabels = {
        ko: ['공격력', '방어력', '속도', '생명력'],
        en: ['Attack', 'Defense', 'Speed', 'Max Health'],
    };
    const healingLabels = {
        ko: ['공격력 비례 회복', '최대 생명력 비례 회복'],
        en: ['Attack-scaled healing', 'Max Health-scaled healing'],
    };
    const damage = skill.damageCoefficients.map((value, index) => value > 0 ? `${damageLabels.ko[index]} ${value.toFixed(2)}배` : null).filter(Boolean);
    const damageEn = skill.damageCoefficients.map((value, index) => value > 0 ? `${damageLabels.en[index]} ${value.toFixed(2)}x damage` : null).filter(Boolean);
    const healing = skill.healingCoefficients.map((value, index) => value > 0 ? `${healingLabels.ko[index]} ${value.toFixed(2)}배` : null).filter(Boolean);
    const healingEn = skill.healingCoefficients.map((value, index) => value > 0 ? `${healingLabels.en[index]} ${value.toFixed(2)}x` : null).filter(Boolean);
    const effects = skill.effects.map((effect) => {
        const magnitude = effectMagnitude(effect, 'ko');
        const chance = `${Math.round(effect.chance * 100)}% 확률`;
        const duration = effect.duration > 0 ? `${effect.duration}턴` : '즉시';
        return `${effect.name}${magnitude ? ` ${magnitude}` : ''} (효과 대상: ${describeEffectTarget(skill, effect)}, ${chance}, ${duration})`;
    });
    const effectsEn = skill.effects.map((effect) => {
        const magnitude = effectMagnitude(effect, 'en');
        const chance = `${Math.round(effect.chance * 100)}% chance`;
        const duration = effect.duration > 0 ? `for ${effect.duration} turn${effect.duration === 1 ? '' : 's'}` : 'immediate';
        return `${effect.englishName || effect.code}${magnitude ? ` ${magnitude}` : ''} (effect target: ${describeEffectTarget(skill, effect, 'en')}, ${chance}, ${duration})`;
    });
    const targetKo = targetNames.ko[skill.target] || skill.target;
    const targetEn = targetNames.en[skill.target] || skill.target;
    const parts = [...(damage.length ? [`피해계수: ${damage.join(' + ')}`] : []), ...(healing.length ? [`회복계수: ${healing.join(' + ')}`] : []), ...(effects.length ? [`효과: ${effects.join('; ')}`] : [])];
    const partsEn = [...(damageEn.length ? [`Damage coefficients: ${damageEn.join(' + ')}`] : []), ...(healingEn.length ? [`Healing: ${healingEn.join(' + ')}`] : []), ...(effectsEn.length ? [`Effects: ${effectsEn.join('; ')}`] : [])];
    return {
        tooltipKo: `스킬 대상: ${targetKo}. ${parts.join('. ')}${parts.length ? '. ' : ''}쿨타임 ${skill.cooldown}턴.`,
        tooltipEn: `Skill target: ${targetEn}. ${partsEn.join('. ')}${partsEn.length ? '. ' : ''}Cooldown: ${skill.cooldown} turn${skill.cooldown === 1 ? '' : 's'}.`,
    };
}

async function loadCatalogData() {
    try {
        const [skillRows, ruleRows, effectRows, statRows, growthRows] = await Promise.all([
            readWorkbookTable('Skill_List_2000.xlsx', '스킬 2000종', 4),
            readWorkbookTable('Skill_List_2000.xlsx', '효과 규칙 55종', 2),
            readWorkbookTable('Skill_Effects_55.xlsx', '스킬효과 목록', 3),
            readWorkbookTable('Zodiac_Stats_Merged.xlsx', '기준스탯 72종', 5),
            readWorkbookTable('Zodiac_Stats_Merged.xlsx', '성장분해', 5),
        ]);
        const effectDetails = new Map(effectRows.map((row) => [row['영문 코드 (effect_code)'], row]));
        const effectRules = new Map(ruleRows.map((row) => [row['효과코드'], row]));
        const rawSkills = skillRows.filter((row) => /^SKILL_\d+$/.test(row['스킬ID']) && row['이름']).map((row) => ({
            id: row['스킬ID'],
            name: row['이름'],
            target: row['대상'],
            category: row['유형'],
            isBasicAttack: String(row['기본공격여부']).toUpperCase() === 'TRUE',
            balanceTargetScore: Number(row['목표사용률']) || (String(row['기본공격여부']).toUpperCase() === 'TRUE' ? 0.4 : 0.9),
            cooldown: Number(row['쿨타임']) || 0,
            damageCoefficients: ['공격력피해계수', '방어력피해계수', '속도피해계수', '생명력피해계수'].map((key) => Number(row[key]) || 0),
            healingCoefficients: ['공격력비례회복량계수', '최대생명력비례회복량계수'].map((key) => Number(row[key]) || 0),
            effects: [1, 2, 3, 4].map((slot) => {
                const code = row[`스킬효과${slot}`];
                if (!code) return null;
                const detail = effectDetails.get(code) || {};
                const rule = effectRules.get(code) || {};
                const skillDuration = row[`스킬효과${slot}지속턴`];
                return {
                    code,
                    name: detail['효과명 (name_ko)'] || rule['효과명'] || code,
                    englishName: detail['영문 이름 (name_en)'] || rule['영문명'] || code,
                    value: Number(row[`스킬효과${slot}값`]) || 0,
                    chance: Number(row[`스킬효과${slot}확률`]) || 0,
                    duration: skillDuration === '' || skillDuration === undefined ? Number(rule['지속 턴']) || 0 : Number(skillDuration),
                    baseValue: Number(rule['기본값']) || 1,
                    baseDuration: Number(rule['지속 턴']) || 0,
                    baseCost: Number(rule['기준 비용']) || 0,
                    unit: rule['값 단위'] || '',
                    effectTarget: rule['실제 적용 대상'] || '',
                };
            }).filter(Boolean),
        }));
        const skills = rawSkills.map((skill) => {
            const balanced = rebalanceSkill(skill, skill.balanceTargetScore);
            const damageLabels = ['공격력', '방어력', '속도', '생명력'];
            const healingLabels = ['공격력 비례', '최대 생명력 비례'];
            return {
                ...balanced,
                damage: balanced.damageCoefficients.map((value, index) => value > 0 ? `${damageLabels[index]} ${value.toFixed(2)}x` : null).filter(Boolean),
                healing: balanced.healingCoefficients.map((value, index) => value > 0 ? `${healingLabels[index]} ${value.toFixed(2)}x` : null).filter(Boolean),
                ...skillTooltips(balanced),
            };
        });
        const effects = effectRows.filter((row) => row['영문 코드 (effect_code)']).map((row) => {
            const rule = effectRules.get(row['영문 코드 (effect_code)']) || {};
            return {
                code: row['영문 코드 (effect_code)'], name: row['효과명 (name_ko)'],
                englishName: row['영문 이름 (name_en)'], description: row['기능 설명 (description_ko)'],
                unit: rule['값 단위'],
            };
        });
        const stats = statRows.filter((row) => Number.isInteger(Number(row['기준ID'])) && row['별자리'] && row['직업']).map((row) => ({
            id: Number(row['기준ID']), zodiac: row['별자리'], job: row['직업'],
            attack: Number(row['공격력']), hp: Number(row['생명력']), defense: Number(row['방어력']), speed: Number(row['속도']),
            critChance: Number(row['치명확률']), critDamage: Number(row['치명피해']),
            effectHit: Number(row['효과적중']), effectResist: Number(row['효과저항']), notes: row['방향성 / 강점과 약점'],
        }));
        const { characters, monsters } = generateRosters(growthRows, state.catalogLevel, skills);
        const expectedSkillCategories = { 공격: 250, 회복: 250, 버프: 250, 디버프: 250, '공격|버프': 334, '공격|디버프': 333, '회복|버프': 333 };
        const categoryCounts = Object.fromEntries(Object.keys(expectedSkillCategories).map((category) => [category, skills.filter((skill) => skill.category === category).length]));
        const basicAttackCount = skills.filter((skill) => skill.isBasicAttack).length;
        if (skills.length !== 2000 || basicAttackCount !== 100 || Object.entries(expectedSkillCategories).some(([category, count]) => categoryCounts[category] !== count) || effects.length !== 55 || stats.length !== 72 || characters.length !== 200 || monsters.length !== 30) {
            throw new Error(`Unexpected workbook totals: ${skills.length} skills, ${effects.length} effects, ${stats.length} stat profiles, ${characters.length} characters, ${monsters.length} monsters`);
        }
        return { skills, effects, stats, characters, monsters, growthRows };
    } catch (error) {
        console.warn('The content catalog workbooks could not be loaded.', error);
        return { skills: [], effects: [], stats: [], characters: [], monsters: [], growthRows: [] };
    }
}

const catalogData = await loadCatalogData();
updateLoadingProgress(96);
await finishInitialLoading();

const hirePrices = { 3: 30, 4: 55, 5: 85 };
const giftPrice = 10;
const maxPartySize = 4;

function readSavedGame(slotId = 'autosave') {
    try {
        const storageKey = saveSlotStorageKeys[slotId];
        if (!storageKey) return null;
        const storedData = localStorage.getItem(storageKey)
            || (slotId === 'autosave' ? localStorage.getItem(legacySaveStorageKey) : null);
        const saved = JSON.parse(storedData || 'null');
        if (saved?.version !== 1 || !saved.state || !Array.isArray(saved.state.recruits)) return null;
        return saved;
    } catch {
        return null;
    }
}

function saveGame(slotId = 'autosave') {
    if (state.view === 'lobby') return;
    try {
        const storageKey = saveSlotStorageKeys[slotId];
        if (!storageKey) return false;
        localStorage.setItem(storageKey, JSON.stringify({ version: 1, state, party, savedAt: Date.now() }));
        return true;
    } catch (error) {
        console.warn('The game could not be saved.', error);
        return false;
    }
}

function hasSavedGame() {
    return saveSlots.some((slot) => readSavedGame(slot.id));
}

function savedGameSummary(saved) {
    const savedState = saved.state;
    const location = savedState.view === 'expedition' ? '던전' : '광장';
    const savedAt = Number(saved.savedAt);
    const time = savedAt ? new Date(savedAt).toLocaleString('ko-KR') : '저장 기록';
    return `${Number(savedState.week) || 1}주차 · ${location} · ${Number(savedState.gold) || 0}G · 용병 ${savedState.recruits.length}명 · ${time}`;
}

function saveSlotMarkup(slot, action) {
    const saved = readSavedGame(slot.id);
    const disabled = action === 'load-save' && !saved;
    const status = saved ? savedGameSummary(saved) : '비어 있음';
    return `<button class="save-slot ${saved ? 'has-save' : 'empty-save'}" type="button" data-action="${action}" data-slot="${slot.id}" ${disabled ? 'disabled' : ''}><span class="save-slot-copy"><strong>${slot.label}</strong><small>${escapeHtml(status)}</small></span><span class="save-slot-state">${saved ? action === 'load-save' ? '불러오기' : '덮어쓰기' : '빈 슬롯'}</span></button>`;
}

function gameMenuMarkup() {
    if (!gameMenuOpen) return '';
    const content = gameMenuMode === 'save-slots'
        ? `<p class="game-menu-description">저장할 슬롯을 선택하세요.</p><div class="save-slot-list">${saveSlots.filter((slot) => slot.id !== 'autosave').map((slot) => saveSlotMarkup(slot, 'save-slot')).join('')}</div><button class="game-menu-back" type="button" data-action="game-menu-back">메뉴로 돌아가기</button>`
        : `<button class="game-menu-catalog" type="button" data-action="catalog">도감</button><button class="game-menu-save" type="button" data-action="game-menu-save">저장하기 <span>슬롯 선택</span></button><label class="volume-control"><span>BGM 음량 <output data-volume-label="bgm">${Math.round(backgroundMusic.volume * 100)}%</output></span><input type="range" min="0" max="1" step="0.01" value="${backgroundMusic.volume}" data-volume-control="bgm" aria-label="BGM 음량"></label><label class="volume-control"><span>효과음 음량 <output data-volume-label="sfx">${Math.round(soundEffectsVolume * 100)}%</output></span><input type="range" min="0" max="1" step="0.01" value="${soundEffectsVolume}" data-volume-control="sfx" aria-label="효과음 음량"></label>`;
    return `<div class="game-menu-backdrop"><section class="game-menu-popup" role="dialog" aria-modal="true" aria-labelledby="game-menu-title"><header class="game-menu-heading"><h2 id="game-menu-title">메뉴</h2><button type="button" data-action="game-menu-close" aria-label="메뉴 닫기">×</button></header>${content}${gameMenuNotice ? `<p class="game-menu-notice" role="status">${escapeHtml(gameMenuNotice)}</p>` : ''}</section></div>`;
}

function expeditionResultMarkup(result) {
    const affinityRows = result.memberAffinities.map((member) => `<article class="expedition-affinity-row"><div class="expedition-affinity-heading"><span>${escapeHtml(member.name)} <small>${escapeHtml(member.job)}</small></span><strong class="${member.change > 0 ? 'affinity-up' : member.change < 0 ? 'affinity-down' : ''}">${member.change > 0 ? '+' : ''}${member.change}</strong></div><div class="expedition-affinity-track"><span class="expedition-animated-bar" data-bar-start="${member.before}" data-bar-end="${member.after}" style="width:${member.before}%"></span></div><small class="expedition-affinity-value"><span class="expedition-animated-count" data-count-start="${member.before}" data-count-end="${member.after}">${member.before}</span> / 100</small></article>`).join('');
    return `<div class="end-overlay expedition-result-overlay"><section class="end-dialog expedition-result-dialog" role="dialog" aria-modal="true" aria-labelledby="expedition-result-title"><span class="section-kicker">원정 결과</span><h2 id="expedition-result-title">${result.completed ? '원정 성공' : '원정 실패'}</h2><p>${escapeHtml(state.message)}</p><div class="expedition-result-rewards"><article class="expedition-reward-item"><div><span>획득 경험치</span><strong><span class="expedition-animated-count" data-count-start="0" data-count-end="${result.rewardExperience}">0</span> EXP</strong></div><div class="expedition-reward-track"><span class="expedition-animated-bar" data-bar-start="${result.experienceBefore}" data-bar-end="${result.experienceAfter}" style="width:${result.experienceBefore}%"></span></div></article><article class="expedition-reward-item expedition-gold-reward"><div><span>획득 골드</span><strong><span class="expedition-animated-count" data-count-start="0" data-count-end="${result.rewardGold}">0</span> G</strong></div></article></div><section class="expedition-affinity-list"><h3>원정대원 호감도</h3>${affinityRows}</section><button class="expedition-result-confirm" type="button" data-action="expedition-result-confirm" disabled>광장으로 복귀하기</button></section></div>`;
}

function animateExpeditionResults() {
    const dialog = game.querySelector('.expedition-result-dialog');
    if (!dialog) return;
    const counters = [...dialog.querySelectorAll('.expedition-animated-count')];
    const bars = [...dialog.querySelectorAll('.expedition-animated-bar')];
    const confirmButton = dialog.querySelector('[data-action="expedition-result-confirm"]');
    const startedAt = performance.now();
    const duration = 2000;
    const animate = (now) => {
        const progress = Math.min(1, (now - startedAt) / duration);
        const easedProgress = 1 - (1 - progress) ** 3;
        counters.forEach((counter) => {
            const start = Number(counter.dataset.countStart) || 0;
            const end = Number(counter.dataset.countEnd) || 0;
            counter.textContent = String(Math.round(start + (end - start) * easedProgress));
        });
        bars.forEach((bar) => {
            const start = Number(bar.dataset.barStart) || 0;
            const end = Number(bar.dataset.barEnd) || 0;
            bar.style.width = `${start + (end - start) * easedProgress}%`;
        });
        if (progress < 1) requestAnimationFrame(animate);
        else if (confirmButton) confirmButton.disabled = false;
    };
    requestAnimationFrame(animate);
}

function startNewGame() {
    party = [];
    Object.assign(state, JSON.parse(JSON.stringify(initialState)), {
        view: 'playerSetup',
        playerName: '',
        playerDraftName: '',
        playerSetupStep: 'name',
        playerSetupMessage: '',
        playerZodiac: '',
        affinityByCharacterId: {},
    });
    render();
}

function continueGame(slotId = 'autosave') {
    const saved = readSavedGame(slotId);
    if (!saved) return;
    party = Array.isArray(saved.party) ? saved.party : [];
    Object.assign(state, saved.state, {
        view: 'plaza',
        catalogReturnView: 'plaza',
        affinityByCharacterId: saved.state.affinityByCharacterId || {},
        plazaDialog: '',
        mode: 'explore',
        room: 0,
        turn: 0,
        enemies: [],
        turnOrder: [],
        turnOrderIndex: 0,
        enemyPhase: false,
        actingEnemy: -1,
        enemyAttackLanded: false,
        selectedSkill: null,
        skillNotice: null,
        ended: false,
        expeditionResult: null,
        expeditionRewardBaseline: null,
    });
    render();
}

function renderLobby() {
    const savedGame = hasSavedGame();
    let dialog = '';
    if (state.lobbyDialog === 'load') {
        dialog = `<div class="lobby-overlay"><section class="lobby-dialog lobby-load-dialog" role="dialog" aria-modal="true" aria-labelledby="lobby-dialog-title"><span class="lobby-dialog-kicker">GUILD ARCHIVE</span><h2 id="lobby-dialog-title">이어하기</h2><p>불러올 저장 데이터를 선택하세요.</p><div class="save-slot-list">${saveSlots.map((slot) => saveSlotMarkup(slot, 'load-save')).join('')}</div><button class="lobby-dialog-close" type="button" data-action="lobby-close-load">돌아가기</button></section></div>`;
    } else if (state.lobbyDialog === 'settings') {
        dialog = `<div class="lobby-overlay"><section class="lobby-dialog" role="dialog" aria-modal="true" aria-labelledby="lobby-dialog-title"><span class="lobby-dialog-kicker">GUILD ARCHIVE</span><h2 id="lobby-dialog-title">설정</h2><p>${savedGame ? '저장 데이터가 이 브라우저에 보관되어 있습니다.' : '저장 데이터가 없습니다.'}</p>${savedGame ? '<button class="lobby-dialog-delete" data-action="lobby-delete-save">저장 데이터 삭제</button>' : ''}<button class="lobby-dialog-close" data-action="lobby-close-settings">돌아가기</button></section></div>`;
    } else if (state.lobbyDialog === 'delete-save') {
        dialog = '<div class="lobby-overlay"><section class="lobby-dialog" role="dialog" aria-modal="true" aria-labelledby="lobby-dialog-title"><span class="lobby-dialog-kicker">GUILD ARCHIVE</span><h2 id="lobby-dialog-title">저장 데이터를 삭제할까요?</h2><p>삭제한 진행 상황은 복구할 수 없습니다.</p><button class="lobby-dialog-delete" data-action="lobby-confirm-delete">삭제</button><button class="lobby-dialog-close" data-action="lobby-open-settings">취소</button></section></div>';
    }
    game.innerHTML = `<section class="title-screen"><div class="lobby-architecture" aria-hidden="true"><span class="lobby-arch-outer"></span><span class="lobby-arch-inner"></span><span class="lobby-light"></span><span class="lobby-stone-floor"></span></div><div class="lobby-brand"><span class="lobby-seal" aria-hidden="true">✠</span><p class="lobby-kicker">GUILD RECORD · CHAPTER 01</p><h1>HELLO<br><span>GUILD MASTER</span></h1><p class="lobby-tagline">던전 너머의 사랑, 명예, 부 그리고 이야기</p></div><nav class="lobby-menu" aria-label="메인 메뉴"><button class="lobby-menu-item lobby-menu-primary" type="button" data-action="lobby-new-game"><span class="lobby-menu-number">01</span><span class="lobby-menu-label">새 게임<small>NEW CHRONICLE</small></span><span class="lobby-menu-arrow" aria-hidden="true">↗</span></button>${savedGame ? '<button class="lobby-menu-item" type="button" data-action="lobby-continue"><span class="lobby-menu-number">02</span><span class="lobby-menu-label">이어하기<small>CONTINUE RECORD</small></span><span class="lobby-menu-arrow" aria-hidden="true">→</span></button>' : ''}<button class="lobby-menu-item" type="button" data-action="lobby-open-settings"><span class="lobby-menu-number">${savedGame ? '03' : '02'}</span><span class="lobby-menu-label">설정<small>DATA MANAGEMENT</small></span><span class="lobby-menu-arrow" aria-hidden="true">⚙</span></button><button class="lobby-menu-item lobby-menu-exit" type="button" data-action="lobby-exit"><span class="lobby-menu-number">${savedGame ? '04' : '03'}</span><span class="lobby-menu-label">종료<small>QUIT GAME</small></span><span class="lobby-menu-arrow" aria-hidden="true">×</span></button>${state.lobbyMessage ? `<p class="lobby-feedback" role="status">${escapeHtml(state.lobbyMessage)}</p>` : ''}<p class="lobby-menu-footnote">ALPHA GUILD · EST. 01</p></nav></section>${dialog}`;
}

function renderPlayerSetup() {
    const nameStep = state.playerSetupStep === 'name';
    const zodiacCards = zodiacNames.map((zodiac) => `<button class="zodiac-card ${state.playerZodiac === zodiac ? 'selected' : ''}" type="button" data-action="setup-select-zodiac" data-zodiac="${zodiac}" aria-pressed="${state.playerZodiac === zodiac}"><span class="zodiac-card-glyph" aria-hidden="true">${zodiacGlyphs[zodiac]}</span><span class="zodiac-card-name">${zodiac}</span></button>`).join('');
    game.innerHTML = `<main class="player-setup-screen"><div class="player-setup-panel"><span class="player-setup-emblem" aria-hidden="true">✠</span><p class="player-setup-step">PLAYER RECORD · ${nameStep ? '01 / 02' : '02 / 02'}</p><h1>${nameStep ? '길드 마스터를 꿈꾸는 모험가여, 당신의 이름은?' : '당신의 별자리는?'}</h1>${nameStep ? `<label class="player-name-field"><span>모험가 이름</span><input type="text" data-player-name maxlength="16" autocomplete="nickname" value="${escapeHtml(state.playerDraftName)}" placeholder="이름 입력" aria-label="모험가 이름"></label>${state.playerSetupMessage ? `<p class="player-setup-message" role="alert">${escapeHtml(state.playerSetupMessage)}</p>` : ''}<button class="player-setup-confirm" type="button" data-action="setup-name-confirm">결정</button>` : `<p class="player-setup-description">선택한 별자리에 따라 원정대원과의 초기 호감도가 정해집니다.</p><div class="zodiac-card-grid">${zodiacCards}</div>${state.playerSetupMessage ? `<p class="player-setup-message" role="alert">${escapeHtml(state.playerSetupMessage)}</p>` : ''}<button class="player-setup-confirm" type="button" data-action="setup-zodiac-confirm" ${state.playerZodiac ? '' : 'disabled'}>결정</button>`}</div></main>`;
    if (nameStep) requestAnimationFrame(() => game.querySelector('[data-player-name]')?.focus());
}

function drawPlazaOffers() {
    try {
        const candidates = generateRosters(catalogData.growthRows, state.userLevel, catalogData.skills).characters;
        const jobs = [...new Set(candidates.map((candidate) => candidate.job))];
        const offers = jobs.map((job) => {
            const jobCandidates = candidates.filter((candidate) => candidate.job === job);
            const candidate = jobCandidates[Math.floor(Math.random() * jobCandidates.length)];
            return { ...candidate, price: hirePrices[candidate.grade] ?? 30 };
        });
        for (let index = offers.length - 1; index > 0; index -= 1) {
            const swapIndex = Math.floor(Math.random() * (index + 1));
            [offers[index], offers[swapIndex]] = [offers[swapIndex], offers[index]];
        }
        return offers;
    } catch (error) {
        console.warn('Plaza offers could not be generated.', error);
        return [];
    }
}

state.plazaOffers = drawPlazaOffers();

function confirmPlayerName() {
    const playerName = String(game.querySelector('[data-player-name]')?.value ?? state.playerDraftName).trim();
    if (!playerName) {
        state.playerSetupMessage = '이름을 입력해 주세요.';
        render();
        return;
    }
    state.playerName = playerName;
    state.playerDraftName = playerName;
    state.playerSetupMessage = '';
    state.playerSetupStep = 'zodiac';
    render();
}

const plazaDialogues = {
    [plazaFirstVisitDialogue.id]: plazaFirstVisitDialogue,
    [plazaFirstEncounterDialogue.id]: plazaFirstEncounterDialogue,
    [plazaFirstConversationDialogue.id]: plazaFirstConversationDialogue,
};
let plazaTransitionPhase = '';
let plazaDialogueExitPending = false;

function getActivePlazaDialogue() {
    const progress = state.activePlazaDialogue;
    const dialogue = plazaDialogues[progress?.id];
    const node = dialogue?.nodes?.[progress?.nodeId];
    return dialogue && node ? { dialogue, node, bubbleSide: progress.bubbleSide } : null;
}

function startPlazaDialogue(dialogueId) {
    const dialogue = plazaDialogues[dialogueId];
    if (!dialogue?.nodes?.[dialogue.start]) return false;
    state.activePlazaDialogue = { id: dialogueId, nodeId: dialogue.start, bubbleSide: Math.random() < 0.5 ? 'left' : 'right' };
    plazaTransitionPhase = 'enter';
    return true;
}

function finishPlazaDialogue(nextDialogueId) {
    if (plazaDialogueExitPending) return;
    plazaDialogueExitPending = true;
    plazaTransitionPhase = 'exit';
    render();

    const exitPage = game.querySelector('.plaza-transition-exit.plaza-page');
    const finishExit = () => {
        if (!plazaDialogueExitPending) return;
        plazaDialogueExitPending = false;
        if (!nextDialogueId || !startPlazaDialogue(nextDialogueId)) {
            state.activePlazaDialogue = null;
            plazaTransitionPhase = 'enter';
        }
        render();
    };
    if (!exitPage || getComputedStyle(exitPage).animationName === 'none') {
        finishExit();
        return;
    }
    const handleAnimationEnd = (event) => {
        if (event.target !== exitPage) return;
        exitPage.removeEventListener('animationend', handleAnimationEnd);
        finishExit();
    };
    exitPage.addEventListener('animationend', handleAnimationEnd);
    window.setTimeout(finishExit, 600);
}

function advancePlazaDialogue(nextNodeId) {
    if (plazaDialogueExitPending) return;
    const activeDialogue = getActivePlazaDialogue();
    if (!activeDialogue) {
        state.activePlazaDialogue = null;
        render();
        return;
    }
    const destination = nextNodeId || activeDialogue.node.next;
    if (activeDialogue.node.end || !destination) {
        finishPlazaDialogue(activeDialogue.dialogue.nextDialogue);
        return;
    } else if (activeDialogue.dialogue.nodes[destination]) {
        state.activePlazaDialogue.nodeId = destination;
        state.activePlazaDialogue.bubbleSide = Math.random() < 0.5 ? 'left' : 'right';
    } else {
        console.warn(`Dialogue node not found: ${activeDialogue.dialogue.id}.${destination}`);
        state.activePlazaDialogue = null;
    }
    render();
}

function confirmPlayerZodiac() {
    if (!zodiacGlyphs[state.playerZodiac]) {
        state.playerSetupMessage = '별자리를 선택해 주세요.';
        render();
        return;
    }
    const rosterProfiles = [...catalogData.characters, ...catalogData.monsters];
    state.affinityByCharacterId = Object.fromEntries(rosterProfiles.map((profile) => [
        profile.id,
        initialAffinityFor(state.playerZodiac, profile.zodiac),
    ]));
    state.view = 'plaza';
    state.plazaOffers = drawPlazaOffers();
    state.plazaCurrentOffer = null;
    state.plazaMessage = '';
    startPlazaDialogue('plaza.first-visit');
    render();
}

const catalogPageSize = 20;
let codexCarouselDrag = null;
let suppressCodexCarouselClick = false;
let renderedPortraitSelection = '';

function escapeHtml(value) {
    return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

const rosterStatColumns = [
    ['attack', '공격'], ['maxHp', '생명'], ['defense', '방어'], ['speed', '속도'],
    ['critChance', '치명 확률'], ['critDamage', '치명 피해'], ['effectHit', '효과 적중'], ['effectResist', '효과 저항'],
];

const elementTints = { 불: '#d76b50', 물: '#568fb2', 풀: '#759763', 빛: '#e2c578', 어둠: '#786c8d' };
const elementBorderClasses = { 불: 'fire', 물: 'water', 풀: 'nature', 빛: 'light', 어둠: 'dark' };
const jobGlyphs = { 기사: '⚔', 마도사: '✧', 사수: '➶', 정령사: '✚', 도적: '⚝', 전사: '⚒' };
const elementGlyphs = { 불: '♨', 물: '◒', 풀: '❧', 빛: '✦', 어둠: '☾' };
const characterPortraitAssets = {
    'CHAR-001': '/assets/art/2D/Character/0001_F_W.png',
    'CHAR-002': '/assets/art/2D/Character/0002_F_W.png',
};
const plazaJobOrder = ['기사', '전사', '마도사', '사수', '정령사', '도적'];

function playerZodiacIconMarkup() {
    const glyph = zodiacGlyphs[state.playerZodiac];
    return glyph ? `<span class="player-zodiac-mark" title="${escapeHtml(state.playerZodiac)}" aria-label="${escapeHtml(state.playerZodiac)}">${glyph}</span>` : '';
}

function plazaJobCountsMarkup() {
    const counts = new Map(plazaJobOrder.map((job) => [job, 0]));
    state.plazaOffers.forEach((offer) => {
        if (counts.has(offer.job)) counts.set(offer.job, counts.get(offer.job) + 1);
    });
    return plazaJobOrder.map((job, index) => `<span class="plaza-job-count"><i aria-hidden="true">${jobGlyphs[job]}</i>${escapeHtml(job)} ${counts.get(job)}명</span>${index < plazaJobOrder.length - 1 ? '<span class="plaza-job-comma">, </span>' : ''}`).join('');
}

function catalogIconMarkup(symbol, tint, label, className = 'catalog-icon', title = '', inlineStyle = '') {
    if (className === 'plaza-action-icon') return plazaActionIconMarkup(symbol, tint);
    const background = className === 'codex-character-thumb' ? '' : `<rect x="1" y="1" width="38" height="38" rx="8" fill="#211e19" stroke="${tint}" stroke-opacity=".7"/>`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">${background}<text x="20" y="27" text-anchor="middle" font-family="serif" font-size="23" fill="${tint}">${symbol}</text></svg>`;
    return `<img class="${className}" src="data:image/svg+xml,${encodeURIComponent(svg)}" alt="${escapeHtml(label)}"${title ? ` title="${escapeHtml(title)}"` : ''}${inlineStyle ? ` style="${escapeHtml(inlineStyle)}"` : ''}>`;
}

function plazaActionIconMarkup(symbol, tint) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><text x="20" y="29" text-anchor="middle" font-family="serif" font-size="29" fill="${tint}">${symbol}</text></svg>`;
    return `<img class="plaza-action-icon" src="data:image/svg+xml,${encodeURIComponent(svg)}" alt="" aria-hidden="true">`;
}

function skillGlyph(skill) {
    if (skill.category?.includes('디버프')) return ['⊖', '#bd7861'];
    if (skill.category?.includes('회복')) return ['✚', '#739879'];
    if (skill.category?.includes('공격')) return ['⚔', '#c27657'];
    if (skill.category?.includes('버프')) return ['✧', '#c2a767'];
    return ['◈', '#ad9a78'];
}

function effectGlyph(effect) {
    if (/_DOWN|_BLOCK|POISON|BLEED|CURSE|STUN|SLEEP|PROVOKE|TARGET|INJURY|EXTINCTION|^DEBUFF_/.test(effect.code)) return ['⊖', '#bd7861'];
    if (/HEAL|REVIVE|LIFESTEAL/.test(effect.code)) return ['✚', '#739879'];
    if (/_UP|BUFF|BARRIER|IMMUNITY|INVINCIBILITY/.test(effect.code)) return ['↑', '#c2a767'];
    if (/STUN|SLEEP|EXTINCTION/.test(effect.code)) return ['☠', '#9a7b9f'];
    return ['✧', '#ad9a78'];
}

function skillCatalogRowMarkup(skill) {
    const [glyph, tint] = skillGlyph(skill);
    return `<tr><td>${catalogIconMarkup(glyph, tint, skill.name, 'catalog-icon', `${skill.name}\n${skill.tooltipKo}`)}</td><td><strong>${escapeHtml(skill.name)}</strong><small>${escapeHtml(skill.category)}${skill.isBasicAttack ? ' · 기본 공격' : ''}</small></td><td>${escapeHtml(skill.target)}</td><td><div class="catalog-values">${skill.damage.map((value) => `<span>${escapeHtml(value)}</span>`).join('')}${skill.healing.map((value) => `<span>${escapeHtml(value)}</span>`).join('')}${skill.effects.map((effect) => `<span>${escapeHtml(effect.name)} ${escapeHtml(Number(effect.value.toFixed(3)))} · ${Math.round(effect.chance * 100)}% · ${escapeHtml(effect.duration)}턴</span>`).join('')}</div><small class="skill-balanced-tooltip" title="${escapeHtml(skill.tooltipEn)}">${escapeHtml(skill.tooltipKo)}</small></td><td>${skill.cooldown}턴</td><td class="catalog-score"><strong>${(skill.scoreAfter * 100).toFixed(1)}%</strong>${skill.balanceReached ? '' : '<small>조정 한계</small>'}</td></tr>`;
}

function effectCatalogRowMarkup(effect) {
    const [glyph, tint] = effectGlyph(effect);
    return `<tr><td>${catalogIconMarkup(glyph, tint, effect.name, 'catalog-icon', effect.description)}</td><td><strong>${escapeHtml(effect.name)}</strong><small>${escapeHtml(effect.englishName)}</small></td><td>${escapeHtml(effect.unit)}</td><td><small>${escapeHtml(effect.description)}</small></td></tr>`;
}

function statCatalogRowMarkup(profile) {
    return `<tr><td>${catalogIconMarkup(zodiacGlyphs[profile.zodiac] || '✧', '#c2a767', profile.zodiac, 'catalog-icon', profile.notes)}</td><td>${escapeHtml(profile.zodiac)}</td><td>${escapeHtml(profile.job)}</td><td>${profile.attack}</td><td>${profile.hp}</td><td>${profile.defense}</td><td>${profile.speed}</td><td>${profile.critChance}</td><td>${profile.critDamage}</td><td>${profile.effectHit}</td><td>${profile.effectResist}</td></tr>`;
}

function rosterRowMarkup(entry) {
    const stats = rosterStatColumns.map(([key]) => key);
    const skills = entry.skills.map((skill) => {
        const [glyph, tint] = skillGlyph(skill);
        const title = `${skill.name}\n${skill.tooltipKo || ''}`;
        return catalogIconMarkup(glyph, tint, skill.name, 'roster-skill-icon', title);
    }).join('');
    const portraitTitle = `${entry.name} · ${entry.element} · ${entry.job} · ${entry.grade}등급`;
    const jobIcon = catalogIconMarkup(jobGlyphs[entry.job] || '✦', '#c2a767', entry.job, 'roster-job-icon', entry.job);
    return `<tr><td class="roster-avatar-cell"><span class="roster-avatar-frame element-border-${elementBorderClasses[entry.element] || 'light'}">${catalogIconMarkup(entry.mark, '#c2a767', entry.name, 'roster-avatar', portraitTitle)}</span></td><td class="roster-name-cell"><strong class="roster-name">${escapeHtml(entry.name)}</strong>${jobIcon}</td><td><span class="roster-grade grade-${entry.grade}">${entry.grade}등급</span></td><td class="roster-skills">${skills}</td>${stats.map((stat) => `<td>${entry.stats[stat]}</td>`).join('')}</tr>`;
}

function rosterStatHeadersMarkup() {
    return rosterStatColumns.map(([key, label]) => {
        const direction = state.catalogSort.key === key ? state.catalogSort.direction : 'initial';
        const indicator = direction === 'descending' ? '↓' : direction === 'ascending' ? '↑' : '↕';
        return `<th aria-sort="${direction === 'initial' ? 'none' : direction}"><button class="roster-sort ${direction !== 'initial' ? 'active' : ''}" data-catalog-sort="${key}" type="button">${label}<span aria-hidden="true">${indicator}</span></button></th>`;
    }).join('');
}

function catalogMarkup() {
    const query = state.catalogSearch.trim().toLocaleLowerCase();
    const tabs = [
        ['skills', '스킬', catalogData.skills.length],
        ['effects', '효과', catalogData.effects.length],
        ['characters', '캐릭터', catalogData.characters.length],
        ['monsters', '몬스터', catalogData.monsters.length],
        ['stats', '기준 스탯', catalogData.stats.length],
    ];
    let rows = [];
    let total = 0;
    let content;
    if (state.catalogTab === 'skills') {
        rows = catalogData.skills.filter((skill) => {
            const matchesQuery = !query || [skill.id, skill.name, skill.target, skill.category, ...skill.effects.map((effect) => `${effect.code} ${effect.name}`)].join(' ').toLocaleLowerCase().includes(query);
            const types = skill.category.split('|').map((type) => type.trim());
            const matchesType = !state.catalogType
                || (state.catalogType === '__basic_attack__' ? skill.isBasicAttack : !skill.isBasicAttack && types.includes(state.catalogType));
            const matchesTarget = !state.catalogTarget || skill.target === state.catalogTarget;
            const matchesEffect = !state.catalogEffect || skill.effects.some((effect) => effect.code === state.catalogEffect);
            return matchesQuery && matchesType && matchesTarget && matchesEffect;
        });
        total = rows.length;
        const pageCount = Math.max(1, Math.ceil(total / catalogPageSize));
        state.catalogPage = Math.min(state.catalogPage, pageCount - 1);
        const pageRows = rows.slice(state.catalogPage * catalogPageSize, (state.catalogPage + 1) * catalogPageSize);
        content = `<div class="catalog-table-wrap"><table class="catalog-table skill-table"><thead><tr><th>아이콘</th><th>스킬</th><th>대상</th><th>수치와 효과</th><th>쿨타임</th><th>균형 점수</th></tr></thead><tbody>${pageRows.map(skillCatalogRowMarkup).join('')}</tbody></table></div><div class="catalog-pagination"><span>${total ? `${state.catalogPage * catalogPageSize + 1}–${Math.min((state.catalogPage + 1) * catalogPageSize, total)} / ${total}` : '검색 결과 없음'}</span><div><button data-action="catalog-prev" ${state.catalogPage === 0 ? 'disabled' : ''} aria-label="이전 페이지">←</button><button data-action="catalog-next" ${state.catalogPage >= pageCount - 1 ? 'disabled' : ''} aria-label="다음 페이지">→</button></div></div>`;
    } else if (state.catalogTab === 'effects') {
        rows = catalogData.effects.filter((effect) => !query || [effect.code, effect.name, effect.englishName, effect.description, effect.unit].join(' ').toLocaleLowerCase().includes(query));
        total = rows.length;
        content = `<div class="catalog-table-wrap"><table class="catalog-table effect-table"><thead><tr><th>아이콘</th><th>효과</th><th>값 단위</th><th>설명</th></tr></thead><tbody>${rows.map(effectCatalogRowMarkup).join('')}</tbody></table></div>`;
    } else if (state.catalogTab === 'characters' || state.catalogTab === 'monsters') {
        const isMonster = state.catalogTab === 'monsters';
        const roster = isMonster ? catalogData.monsters : catalogData.characters;
        rows = roster.filter((entry) => {
            const matchesQuery = !query || [entry.id, entry.name, entry.element, entry.job, entry.grade, entry.level].join(' ').toLocaleLowerCase().includes(query);
            return matchesQuery
                && (!state.catalogElement || entry.element === state.catalogElement)
                && (!state.catalogJob || entry.job === state.catalogJob)
                && (!state.catalogGrade || String(entry.grade) === state.catalogGrade);
        });
            if (state.catalogSort.direction !== 'initial') {
                const sortDirection = state.catalogSort.direction === 'descending' ? -1 : 1;
                rows.sort((left, right) => (left.stats[state.catalogSort.key] - right.stats[state.catalogSort.key]) * sortDirection || left.id.localeCompare(right.id));
            }
        total = rows.length;
        const pageCount = Math.max(1, Math.ceil(total / catalogPageSize));
        state.catalogPage = Math.min(state.catalogPage, pageCount - 1);
        const pageRows = rows.slice(state.catalogPage * catalogPageSize, (state.catalogPage + 1) * catalogPageSize);
        content = `<div class="catalog-table-wrap"><table class="catalog-table roster-table"><thead><tr><th>초상</th><th>이름</th><th>등급</th><th>스킬</th>${rosterStatHeadersMarkup()}</tr></thead><tbody>${pageRows.map(rosterRowMarkup).join('')}</tbody></table></div><div class="catalog-pagination"><span>${total ? `${state.catalogPage * catalogPageSize + 1}–${Math.min((state.catalogPage + 1) * catalogPageSize, total)} / ${total}` : '검색 결과 없음'}</span><div><button data-action="catalog-prev" ${state.catalogPage === 0 ? 'disabled' : ''} aria-label="이전 페이지">←</button><button data-action="catalog-next" ${state.catalogPage >= pageCount - 1 ? 'disabled' : ''} aria-label="다음 페이지">→</button></div></div>`;
    } else {
        rows = catalogData.stats.filter((profile) => {
            const matchesQuery = !query || [profile.id, profile.zodiac, profile.job, profile.notes].join(' ').toLocaleLowerCase().includes(query);
            return matchesQuery && (!state.catalogZodiac || profile.zodiac === state.catalogZodiac) && (!state.catalogJob || profile.job === state.catalogJob);
        });
        total = rows.length;
        content = `<div class="catalog-table-wrap"><table class="catalog-table stats-table"><thead><tr><th>아이콘</th><th>별자리</th><th>직업</th><th>공격</th><th>생명</th><th>방어</th><th>속도</th><th>치명 확률</th><th>치명 피해</th><th>효과 적중</th><th>효과 저항</th></tr></thead><tbody>${rows.map(statCatalogRowMarkup).join('')}</tbody></table></div><p class="catalog-footnote">${rows[0] ? escapeHtml(rows[0].notes) : '검색 결과 없음'}</p>`;
    }
    const zodiacOptions = [...new Set(catalogData.stats.map((profile) => profile.zodiac))];
    const jobOptions = [...new Set(catalogData.stats.map((profile) => profile.job))];
    const elementOptions = ['불', '물', '풀', '빛', '어둠'];
    const gradeOptions = state.catalogTab === 'characters' ? [3, 4, 5] : [1, 2, 3, 4, 5];
    const typeOptions = [...new Set(catalogData.skills.flatMap((skill) => skill.category.split('|').map((type) => type.trim()).filter(Boolean)))];
    const hasBasicAttacks = catalogData.skills.some((skill) => skill.isBasicAttack);
    const balancedSkillCount = catalogData.skills.filter((skill) => skill.balanceReached).length;
    const balancedTargetScore = catalogData.skills[0]?.targetScore ?? 0.9;
    const filters = state.catalogTab === 'skills'
        ? `<label>유형<select data-catalog-filter="type"><option value="">전체 유형</option>${typeOptions.map((type) => `<option value="${escapeHtml(type)}" ${state.catalogType === type ? 'selected' : ''}>${escapeHtml(type)}</option>`).join('')}${hasBasicAttacks ? `<option value="__basic_attack__" ${state.catalogType === '__basic_attack__' ? 'selected' : ''}>기본 공격</option>` : ''}</select></label><label>대상<select data-catalog-filter="target"><option value="">전체 대상</option>${[['적', '적'], ['적전체', '적 전체'], ['자신', '자신'], ['아군', '아군'], ['아군과 자신', '아군과 자신'], ['아군전체', '아군 전체']].map(([value, label]) => `<option value="${value}" ${state.catalogTarget === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label><label>효과<select class="effect-filter-select" data-catalog-filter="effect"><option value="">전체 효과</option>${catalogData.effects.map((effect) => `<option value="${escapeHtml(effect.code)}" ${state.catalogEffect === effect.code ? 'selected' : ''}>${escapeHtml(effect.name)} · ${escapeHtml(effect.code)}</option>`).join('')}</select></label>`
        : state.catalogTab === 'stats'
            ? `<label>별자리<select data-catalog-filter="zodiac"><option value="">전체 별자리</option>${zodiacOptions.map((value) => `<option value="${escapeHtml(value)}" ${state.catalogZodiac === value ? 'selected' : ''}>${escapeHtml(value)}</option>`).join('')}</select></label><label>직업<select data-catalog-filter="job"><option value="">전체 직업</option>${jobOptions.map((value) => `<option value="${escapeHtml(value)}" ${state.catalogJob === value ? 'selected' : ''}>${escapeHtml(value)}</option>`).join('')}</select></label>`
            : state.catalogTab === 'characters' || state.catalogTab === 'monsters'
                ? `<label>전체 레벨<select data-catalog-filter="level">${[1, 2, 3, 4, 5].map((value) => `<option value="${value}" ${state.catalogLevel === value ? 'selected' : ''}>Lv.${value}</option>`).join('')}</select></label><label>속성<select data-catalog-filter="element"><option value="">전체 속성</option>${elementOptions.map((value) => `<option value="${value}" ${state.catalogElement === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label><label>직업<select data-catalog-filter="job"><option value="">전체 직업</option>${jobOptions.map((value) => `<option value="${escapeHtml(value)}" ${state.catalogJob === value ? 'selected' : ''}>${escapeHtml(value)}</option>`).join('')}</select></label><label>등급<select data-catalog-filter="grade"><option value="">전체 등급</option>${gradeOptions.map((value) => `<option value="${value}" ${state.catalogGrade === String(value) ? 'selected' : ''}>${value}등급</option>`).join('')}</select></label>`
            : '';
    const characterGradeCounts = [3, 4, 5].map((grade) => catalogData.characters.filter((entry) => entry.grade === grade).length).join('/');
    const monsterGradeCounts = [1, 2, 3, 4, 5].map((grade) => catalogData.monsters.filter((entry) => entry.grade === grade).length).join('/');
    const rosterSummary = state.catalogTab === 'characters'
        ? `200명 · 전체 Lv.${state.catalogLevel} 적용 · 속성별 40명 · 직업별 33–34명 · 등급 3→5 ${characterGradeCounts}`
        : state.catalogTab === 'monsters'
            ? `30마리 · 전체 Lv.${state.catalogLevel} 적용 · 속성별 6마리 · 직업별 5마리 · 등급 1→5 ${monsterGradeCounts}`
            : '';
    const summary = state.catalogTab === 'skills'
        ? `<p class="catalog-balance-summary">균형 목표 ${(balancedTargetScore * 100).toFixed(0)}% ±2%p · ${balancedSkillCount}/${catalogData.skills.length}개 도달 · 지속턴 반영</p>`
        : rosterSummary ? `<p class="catalog-balance-summary">${rosterSummary}</p>` : '';
    return `<header class="topbar catalog-topbar"><a class="wordmark" href="#" aria-label="검은 회랑 도감"><span class="wordmark-sigil">✠</span><span>검은 회랑<small>원정 자료실</small></span></a><span class="catalog-source">워크북 데이터 · ${catalogData.skills.length + catalogData.effects.length + catalogData.stats.length + catalogData.characters.length + catalogData.monsters.length}개 항목</span><button class="catalog-back" data-action="view-expedition">원정으로 돌아가기 <span>→</span></button></header><main class="catalog-main"><div class="catalog-heading"><div><span class="section-kicker">자료실</span><h1>전투 자료 도감</h1></div><p>스킬, 효과, 캐릭터, 몬스터, 별자리별 기준 스탯</p></div><nav class="catalog-tabs" aria-label="도감 분류">${tabs.map(([id, label, count]) => `<button class="catalog-tab ${state.catalogTab === id ? 'active' : ''}" data-catalog-tab="${id}" aria-pressed="${state.catalogTab === id}">${label}<span>${count}</span></button>`).join('')}</nav><section class="catalog-browser"><div class="catalog-tools"><label class="catalog-search"><span>검색</span><input type="search" data-catalog-search value="${escapeHtml(state.catalogSearch)}" placeholder="이름, 속성, 설명 검색" autocomplete="off"></label>${filters}<span class="catalog-result-count">${total}개 항목</span></div>${summary}${content}</section></main><footer class="bottom-note"><span>검은 회랑 <i>·</i> 원정 자료실</span><span>조디악 성장표 기반 콘텐츠</span></footer>`;
}

function renderCatalog() {
    game.innerHTML = catalogMarkup();
}

function characterCodexMarkup() {
    const query = state.catalogSearch.trim().toLocaleLowerCase();
    const isMonster = state.characterCodexTab === 'monsters';
    const rosterLabel = isMonster ? '몬스터' : '캐릭터';
    const entries = catalogData[isMonster ? 'monsters' : 'characters'].filter((entry) => {
        const matchesQuery = !query || [entry.id, entry.name, entry.element, entry.job, entry.grade, entry.level].join(' ').toLocaleLowerCase().includes(query);
        return matchesQuery
            && (!state.catalogElement || entry.element === state.catalogElement)
            && (!state.catalogJob || entry.job === state.catalogJob)
            && (!state.catalogGrade || String(entry.grade) === state.catalogGrade);
    });
    const selected = entries.find((entry) => entry.id === state.catalogSelectedRosterId) || entries[0];
    state.catalogSelectedRosterId = selected?.id || '';
    const jobOptions = [...new Set(catalogData.stats.map((profile) => profile.job))];
    const gradeOptions = isMonster ? [1, 2, 3, 4, 5] : [3, 4, 5];
    const filters = `<label>전체 레벨<select data-catalog-filter="level">${[1, 2, 3, 4, 5].map((value) => `<option value="${value}" ${state.catalogLevel === value ? 'selected' : ''}>Lv.${value}</option>`).join('')}</select></label><label>속성<select data-catalog-filter="element"><option value="">전체 속성</option>${['불', '물', '풀', '빛', '어둠'].map((value) => `<option value="${value}" ${state.catalogElement === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label><label>직업<select data-catalog-filter="job"><option value="">전체 직업</option>${jobOptions.map((value) => `<option value="${escapeHtml(value)}" ${state.catalogJob === value ? 'selected' : ''}>${escapeHtml(value)}</option>`).join('')}</select></label><label>등급<select data-catalog-filter="grade"><option value="">전체 등급</option>${gradeOptions.map((value) => `<option value="${value}" ${state.catalogGrade === String(value) ? 'selected' : ''}>${value}등급</option>`).join('')}</select></label>`;
    const portraits = entries.map((entry) => {
        const active = entry.id === selected?.id;
        const border = elementBorderClasses[entry.element] || 'light';
        const title = `${entry.name} · ${entry.element} · ${entry.job} · ${entry.grade}등급`;
        const thumbnail = catalogIconMarkup(entry.mark, elementTints[entry.element] || '#a6d7e8', entry.name, 'codex-character-thumb');
        return `<button class="codex-character-card ${active ? 'active' : ''}" type="button" data-codex-character="${entry.id}" aria-pressed="${active}" aria-label="${escapeHtml(title)}"><span class="codex-character-frame element-border-${border}">${thumbnail}</span><span class="codex-character-name">${escapeHtml(entry.name)}</span></button>`;
    }).join('');
    const tabs = `<nav class="codex-tabs" aria-label="도감 종류"><button class="codex-tab ${isMonster ? '' : 'active'}" type="button" data-codex-tab="characters" aria-pressed="${!isMonster}">캐릭터 도감</button><button class="codex-tab ${isMonster ? 'active' : ''}" type="button" data-codex-tab="monsters" aria-pressed="${isMonster}">몬스터 도감</button></nav>`;
    const developerLink = import.meta.env.DEV ? '<button class="codex-developer-link" type="button" data-action="developer-catalog">개발자 자료실</button>' : '';
    const panel = selected
        ? plazaEncounterMarkup(isMonster ? selected : { ...selected, price: hirePrices[selected.grade] ?? 30, portraitSrc: characterPortraitAssets[selected.id] })
        : `<div class="codex-empty-state">조건에 맞는 ${rosterLabel}가 없습니다.</div>`;
    const experiencePercent = Math.min(100, Math.max(0, state.experience / state.experienceToNextLevel * 100));
    return `<header class="topbar plaza-topbar codex-topbar"><div class="player-profile"><div class="player-profile-name"><strong>${escapeHtml(state.playerName)}</strong>${playerZodiacIconMarkup()}<span>Lv.${state.userLevel}</span></div><div class="player-experience"><div><span>경험치</span><strong>${state.experience}/${state.experienceToNextLevel}</strong></div><div class="plaza-exp-track"><span style="width:${experiencePercent}%"></span></div></div></div><span class="codex-topbar-count">${rosterLabel} ${entries.length}${isMonster ? '마리' : '명'}</span><div class="codex-topbar-actions">${developerLink}<button class="catalog-back" type="button" data-action="view-expedition">돌아가기 <span>→</span></button></div></header><main class="character-codex-page plaza-page">${tabs}<div class="character-codex-heading"><div><h1 class="${isMonster ? 'codex-monster-heading' : ''}">${rosterLabel} 도감</h1></div><span class="catalog-result-count">${entries.length}${isMonster ? '마리' : '명'}</span></div><section class="catalog-browser codex-browser"><section class="codex-feature-panel" aria-label="선택한 ${rosterLabel} 상세 정보">${panel}</section><div class="catalog-tools"><label class="catalog-search"><span>검색</span><input type="search" data-catalog-search value="${escapeHtml(state.catalogSearch)}" placeholder="이름, 속성, 직업 검색" autocomplete="off"></label>${filters}</div><section class="codex-roster" aria-label="${rosterLabel} 목록"><div class="codex-roster-heading"><h2>${rosterLabel} 목록</h2><span>${entries.length}${isMonster ? '마리' : '명'}</span></div><div class="codex-roster-viewport" tabindex="0" aria-label="${rosterLabel}를 좌우로 스크롤하여 선택">${portraits || '<p class="codex-empty-roster">표시할 항목이 없습니다.</p>'}</div></section></section></main><footer class="bottom-note codex-bottom-note"><span>검은 회랑 <i>·</i> ${rosterLabel} 도감</span><span>조디악 성장표 기반 콘텐츠</span></footer>`;
}

function renderCharacterCodex() {
    const selectionKey = `${state.characterCodexTab}:${state.catalogSelectedRosterId}`;
    const animatePortrait = selectionKey !== renderedPortraitSelection;
    renderedPortraitSelection = selectionKey;
    game.innerHTML = characterCodexMarkup();
    const portraitSrc = state.characterCodexTab === 'characters'
        ? characterPortraitAssets[state.catalogSelectedRosterId]
        : '';
    const panel = game.querySelector('.codex-feature-panel');
    if (!portraitSrc || !panel) return;
    const mask = document.createElement('div');
    mask.className = `codex-character-art-mask${animatePortrait ? ' is-entering' : ''}`;
    mask.setAttribute('aria-hidden', 'true');
    const image = document.createElement('img');
    image.src = portraitSrc;
    image.alt = '';
    image.draggable = false;
    mask.append(image);
    panel.prepend(mask);
}

function plazaEncounterMarkup(offer) {
    if (!offer) {
        const exhausted = state.plazaOffers.length === 0;
        return `<div class="plaza-empty-stage"><span class="plaza-stage-sigil">✦</span><p>${escapeHtml(state.plazaMessage || (exhausted ? '더 이상 제안할 용병이 없는 듯 하다' : '광장에는 여러 모험가가 오갑니다.'))}</p></div>`;
    }
    const skillIcons = offer.skills.map((skill) => {
        const [glyph, tint] = skillGlyph(skill);
        return `<button type="button" class="plaza-skill-tooltip-trigger" aria-label="${escapeHtml(skill.name)}">${catalogIconMarkup(glyph, tint, skill.name, 'plaza-skill-icon')}${skillTooltip(skill, offer)}</button>`;
    }).join('');
    const elementColor = elementTints[offer.element] || '#a99060';
    const portrait = offer.portraitSrc
        ? ''
        : catalogIconMarkup(offer.mark, elementColor, offer.name, 'plaza-portrait-icon', `${offer.name} · ${offer.element}`);
    const statRows = [
        ['공격', offer.stats.attack], ['생명', offer.stats.maxHp], ['방어', offer.stats.defense], ['속도', offer.stats.speed],
        ['치명 확률', offer.stats.critChance], ['치명 피해', offer.stats.critDamage], ['효과 적중', offer.stats.effectHit], ['효과 저항', offer.stats.effectResist],
    ];
    const jobIcon = plazaActionIconMarkup(jobGlyphs[offer.job] || '✦', '#a6d7e8');
    const elementIcon = plazaActionIconMarkup(elementGlyphs[offer.element] || '◇', elementColor);
    const gradeStars = '★'.repeat(Math.max(0, Number(offer.grade) || 0));
    const affinity = Math.min(100, Math.max(0, Number(state.affinityByCharacterId[offer.id] ?? offer.affinity ?? 10)));
    const zodiacGlyph = zodiacGlyphs[offer.zodiac] || '✧';
    const affinityLabel = affinity === 0 ? '앙숙' : affinity <= 10 ? '데면데면한 사이' : affinity <= 20 ? '보통 사이' : affinity <= 50 ? '호감이 있는 사이' : affinity <= 90 ? '친밀한 사이' : '소울메이트';
    const zodiacIcon = catalogIconMarkup(zodiacGlyph, '#a6d7e8', offer.zodiac || '별자리', 'plaza-affinity-icon');
    const affinityPanel = `<div class="plaza-encounter-affinity"><span class="section-kicker">친밀도</span><div class="plaza-affinity-main"><div class="plaza-affinity-copy"><strong>${affinityLabel}</strong><small>${affinity} / 100</small></div>${zodiacIcon}</div><div class="plaza-affinity-meter"><span style="width:${affinity}%"></span></div></div>`;
    const priceMarkup = offer.price === undefined ? '' : `<span class="plaza-encounter-price">영입가 <strong>◈ ${offer.price} 골드</strong></span>`;
    return `<article class="plaza-encounter"><section class="plaza-encounter-info"><div class="plaza-encounter-title"><span class="plaza-encounter-meta">${jobIcon}<span>${escapeHtml(offer.job)}</span></span><span class="plaza-encounter-meta">${elementIcon}<span>${escapeHtml(offer.element)}</span></span><span class="plaza-encounter-level">Lv.${offer.level}</span></div><h2 class="plaza-encounter-name"><span>${escapeHtml(offer.name)}</span><span class="plaza-grade-stars" role="img" aria-label="${offer.grade}등급">${gradeStars}</span></h2><div class="plaza-encounter-stats">${statRows.map(([label, value]) => `<span><small>${label}</small><strong>${value}</strong></span>`).join('')}</div>${priceMarkup}</section><div class="plaza-encounter-art">${portrait}</div><section class="plaza-encounter-skills"><span class="section-kicker plaza-encounter-skills-title">보유 스킬</span><div class="plaza-encounter-skill-icons">${skillIcons}</div>${affinityPanel}</section></article>`;
}

function combatStatsFromProfile(stats) {
    return { ...stats };
}

function hireMercenary(characterId) {
    if (state.recruits.length >= maxPartySize) return;
    const offer = state.plazaCurrentOffer;
    if (!offer || offer.id !== characterId) return;
    if (!offer || state.gold < offer.price) return;
    state.gold -= offer.price;
    const stats = combatStatsFromProfile(offer.stats);
    state.recruits.push({
        ...offer,
        affinity: Number(state.affinityByCharacterId[offer.id] ?? offer.affinity ?? 10),
        color: ({ 불: 'red', 물: 'blue', 풀: 'green', 빛: 'ivory', 어둠: 'gold' })[offer.element] || 'red',
        baseStats: { ...stats },
        stats,
        hp: stats.maxHp,
        maxHp: stats.maxHp,
        cooldowns: {},
        effects: [],
    });
    state.plazaCurrentOffer = null;
    state.plazaMessage = `${offer.name}을(를) 고용했습니다.`;
    render();
}

function releaseMercenary(characterId) {
    const index = state.recruits.findIndex((candidate) => candidate.id === characterId);
    if (index < 0) return;
    const [character] = state.recruits.splice(index, 1);
    state.gold += character.price;
    state.plazaOffers.push(character);
    state.plazaMessage = `${character.name}의 고용을 취소했습니다.`;
    render();
}

function encounterNextMercenary() {
    if (!state.plazaOffers.length) {
        state.plazaCurrentOffer = null;
        state.plazaMessage = '더 이상 제안할 용병이 없는 듯 하다';
        render();
        return;
    }
    const index = Math.floor(Math.random() * state.plazaOffers.length);
    state.plazaCurrentOffer = state.plazaOffers.splice(index, 1)[0];
    state.plazaMessage = '';
    render();
}

function passCurrentMercenary() {
    state.plazaCurrentOffer = null;
    encounterNextMercenary();
}

function giftCurrentMercenary() {
    const offer = state.plazaCurrentOffer;
    if (!offer) return;
    if (state.plazaGiftedIds.includes(offer.id)) {
        state.plazaMessage = '이미 선물을 건넸습니다.';
    } else if (state.gold < giftPrice) {
        state.plazaMessage = '선물을 준비할 골드가 부족합니다.';
    } else {
        state.gold -= giftPrice;
        state.plazaGiftedIds.push(offer.id);
        state.plazaMessage = `${offer.name}이(가) 선물을 고맙게 받았습니다.`;
    }
    render();
}

function inviteCurrentMercenaryToGuild() {
    const offer = state.plazaCurrentOffer;
    if (!offer) return;
    if (!state.plazaGuildInvitedIds.includes(offer.id)) state.plazaGuildInvitedIds.push(offer.id);
    state.plazaMessage = `${offer.name}에게 길드원 가입을 제안했습니다. 대답을 기다리는 동안 광장을 둘러볼 수 있습니다.`;
    render();
}

function requestPlazaRest() {
    state.plazaDialog = 'rest';
    render();
}

function weeklyGuildWages() {
    return state.guildMembers.reduce((total, member) => total + Math.max(0, Number(member.weeklyWage) || 0), 0);
}

function weeklyMaintenanceCost() {
    return 100 + weeklyGuildWages();
}

function advanceWeekWithFixedCost(message = '') {
    state.week += 1;
    const guildWages = weeklyGuildWages();
    const fixedCost = 100 + guildWages;
    state.gold -= fixedCost;
    state.plazaOffers = drawPlazaOffers();
    state.plazaCurrentOffer = null;
    state.plazaGiftedIds = [];
    state.plazaGuildInvitedIds = [];
    state.plazaMessage = `${message ? `${message} ` : ''}${state.week}주차 고정비 ${fixedCost}골드(생활비 100 + 길드 주급 ${guildWages})를 차감했습니다.`;
    if (!state.fixedCostNoticeShown) {
        state.fixedCostNoticeShown = true;
        state.plazaDialog = 'maintenance';
    } else if (state.gold < 175) {
        state.plazaDialog = 'support';
    }
}

function returnToPlaza(completed, defeated = false) {
    state.view = 'plaza';
    state.mode = 'explore';
    state.ended = false;
    state.expeditionResult = null;
    state.recruits = [];
    party = [];
    state.room = 0;
    state.turn = -1;
    state.enemies = [];
    state.turnOrder = [];
    state.turnOrderIndex = 0;
    state.enemyPhase = false;
    state.actingEnemy = -1;
    state.enemyAttackLanded = false;
    state.selectedSkill = null;
    state.plazaDialog = '';
    if (completed) {
        state.experience += 50;
        state.gold += 300;
        addLog('원정을 완수해 경험치 50과 골드 300을 획득했습니다.');
    } else {
        addLog(defeated ? '원정대가 전멸해 보상 없이 광장으로 돌아왔습니다.' : '원정을 포기하고 광장으로 돌아왔습니다.');
    }
    state.expeditionRewardBaseline = null;
    advanceWeekWithFixedCost(completed ? '원정을 완수했습니다.' : defeated ? '원정대가 전멸했습니다.' : '원정에서 복귀했습니다.');
    render();
}

function showExpeditionResult(completed, defeated = false) {
    if (state.expeditionResult) return;
    if (!completed && state.expeditionRewardBaseline) {
        state.gold = state.expeditionRewardBaseline.gold;
        state.experience = state.expeditionRewardBaseline.experience;
    }
    const affinityChange = completed ? 5 : -10;
    const memberAffinities = party.map((hero) => {
        const before = Math.min(100, Math.max(0, Number(state.affinityByCharacterId[hero.id] ?? hero.affinity ?? 10)));
        return {
            id: hero.id,
            name: hero.name,
            job: hero.job,
            before,
            after: Math.min(100, Math.max(0, before + affinityChange)),
            change: Math.min(100, Math.max(0, before + affinityChange)) - before,
        };
    });
    const rewardExperience = completed ? 50 : 0;
    const experienceBefore = Math.min(100, state.experience / state.experienceToNextLevel * 100);
    const experienceAfter = Math.min(100, (state.experience + rewardExperience) / state.experienceToNextLevel * 100);
    state.expeditionResult = {
        completed,
        defeated,
        rewardExperience,
        rewardGold: completed ? 300 : 0,
        experienceBefore,
        experienceAfter,
        memberAffinities,
    };
    state.ended = true;
    state.mode = completed ? 'victory' : 'defeat';
    state.message = completed
        ? '보스를 처치하고 회랑을 정복했습니다.'
        : defeated ? '원정대가 전멸했습니다.' : '원정을 포기했습니다.';
    gameMenuOpen = false;
    render();
}

function confirmExpeditionResult() {
    const result = state.expeditionResult;
    if (!result) return;
    result.memberAffinities.forEach(({ id, after }) => {
        state.affinityByCharacterId[id] = after;
    });
    returnToPlaza(result.completed, result.defeated);
}

function requestExpedition() {
    if (!state.recruits.length) return;
    if (state.recruits.length < maxPartySize) {
        state.plazaDialog = 'expedition';
        render();
        return;
    }
    startExpedition();
}

function confirmPlazaDialog() {
    const dialog = state.plazaDialog;
    state.plazaDialog = '';
    if (dialog === 'rest') {
        const fixedCost = weeklyMaintenanceCost();
        if (state.gold < fixedCost) {
            state.plazaMessage = `고정비 ${fixedCost}골드를 낼 자금이 부족합니다.`;
            render();
            return;
        }
        advanceWeekWithFixedCost();
        render();
        return;
    }
    if (dialog === 'maintenance') {
        if (state.gold < 175) state.plazaDialog = 'support';
        render();
        return;
    }
    if (dialog === 'support') {
        const supportAmount = Math.max(0, 175 - state.gold);
        state.gold += supportAmount;
        state.plazaMessage = `국가 원정 지원금 ${supportAmount}원을 받았습니다.`;
        render();
        return;
    }
    if (dialog === 'expedition') startExpedition();
}

function cancelPlazaDialog() {
    state.plazaDialog = '';
    render();
}

function startExpedition() {
    if (!state.recruits.length) return;
    party = state.recruits.map((character) => {
        const stats = character.stats;
        return {
            ...character,
            skill: character.skills[0]?.name || '기본 공격',
            hp: stats.maxHp,
            maxHp: stats.maxHp,
            cooldowns: {},
            effects: [],
        };
    });
    Object.assign(state, {
        view: 'expedition', mode: 'explore', room: 0, turn: 0, enemies: [], enemyPhase: false,
        actingEnemy: -1, enemyAttackLanded: false, selectedSkill: null, ended: false, expeditionResult: null,
        expeditionRewardBaseline: { gold: state.gold, experience: state.experience },
        message: '고용한 용병들이 원정대에 합류했습니다.',
        log: [`${party.length}명의 용병이 원정을 시작했습니다.`],
    });
    render();
}

function renderPlazaLegacy() {
    const recruits = state.recruits.map((character) => `<div class="plaza-hired-row"><span class="plaza-hired-name">${catalogIconMarkup(jobGlyphs[character.job] || '✦', '#c2a767', character.job, 'plaza-hired-icon')}<strong>${escapeHtml(character.name)}</strong><small>${escapeHtml(character.job)} · ${character.grade}등급</small></span><span class="plaza-hired-health">${character.stats.maxHp} HP</span></div>`).join('');
    const vacantSlots = Array.from({ length: maxPartySize - state.recruits.length }, () => `<div class="plaza-empty-slot"><small>빈 용병 자리</small></div>`).join('');
    const offer = state.plazaCurrentOffer;
    const remaining = state.plazaOffers.length + (offer ? 1 : 0);
    const giftUsed = offer && state.plazaGiftedIds.includes(offer.id);
    const guildInvited = offer && state.plazaGuildInvitedIds.includes(offer.id);
    const choices = offer
        ? `<div class="plaza-choice-grid"><button data-action="plaza-hire" data-character-id="${escapeHtml(offer.id)}" ${state.recruits.length >= maxPartySize || state.gold < offer.price ? 'disabled' : ''}>용병 제안 · ${offer.price}G</button><button data-action="plaza-guild" disabled>${guildInvited ? '길드 제안 완료' : '길드원 제안'}</button><button data-action="plaza-gift" disabled>${giftUsed ? '선물 전달 완료' : `선물 주기 · ${giftPrice}G`}</button><button data-action="plaza-pass">지나가기 <span>→</span></button></div><p class="plaza-feedback">${escapeHtml(state.plazaMessage)}</p>`
        : `<button class="plaza-look-around" data-action="plaza-look-around" ${state.plazaOffers.length === 0 ? 'disabled' : ''}>광장을 둘러본다 <span>→</span></button><p class="plaza-feedback">${escapeHtml(state.plazaMessage || (state.plazaOffers.length === 0 ? '더 이상 제안할 용병이 없는 듯 하다' : ''))}</p>`;
    game.innerHTML = `<header class="topbar plaza-topbar"><a class="wordmark" href="#" aria-label="검은 회랑 광장"><span class="wordmark-sigil">✠</span><span>검은 회랑<small>모험가 광장</small></span></a><div class="plaza-player-meta"><span>플레이어 Lv.${state.userLevel}</span><strong><i>◈</i> ${state.gold} 골드</strong><button class="catalog-open" data-action="catalog">도감</button></div></header><main class="plaza-page"><section class="scene plaza-scene"><div class="scene-heading"><span class="section-kicker">모험가 광장</span><h1>${offer ? '새로운 만남' : '광장을 둘러보다'}</h1><p>${offer ? '광장에 한 명의 모험가가 다가왔습니다.' : `${remaining}명의 용병을 만날 수 있습니다.`}</p></div><div class="dungeon-art plaza-encounter-stage"><div class="art-haze haze-one"></div><div class="art-haze haze-two"></div><div class="arch arch-outer"><div class="arch arch-inner"><div class="arch-opening"><div class="distant-light"></div><div class="distant-floor"></div></div></div></div><div class="wall wall-left"><i></i><i></i><i></i><i></i><i></i></div><div class="wall wall-right"><i></i><i></i><i></i><i></i><i></i></div><div class="floor-stone"></div>${offer ? plazaEncounterMarkup(offer) : `<div class="plaza-empty-stage"><span class="plaza-stage-sigil">✦</span><p>${escapeHtml(state.plazaMessage || (state.plazaOffers.length === 0 ? '더 이상 제안할 용병이 없는 듯 하다' : '광장에는 여러 모험가가 오갑니다.'))}</p></div>`}</div></section><section class="lower-grid plaza-lower-grid"><section class="party-panel plaza-roster"><div class="panel-heading"><div><span class="section-kicker">원정 준비</span><h2>용병단 <small>${state.recruits.length}/${maxPartySize}</small></h2></div><span class="formation-label">Lv.${state.userLevel}</span></div><div class="plaza-hired-list">${recruits}${vacantSlots}</div><div class="plaza-depart-row"><button class="plaza-depart" data-action="plaza-depart" ${state.recruits.length === 0 ? 'disabled' : ''}>원정 출발 <span>→</span></button></div></section><aside class="action-panel plaza-action-panel"><div class="panel-heading"><div><span class="section-kicker">${offer ? '선택' : '다음 조우'}</span><h2>${offer ? `${offer.name}과의 대화` : '광장을 살펴본다'}</h2></div><span class="turn-indicator">${remaining}명 남음</span></div>${choices}</aside></section></main><footer class="bottom-note"><span>검은 회랑 <i>·</i> 광장</span><span>직업별 용병 제안 · 최대 ${maxPartySize}명</span></footer>`;
}

function renderPlaza() {
    const transitionClass = plazaTransitionPhase ? ` plaza-transition-${plazaTransitionPhase}` : '';
    plazaTransitionPhase = '';
    const offer = state.plazaCurrentOffer;
    const activeDialogue = getActivePlazaDialogue();
    const isMonologue = activeDialogue?.dialogue.presentation === 'monologue';
    const isOneOnOne = activeDialogue?.dialogue.presentation === 'oneOnOne';
    const isTwoPerson = activeDialogue?.dialogue.presentation === 'twoPerson';
    const dialogueCharacter = isOneOnOne
        ? catalogData.characters.find((character) => character.id === activeDialogue.dialogue.characterId)
        : null;
    const dialogueCharacterName = dialogueCharacter?.name || '모험가';
    const dialogueParticipants = activeDialogue?.dialogue.participants || [];
    const dialogueParticipantNames = dialogueParticipants.map((id) => catalogData.characters.find((character) => character.id === id)?.name || '모험가');
    const dialogueContextLabel = isMonologue
        ? '독백'
        : isOneOnOne
            ? `${dialogueCharacterName}과 대화`
            : isTwoPerson
                ? `${dialogueParticipantNames[0] || '인물'}과 ${dialogueParticipantNames[1] || '인물'}의 대화`
                : '';
    const currentStateDescription = offer
        ? '광장에서 모험가와 계약 중입니다.'
        : state.plazaOffers.length
            ? '원정대원을 모으고 다음 여정을 준비합니다.'
            : '더 이상 제안할 용병이 없는 듯 하다';
    const recruits = state.recruits.map((hero, index) => heroMarkup(hero, index)).join('');
    const vacantSlots = Array.from({ length: maxPartySize - state.recruits.length }, () => `<article class="hero plaza-empty-hero"><span class="plaza-empty-avatar">◇</span><span class="plaza-empty-label">빈 자리</span></article>`).join('');
    const giftUsed = offer && state.plazaGiftedIds.includes(offer.id);
    const guildInvited = offer && state.plazaGuildInvitedIds.includes(offer.id);
    const choices = offer
        ? `<div class="action-buttons plaza-choice-grid plaza-action-buttons"><button class="combat-action" data-action="plaza-hire" data-character-id="${escapeHtml(offer.id)}" ${state.recruits.length >= maxPartySize || state.gold < offer.price ? 'disabled' : ''}>${catalogIconMarkup(jobGlyphs[offer.job] || '✚', '#a6d7e8', '', 'plaza-action-icon')}<span class="plaza-action-label">용병 제안</span></button><button class="combat-action" data-action="plaza-guild" disabled>${catalogIconMarkup('⚑', '#a6d7e8', '', 'plaza-action-icon')}<span class="plaza-action-label">${guildInvited ? '길드원 제안 완료' : '길드원 제안'}</span></button><button class="combat-action" data-action="plaza-gift" disabled>${catalogIconMarkup('◇', '#a6d7e8', '', 'plaza-action-icon')}<span class="plaza-action-label">${giftUsed ? '선물 전달 완료' : `선물 주기 · ${giftPrice}G`}</span></button><button class="combat-action" data-action="plaza-pass">${catalogIconMarkup('→', '#a6d7e8', '', 'plaza-action-icon')}<span class="plaza-action-label">지나가기</span></button></div><p class="target-hint plaza-feedback">${escapeHtml(state.plazaMessage)}</p>`
        : `<div class="action-buttons plaza-town-actions plaza-action-buttons"><button class="combat-action" data-action="plaza-look-around" ${state.plazaOffers.length === 0 ? 'disabled' : ''}>${catalogIconMarkup('◉', '#a6d7e8', '', 'plaza-action-icon')}<span class="plaza-action-label">광장을 살펴본다</span></button><button class="combat-action" data-action="plaza-rest">${catalogIconMarkup('◷', '#a6d7e8', '', 'plaza-action-icon')}<span class="plaza-action-label">한 주 쉬기</span></button><button class="combat-action" data-action="plaza-depart" ${state.recruits.length === 0 ? 'disabled' : ''}>${catalogIconMarkup('⚑', '#a6d7e8', '', 'plaza-action-icon')}<span class="plaza-action-label">원정 출발</span></button></div><p class="target-hint plaza-feedback">${escapeHtml(state.plazaMessage)}</p>`;
    const experiencePercent = Math.min(100, Math.max(0, state.experience / state.experienceToNextLevel * 100));
    const guildWages = weeklyGuildWages();
    const maintenance = weeklyMaintenanceCost();
    const dialog = state.plazaDialog === 'rest'
        ? { title: '한 주 쉬기', label: '주간 고정비', message: `생활비 100골드와 길드원 주급 ${guildWages}골드, 총 ${maintenance}골드가 차감됩니다. 한 주를 건너뛰시겠습니까?`, confirm: '한 주 쉬기' }
        : state.plazaDialog === 'maintenance'
            ? { title: '주간 고정비 안내', label: '첫 고정비 납부', message: `매주 생활비 100골드와 길드원 주급 ${guildWages}골드가 차감됩니다. 이번 주 고정비 ${maintenance}골드를 납부했습니다.`, confirm: '확인', cancel: false }
        : state.plazaDialog === 'support'
            ? { title: '국가 원정 지원금', label: '왕국의 격려', message: '회랑의 평화를 위해 나서는 원정대여, 왕국은 그대들의 용기와 노고를 기억한다. 여정을 멈추지 않도록 금화를 보탠다.', confirm: `${Math.max(0, 175 - state.gold)}원 받기`, cancel: false }
        : state.plazaDialog === 'expedition'
            ? { title: '원정 출발', label: '원정대 확인', message: `원정에는 4명의 용병을 고용하는 것을 추천합니다. 현재 ${state.recruits.length}명의 용병이 원정대에 참여한 상태입니다. 이대로 원정을 떠나시겠습니까?`, confirm: '이대로 출발' }
            : null;
    const header = `<header class="topbar plaza-topbar${transitionClass}"><div class="player-profile"><div class="player-profile-name"><strong>${escapeHtml(state.playerName)}</strong>${playerZodiacIconMarkup()}<span>Lv.${state.userLevel}</span></div><div class="player-experience"><div><span>경험치</span><strong>${state.experience}/${state.experienceToNextLevel}</strong></div><div class="plaza-exp-track"><span style="width:${experiencePercent}%"></span></div></div></div><div class="plaza-player-meta"><button class="game-menu-button" type="button" data-action="game-menu-open" aria-label="메뉴" title="메뉴">☰</button></div></header>`;
    const sceneContent = isOneOnOne || isTwoPerson ? '' : offer ? plazaEncounterMarkup(offer) : '<div class="plaza-empty-stage"></div>';
    const dialogueContext = dialogueContextLabel
        ? `<span class="plaza-dialogue-context-diamond" aria-hidden="true">◆</span><span class="plaza-dialogue-context-label">${escapeHtml(dialogueContextLabel)}</span>`
        : '';
    const scene = `<section class="scene plaza-scene"><div class="scene-heading"><h1>모험가 광장</h1>${dialogueContext}<div class="plaza-current-info"><span>${state.week}주차</span><strong><i>◈</i> ${state.gold} 골드</strong></div></div><div class="dungeon-art plaza-encounter-stage">${sceneContent}</div></section>`;
    const roster = `<section class="party-panel plaza-roster"><div class="panel-heading"><div><span class="section-kicker">원정 준비</span><h2>원정대 <small>${state.recruits.length}/${maxPartySize}</small></h2></div><span class="formation-label">Lv.${state.userLevel}</span></div><div class="party-list plaza-party-list">${recruits}${vacantSlots}</div></section>`;
    const dialogueNode = activeDialogue?.node;
    const dialogueText = dialogueNode?.text
        ?.replaceAll('{{playerName}}', state.playerName)
        .replaceAll('{{characterName}}', dialogueCharacterName)
        .replaceAll('{{characterOneName}}', dialogueParticipantNames[0] || '모험가')
        .replaceAll('{{characterTwoName}}', dialogueParticipantNames[1] || '모험가') || '';
    const dialogueSpeaker = dialogueNode?.speaker
        ?.replaceAll('{{playerName}}', state.playerName)
        .replaceAll('{{characterName}}', dialogueCharacterName)
        .replaceAll('{{characterOneName}}', dialogueParticipantNames[0] || '모험가')
        .replaceAll('{{characterTwoName}}', dialogueParticipantNames[1] || '모험가') || dialogueCharacterName;
    const dialogueChoices = dialogueNode?.choices?.length
        ? `<div class="plaza-dialogue-choices">${dialogueNode.choices.slice(0, 8).map((choice) => `<button class="combat-action" type="button" data-action="plaza-dialogue-advance" data-dialogue-next="${escapeHtml(choice.next)}">${escapeHtml(choice.text)}</button>`).join('')}</div>`
        : `<div class="plaza-dialogue-controls"><button class="combat-action" type="button" data-action="plaza-dialogue-advance">${dialogueNode?.end ? '광장 둘러보기' : '다음'}</button></div>`;
    const dialogueMarkup = activeDialogue && !isMonologue && !isOneOnOne && !isTwoPerson
        ? `<div class="plaza-dialogue-copy" aria-live="polite"><span class="plaza-dialogue-speaker">${escapeHtml(dialogueSpeaker)}</span><p>${escapeHtml(dialogueText)}</p></div>${dialogueChoices}`
        : isMonologue ? '' : choices;
    const actionPanel = `<aside class="action-panel plaza-action-panel"><div class="panel-heading"><div><span class="section-kicker">${activeDialogue ? escapeHtml(activeDialogue.dialogue.label) : offer ? '계약 진행' : '광장 행동'}</span><h2>${activeDialogue ? escapeHtml(activeDialogue.dialogue.title) : offer ? `${escapeHtml(offer.name)}과의 계약` : '원정 준비'}</h2></div><span class="plaza-state-description">${escapeHtml(currentStateDescription)}</span></div>${dialogueMarkup}</aside>`;
    const modal = dialog ? `<div class="end-overlay plaza-confirm-overlay"><section class="end-dialog" role="dialog" aria-modal="true" aria-labelledby="plaza-dialog-title"><span class="section-kicker">${dialog.label}</span><h2 id="plaza-dialog-title">${dialog.title}</h2><p>${dialog.message}</p><div class="plaza-dialog-actions ${dialog.cancel === false ? 'single-action' : ''}">${dialog.cancel === false ? '' : '<button class="plaza-dialog-cancel" data-action="plaza-dialog-cancel">취소</button>'}<button data-action="plaza-dialog-confirm">${dialog.confirm}</button></div></section></div>` : '';
    const plazaJobSummary = !activeDialogue && !offer && state.plazaOffers.length
        ? `<p class="plaza-job-summary">광장에 <span class="plaza-job-counts">${plazaJobCountsMarkup()}</span>이 남아 있습니다. 광장을 탐색하여 그들과 조우해보세요.</p>`
        : '';
    game.innerHTML = `${header}<main class="plaza-page${transitionClass}">${scene}<section class="lower-grid plaza-lower-grid">${roster}${actionPanel}</section></main><footer class="bottom-note${transitionClass}"><span>원정대 ${state.recruits.length}/${maxPartySize}</span><span>최대 ${maxPartySize}명</span></footer>${modal}${gameMenuMarkup()}`;
    if (plazaJobSummary) game.querySelector('.plaza-empty-stage')?.insertAdjacentHTML('beforeend', plazaJobSummary);
    if (isMonologue) {
        const stage = game.querySelector('.plaza-encounter-stage');
        stage?.insertAdjacentHTML('beforeend', `<p class="plaza-job-summary plaza-monologue-text" aria-live="polite">${escapeHtml(dialogueText)}</p>`);
        const lowerGrid = game.querySelector('.plaza-lower-grid');
        if (lowerGrid) {
            lowerGrid.classList.add('plaza-lower-grid-monologue');
            lowerGrid.innerHTML = '<div class="plaza-monologue-controls"><button class="combat-action plaza-monologue-next" type="button" data-action="plaza-dialogue-advance">다음</button></div>';
        }
    }
    if (isOneOnOne || isTwoPerson) {
        const stage = game.querySelector('.plaza-encounter-stage');
        const dialoguePortraits = isOneOnOne
            ? [{ id: activeDialogue.dialogue.characterId, character: dialogueCharacter, name: dialogueCharacterName, side: 'center' }]
            : dialogueParticipants.map((id, index) => ({
                id,
                character: catalogData.characters.find((character) => character.id === id),
                name: dialogueParticipantNames[index],
                side: index === 0 ? 'left' : 'right',
            }));
        const portraitMarkup = dialoguePortraits.map(({ id, character, name, side }) => {
            const portraitSrc = characterPortraitAssets[id];
            return portraitSrc
                ? `<div class="codex-character-art-mask plaza-dialogue-character-mask plaza-dialogue-character-${side}" aria-hidden="true"><img src="${portraitSrc}" alt="" draggable="false"></div>`
                : `<div class="plaza-dialogue-character-fallback plaza-dialogue-character-${side}">${catalogIconMarkup(character?.mark || jobGlyphs[character?.job] || '✧', elementTints[character?.element] || '#a6d7e8', name, 'plaza-dialogue-character-icon')}</div>`;
        }).join('');
        const bubbleSide = isTwoPerson
            ? dialogueNode.speakerCharacterId === dialogueParticipants[0] ? 'center-left' : 'center-right'
            : activeDialogue.bubbleSide;
        stage?.insertAdjacentHTML('beforeend', `${portraitMarkup}<div class="plaza-dialogue-bubble is-${bubbleSide}" aria-live="polite"><p>${escapeHtml(dialogueText)}</p></div>`);
        const lowerGrid = game.querySelector('.plaza-lower-grid');
        const choices = (dialogueNode?.choices || []).slice(0, 8);
        const choiceButtons = choices.map((choice) => `<button class="combat-action plaza-dialogue-choice" type="button" data-action="plaza-dialogue-advance" data-dialogue-next="${escapeHtml(choice.next)}">${escapeHtml(choice.text)}</button>`).join('');
        if (lowerGrid) {
            lowerGrid.classList.add('plaza-lower-grid-one-on-one');
            lowerGrid.innerHTML = `<div class="plaza-dialogue-options" role="group" aria-label="대화 선택지">${choiceButtons}</div>`;
        }
        if (!choices.length) {
            stage?.insertAdjacentHTML('beforeend', '<button class="plaza-dialogue-next-icon" type="button" data-action="plaza-dialogue-advance" aria-label="다음 대사"><span aria-hidden="true">⌄</span></button>');
        }
    }
}

let skillNoticeTimer;

function addLog(text) {
    state.log.unshift(text);
    state.log = state.log.slice(0, 4);
}

function announceSkill(name) {
    state.skillNotice = { name, startedAt: Date.now() };
    clearTimeout(skillNoticeTimer);
    render();
    const notice = state.skillNotice;
    skillNoticeTimer = setTimeout(() => {
        if (state.skillNotice === notice) {
            state.skillNotice = null;
            game.querySelector('.skill-announce')?.remove();
        }
    }, 1800);
}

function bar(value, max, className) {
    const safeValue = Number.isFinite(Number(value)) ? Number(value) : 0;
    const safeMax = Number.isFinite(Number(max)) && Number(max) > 0 ? Number(max) : 1;
    const percent = Math.max(0, Math.min(100, (safeValue / safeMax) * 100));
    return `<div class="meter ${className}"><span style="width:${percent}%"></span></div>`;
}

function normalizeCombatState() {
    party.forEach((hero) => {
        const maxHp = Number(hero.stats?.maxHp ?? hero.maxHp);
        if (!Number.isFinite(maxHp) || maxHp <= 0) return;
        hero.maxHp = maxHp;
        if (!Number.isFinite(Number(hero.hp))) hero.hp = maxHp;
    });
    state.enemies.forEach((enemy) => {
        const maxHp = Number(enemy.maxHp ?? enemy.stats?.maxHp);
        if (!Number.isFinite(maxHp) || maxHp <= 0) return;
        enemy.maxHp = maxHp;
        if (!Number.isFinite(Number(enemy.hp))) enemy.hp = maxHp;
    });
}

function showCombatNumber(target, type, amount) {
    target.combatNumber = { type, amount, at: Date.now() };
}

function combatNumberMarkup(target) {
    const now = Date.now();
    const number = target.combatNumber;
    if (!number || now - number.at >= 1400) return '';
    const prefix = number.type === 'healing' ? '+' : number.type === 'miss' ? '' : '-';
    const criticalMark = number.type === 'critical' ? '!' : '';
    const label = number.type === 'miss' ? number.amount : `${prefix}${number.amount}${criticalMark}`;
    return `<span class="damage-float ${number.type}" style="animation-delay:-${now - number.at}ms">${label}</span>`;
}

function heroMarkup(hero, index) {
    const fallen = hero.hp <= 0;
    const hit = Date.now() - (hero.hitAt || 0) < 1500;
    const selectedSkill = battleSkillsFor(party[state.turn]).find((skill) => skill.id === state.selectedSkill);
    const canRevive = selectedSkill?.effects?.some((effect) => normalizedCombatEffect(effect).code === 'REVIVE');
    const targetable = battleTargetFor(selectedSkill) === 'ally' && !state.enemyPhase && (!fallen || canRevive);
    return `<article class="hero ${fallen ? 'fallen' : ''} ${hit ? 'hit' : ''} ${targetable ? 'targetable' : ''} ${state.mode === 'combat' && !state.enemyPhase && state.turn === index ? 'active' : ''}" ${targetable ? `data-ally-target="${index}" role="button" tabindex="0" aria-label="${hero.name}, 체력 ${hero.hp}/${hero.maxHp}"` : ''}>
        ${combatNumberMarkup(hero)}
        ${characterTooltip(hero)}
        <div class="hero-card-head">
            <div class="hero-identity"><span class="roster-avatar-frame element-border-${elementBorderClasses[hero.element] || 'light'}">${catalogIconMarkup(hero.mark, elementTints[hero.element] || '#a99060', hero.name, 'roster-avatar', `${hero.name} · ${hero.element}`)}</span><div class="hero-copy"><span class="hero-title">${hero.element} · ${hero.title || hero.job} · ${hero.grade}등급</span><strong class="hero-name">${hero.name}</strong></div></div>
        </div>
        <div class="hero-vitals"><span>HP</span><strong class="hero-status ${hit ? 'hit-text' : ''}">${fallen ? '전투 불능' : `${hero.hp} <small>/ ${hero.maxHp}</small>`}</strong></div>
        ${bar(hero.hp, hero.maxHp, 'health')}
        ${statusEffectsMarkup(hero)}
    </article>`;
}

function enemyMarkup(enemy, index) {
    const hit = Date.now() - (enemy.hitAt || 0) < 1500;
    const acting = state.enemyPhase && state.actingEnemy === index;
    return `<button class="enemy ${enemy.hp <= 0 ? 'defeated' : ''} ${acting ? 'acting' : ''} ${acting && state.enemyAttackLanded ? 'settled' : ''} ${hit ? 'hit' : ''}" data-target="${index}" ${enemy.hp <= 0 || state.mode !== 'combat' || state.enemyPhase ? 'disabled' : ''} aria-label="${enemy.name}, 체력 ${enemy.hp}">
        ${combatNumberMarkup(enemy)}
        <span class="enemy-mark">${enemy.mark}</span><span class="enemy-name">${enemy.name}</span>
        <span class="enemy-meta">${enemy.element} · Lv.${enemy.level} · ${enemy.grade}등급</span>
        ${statusEffectsMarkup(enemy)}
        ${bar(enemy.hp, enemy.maxHp, 'enemy-health')}<span class="enemy-hp ${hit ? 'hit-text' : ''}">${enemy.hp > 0 ? `${enemy.hp} / ${enemy.maxHp}` : '쓰러짐'}</span>
    </button>`;
}

function combatMonsterFromProfile(monster) {
    return {
        ...monster,
        hp: monster.stats.maxHp,
        maxHp: monster.stats.maxHp,
        effects: [],
        cooldowns: {},
        skills: monster.skills.map((skill) => ({ ...skill })),
    };
}

function monstersForEncounter(boss) {
    const roster = generateRosters(catalogData.growthRows, state.userLevel, catalogData.skills).monsters;
    const candidates = boss ? roster.filter((monster) => monster.grade === 5) : [...roster];
    const count = boss ? 1 : 2 + Math.floor(Math.random() * 3);
    const selected = [];
    while (selected.length < count && candidates.length) {
        const index = Math.floor(Math.random() * candidates.length);
        selected.push(combatMonsterFromProfile(candidates.splice(index, 1)[0]));
    }
    return selected;
}

function render() {
    syncBackgroundMusic();
    if (state.view === 'lobby') return renderLobby();
    if (state.view === 'playerSetup') return renderPlayerSetup();
    if (state.view === 'catalog') {
        saveGame();
        return renderCatalog();
    }
    if (state.view === 'characterCodex') {
        saveGame();
        return renderCharacterCodex();
    }
    if (state.view === 'plaza') {
        saveGame();
        return renderPlaza();
    }
    normalizeCombatState();
    saveGame();
    const room = rooms[Math.min(state.room, rooms.length - 1)];
    const progress = (state.room / (rooms.length - 1)) * 100;
    const currentHero = party[state.turn] || party.find((hero) => hero.hp > 0) || party[0];
    const currentSkills = battleSkillsFor(currentHero);
    const encounter = state.mode === 'combat';
    const livingEnemies = state.enemies.filter((enemy) => enemy.hp > 0);
    const selectedSkill = currentSkills.find((skill) => skill.id === state.selectedSkill);
    const selectedTargetType = selectedSkill ? battleTargetFor(selectedSkill) : '';
    const choosingEnemy = selectedTargetType === 'enemy';
    const choosingAlly = selectedTargetType === 'ally';

    game.innerHTML = `
        <header class="topbar player-topbar">
            <div class="player-profile"><div class="player-profile-name"><strong>${escapeHtml(state.playerName)}</strong>${playerZodiacIconMarkup()}<span>Lv.${state.userLevel}</span></div><div class="player-experience"><div><span>경험치</span><strong>${state.experience}/${state.experienceToNextLevel}</strong></div><div class="plaza-exp-track"><span style="width:${Math.min(100, state.experience / state.experienceToNextLevel * 100)}%"></span></div></div></div>
            <button class="sound-button" data-action="retreat" aria-label="원정 포기" title="원정 포기">⤺</button>
            <button class="game-menu-button" type="button" data-action="game-menu-open" aria-label="메뉴" title="메뉴">☰</button>
        </header>

        <section class="journey-strip" aria-label="원정 진행도">
            <div class="journey-label"><span>지하 묘지</span><strong>제 1구역 <i>·</i> ${room.name}</strong></div>
            <div class="journey-track"><div class="journey-fill" style="width:${progress}%"></div>${rooms.map((item, index) => `<span class="journey-node ${index < state.room ? 'passed' : ''} ${index === state.room ? 'current' : ''} ${item.type === '보스' ? 'boss-node' : ''}" style="left:${(index / (rooms.length - 1)) * 100}%" title="${item.name}"></span>`).join('')}</div>
        </section>

        <section class="scene ${encounter ? 'in-combat' : ''}" aria-label="던전 장면">
            <div class="dungeon-art ${encounter ? 'battle-art' : ''}" aria-hidden="true">
                <div class="art-haze haze-one"></div><div class="art-haze haze-two"></div>
                <div class="arch arch-outer"><div class="arch arch-inner"><div class="arch-opening"><div class="distant-light"></div><div class="distant-floor"></div></div></div></div>
                <div class="wall wall-left"><i></i><i></i><i></i><i></i><i></i></div><div class="wall wall-right"><i></i><i></i><i></i><i></i><i></i></div>
                <div class="floor-stone"></div>
                ${encounter ? `<div class="enemy-line ${state.enemyPhase ? 'enemy-phase' : ''} ${choosingEnemy ? 'choosing-target' : ''}">${state.enemies.map(enemyMarkup).join('')}</div>` : `<div class="scene-caption"><span>✦</span><span>${state.message}</span></div>`}
                ${state.skillNotice && Date.now() - state.skillNotice.startedAt < 1800 ? `<div class="skill-announce" style="animation-delay:-${Date.now() - state.skillNotice.startedAt}ms">${state.skillNotice.name}</div>` : ''}
                <span class="scene-coordinate">D · 0${Math.min(state.room + 1, rooms.length)}</span>
            </div>
        </section>

        <section class="lower-grid">
            <section class="party-panel"><div class="panel-heading"><div><span class="section-kicker">생존자</span><h2>원정대 <small>${party.length}</small></h2></div></div><div class="party-list ${choosingAlly ? 'choosing-ally' : ''}">${party.map(heroMarkup).join('')}</div></section>
            <aside class="action-panel"><div class="panel-heading"><div><span class="section-kicker">${encounter ? state.enemyPhase ? '적 행동' : '행동 차례' : '기록'}</span><h2>${encounter ? state.enemyPhase ? '적의 공격' : currentHero.name : '원정 일지'}</h2></div></div>
                ${encounter ? `<div class="action-buttons ${state.enemyPhase ? '' : selectedTargetType === 'enemy' || selectedTargetType === 'ally' ? 'choosing-target' : 'choosing-skill'}">${currentSkills.map((skill) => { const cooldown = currentHero.cooldowns?.[skill.id] || 0; const [glyph, tint] = skillGlyph(skill); return `<button class="combat-action ${state.selectedSkill === skill.id ? 'selected' : ''} ${cooldown ? 'on-cooldown' : ''}" data-action="skill" data-skill="${skill.id}" aria-label="${skill.name}" ${currentHero.hp <= 0 || state.enemyPhase || cooldown > 0 ? 'disabled' : ''}>${catalogIconMarkup(glyph, tint, skill.name, 'combat-skill-icon')}<span class="combat-skill-name">${escapeHtml(skill.name)}</span>${cooldown ? '<small class="combat-skill-cooldown">대기</small>' : ''}${skillTooltip(skill, currentHero)}</button>`; }).join('')}</div><p class="target-hint">${state.enemyPhase ? '적의 기술을 기다리십시오.' : selectedSkill && selectedTargetType === 'ally' ? `${selectedSkill.name} · 아군 대상을 선택하십시오.` : selectedSkill && selectedTargetType === 'enemy' ? `${selectedSkill.name} · 적 대상을 선택하십시오.` : '먼저 사용할 기술을 선택하십시오.'}</p>` : `<div class="journal-list">${state.log.slice(0, 3).map((line) => `<p><i>—</i>${line}</p>`).join('')}</div><button class="continue-button" data-action="advance" ${state.ended ? 'disabled' : ''}>${state.ended ? '원정 종료' : room.type === '보스' ? '최후의 문을 열기' : '다음 방으로 이동'}<span>→</span></button>`}
            </aside>
        </section>
        <footer class="bottom-note"><span>검은 회랑 <i>·</i> 살아서 돌아갈 수 있을까</span><span>빛은 곧 꺼진다</span></footer>
        ${state.expeditionResult ? expeditionResultMarkup(state.expeditionResult) : state.ended ? `<div class="end-overlay"><div class="end-dialog"><span class="section-kicker">원정 결과</span><h2>${state.mode === 'victory' ? '던전 정복' : '원정의 끝'}</h2><p>${state.message}</p><button data-action="restart">새 원정 시작 <span>→</span></button></div></div>` : ''}
        ${gameMenuMarkup()}
    `;
    if (state.expeditionResult) animateExpeditionResults();
}

function startEncounter(boss = false) {
    state.mode = 'combat';
    state.turn = -1;
    state.enemyPhase = false;
    state.actingEnemy = -1;
    state.enemyAttackLanded = false;
    state.selectedSkill = null;
    state.enemies = monstersForEncounter(boss);
    state.turnOrder = [];
    state.turnOrderIndex = 0;
    state.message = boss ? '깊은 곳에서 무언가 깨어났습니다.' : '적들이 어둠 속에서 달려듭니다.';
    addLog(`${boss ? '잊힌 선조' : '적'}과 조우했습니다.`);
    void activateNextCombatant();
}

function checkParty() {
    if (party.every((hero) => hero.hp <= 0)) {
        showExpeditionResult(false, true);
        return true;
    }
    return false;
}

function finishEncounter() {
    const bossWon = rooms[state.room].type === '보스';
    if (bossWon) return showExpeditionResult(true);
    state.mode = bossWon ? 'victory' : 'explore';
    state.turn = -1;
    state.turnOrder = [];
    state.turnOrderIndex = 0;
    state.enemyPhase = false;
    state.actingEnemy = -1;
    state.message = '적을 물리쳤습니다. 잠시 숨을 돌릴 수 있습니다.';
    addLog('적을 물리쳤습니다. 원정을 계속 진행합니다.');
    render();
}

const wait = (duration) => new Promise((resolve) => setTimeout(resolve, duration));

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
const statusStatModifiers = {
    ATTACK_UP: ['attack', 1], ATTACK_UP_GREATER: ['attack', 1], ATTACK_DOWN: ['attack', -1],
    DEFENSE_UP: ['defense', 1], DEFENSE_DOWN: ['defense', -1], SPEED_UP: ['speed', 1], SPEED_DOWN: ['speed', -1],
};

function normalizedCombatEffect(effect) {
    const code = effect.code || legacyEffectCodes[effect.type] || String(effect.type || '').toUpperCase();
    const rawChance = Number(effect.chance ?? 1);
    return {
        ...effect,
        code,
        name: effect.name || effectLabels[effect.type]?.(effect) || code,
        chance: rawChance > 1 ? rawChance / 100 : rawChance,
        duration: Number(effect.duration ?? effect.turns ?? 0),
        value: Number(effect.value ?? 0),
        category: buffEffectCodes.has(code) ? 'buff' : debuffEffectCodes.has(code) ? 'debuff' : 'status',
    };
}

function statusEffectsMarkup(actor) {
    const effects = (actor.effects || []).filter((effect) => effect.turnsRemaining > 0 || effect.code === 'INJURY');
    if (!effects.length) return '';
    return `<div class="combat-statuses">${effects.map((effect) => {
        const glyph = effect.category === 'buff' ? '↑' : effect.category === 'debuff' ? '⊖' : '✦';
        return `<span class="combat-status ${effect.category}" title="${escapeHtml(effect.name)} · ${effect.turnsRemaining ? `${effect.turnsRemaining}턴` : '지속'}"><b>${glyph}</b>${escapeHtml(effect.name)}${effect.turnsRemaining ? `<small>${effect.turnsRemaining}</small>` : ''}</span>`;
    }).join('')}</div>`;
}

function addCombatEffect(target, source, rawEffect, chancePassed = false) {
    const effect = normalizedCombatEffect(rawEffect);
    if (!effect.code || effect.duration <= 0 && effect.code !== 'INJURY') return false;
    target.effects ||= [];
    if (effect.category === 'debuff' && target.effects.some((active) => active.code === 'IMMUNITY' && active.turnsRemaining > 0)) return false;
    if (effect.category === 'buff' && target.effects.some((active) => active.code === 'BUFF_BLOCK' && active.turnsRemaining > 0)) return false;
    if (!chancePassed && Math.random() >= effect.chance) return false;
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
    const actorIsHero = party.includes(actor);
    const allies = actorIsHero ? party : state.enemies;
    const enemies = actorIsHero ? state.enemies : party;
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
        const allies = party.includes(actor) ? party : state.enemies;
        const selectedAllies = primaryTargets.filter((target) => allies.includes(target));
        return selectedAllies.length ? selectedAllies : [actor];
    }
    if (['자신→대상', '원래 공격 대상', '이번 주공격'].includes(effectTarget)) return primaryTargets;
    if (effect.category === 'buff' && ['enemy', 'enemyAll'].includes(battleTargetFor(skill))) return [actor];
    return primaryTargets.length ? primaryTargets : [actor];
}

function healCombatant(target, amount) {
    if (!target || target.hp <= 0 || hasCombatEffect(target, 'HEAL_BLOCK')) return 0;
    const healing = Math.max(0, Math.min(Math.round(amount), target.maxHp - target.hp));
    target.hp += healing;
    if (healing) showCombatNumber(target, 'healing', healing);
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

function applyDirectDamage(attacker, target, amount, allowReactions = true, allowCounter = allowReactions) {
    if (!target || target.hp <= 0 || amount <= 0 || hasCombatEffect(target, 'INVINCIBILITY')) return 0;
    let incoming = Math.max(1, Math.round(amount));
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
    if (allowReactions && incoming > 0) {
        const team = party.includes(target) ? party : state.enemies;
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
        playWebSound('hit');
        target.hitAt = Date.now();
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
        }
    }
    if (allowReactions && actualDamage > 0 && attacker?.hp > 0) {
        const team = party.includes(target) ? party : state.enemies;
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
        return;
    }
    if (code === 'REVIVE') {
        if (target.hp > 0 || target.reviveUsed || target.extinct || hasCombatEffect(target, 'REVIVE_BLOCK')) return;
        target.reviveUsed = true;
        target.hp = Math.max(1, Math.round(target.maxHp * effect.value));
        target.effects = (target.effects || []).filter((active) => active.category === 'buff');
        showCombatNumber(target, 'healing', target.hp);
        return;
    }
    if (code === 'DISPEL_BUFF') return removeCombatEffects(target, 'buff', Math.max(1, Math.round(effect.value)));
    if (code === 'CLEANSE_DEBUFF') return removeCombatEffects(target, 'debuff', Math.max(1, Math.round(effect.value)));
    if (code === 'TRANSFER_DEBUFF') {
        const transferable = source.effects?.findLast((active) => active.category === 'debuff' && !['STUN', 'SLEEP', 'PROVOKE', 'INJURY', 'EXTINCTION', 'REVIVE_BLOCK'].includes(active.code));
        if (transferable) {
            source.effects = source.effects.filter((active) => active !== transferable);
            addCombatEffect(target, source, { ...transferable, chance: 1 }, true);
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
        return;
    }
    if (code === 'LIFESTEAL' && directDamage > 0) return healCombatant(source, directDamage * effect.value);
    if (code === 'ADDITIONAL_DAMAGE' || code === 'EXTRA_ATTACK') {
        const coefficient = effect.value;
        return applyDirectDamage(source, target, combatStat(source, 'attack') * coefficient, false);
    }
    if (code === 'EXTRA_TURN') {
        if (!source.extraTurnUsed) {
            source.extraTurnUsed = true;
            source.extraTurnPending = true;
        }
        return;
    }
    if (code === 'EXTINCTION' && target.hp <= 0) {
        target.extinct = true;
        return;
    }
    if (code === 'DEFENSE_PENETRATION') {
        skill.penetration = Math.max(skill.penetration || 0, effect.value);
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
            const opponents = party.includes(source) ? state.enemies : party;
            const accuracyAdjustment = opponents.includes(target)
                ? (combatStat(source, 'effectHit') - combatStat(target, 'effectResist')) / 100
                : 0;
            const chance = Math.max(0, Math.min(1, normalized.chance + accuracyAdjustment));
            if (Math.random() < chance) rolled.push({ effect: normalized, target });
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
        if (effect.code === 'POISON') applyDirectDamage(effect.source || null, actor, actor.maxHp * effect.value, false);
        if (effect.code === 'BLEED') applyDirectDamage(effect.source || null, actor, effect.sourceAttack * effect.value, false);
        if (effect.code === 'CONTINUOUS_HEAL') healCombatant(actor, actor.maxHp * effect.value);
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
    const ownTeam = party.includes(actor) ? party : state.enemies;
    const opponentTeam = party.includes(actor) ? state.enemies : party;
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
            const dealt = applyDirectDamage(actor, target, damage, true, targets.length === 1);
            if (critical && dealt > 0) showCombatNumber(target, 'critical', dealt);
            damageByTarget.set(target, dealt);
            totalDamage += dealt;
        }
        if (ownTeam.includes(target) && target.hp > 0 && healingAmount > 0) totalHealing += healCombatant(target, healingAmount);
    }
    applySkillEffects(actor, skill, rolledEffects, damageByTarget, totalDamage, false, opponentTeam);
    return { damage: totalDamage, healing: totalHealing };
}

function combatResultText(result) {
    const parts = [];
    if (result.damage > 0) parts.push(`${result.damage} 피해`);
    if (result.healing > 0) parts.push(`생명력 ${result.healing} 회복`);
    return parts.join(', ') || '효과를 사용했습니다';
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
    if (Math.random() * 100 >= hitChance) return { damage: 0, critical: false, hit: false };
    const critChance = Math.max(0, Math.min(100, combatStat(attacker, 'critChance') - chanceFrom(targetEffects, 'CRITICAL_RESISTANCE_UP')));
    const critical = Math.random() * 100 < critChance;
    const critDamage = combatStat(attacker, 'critDamage') / 100;
    return { damage: Math.max(1, Math.round(critical ? rawDamage * critDamage : rawDamage)), critical, hit: true };
}

async function enemyTurn() {
    const enemyIndex = state.actingEnemy;
    const enemy = state.enemies[enemyIndex];
    if (!enemy || enemy.hp <= 0) return advanceCombatTurn();
    let extraAction = true;
    while (extraAction && enemy.hp > 0) {
        extraAction = false;
        enemy.effects = (enemy.effects || []).filter((effect) => effect.code !== 'PROVOKE' || party.some((hero) => hero.hp > 0 && hero.id === effect.sourceId));
        const availableSkills = enemy.skills.filter((skill) => (enemy.cooldowns?.[skill.id] || 0) <= 0);
        const taunt = enemy.effects.find((effect) => effect.code === 'PROVOKE' && effect.turnsRemaining > 0);
        const provokedIndex = taunt ? party.findIndex((hero) => hero.id === taunt.sourceId && hero.hp > 0) : -1;
        const attackSkills = availableSkills.filter((skill) => ['enemy', 'enemyAll'].includes(battleTargetFor(skill)) && skillHasDamage(skill));
        const basicAttack = enemy.skills.find((skill) => skill.isBasicAttack) || enemy.skills[0];
        const skillPool = provokedIndex >= 0 ? (attackSkills.length ? attackSkills : [basicAttack]) : availableSkills.length ? availableSkills : [basicAttack];
        const skill = skillPool[Math.floor(Math.random() * skillPool.length)];
        await wait(2000);
        const targetIndex = provokedIndex >= 0 ? provokedIndex : Math.floor(Math.random() * party.length);
        const skillTargets = combatTargets(enemy, skill, targetIndex);
        const result = executeCombatSkill(enemy, skill, skillTargets);
        state.enemyAttackLanded = true;
        addLog(`${enemy.name}의 ${skill.name}! ${combatResultText(result)}.`);
        announceSkill(skill.name);
        if (checkParty()) return;
        extraAction = enemy.extraTurnPending === true;
        enemy.extraTurnPending = false;
    }
    finishNaturalTurn(enemy);
    await wait(900);
    advanceCombatTurn();
}

function selectSkill(skillId) {
    if (state.mode !== 'combat' || state.enemyPhase) return;
    const hero = party[state.turn];
    const skill = battleSkillsFor(hero).find((item) => item.id === skillId);
    if (!skill || (hero.cooldowns?.[skill.id] || 0) > 0) return;
    const target = battleTargetFor(skill);
    if (target === 'enemy' || target === 'ally') {
        state.selectedSkill = skillId;
        render();
        return;
    }
    useAction(skillId);
}

function useAction(skillId, targetIndex = null) {
    if (state.mode !== 'combat' || state.enemyPhase) return;
    const hero = party[state.turn];
    if (!hero || hero.hp <= 0) return;
    const skill = battleSkillsFor(hero).find((item) => item.id === skillId);
    if (!skill || (hero.cooldowns?.[skill.id] || 0) > 0) return;
    const targetType = battleTargetFor(skill);
    const targets = combatTargets(hero, skill, targetIndex);
    if (['enemy', 'ally'].includes(targetType) && !targets.length) return;
    if (!targets.length) return;
    state.selectedSkill = null;
    const result = executeCombatSkill(hero, skill, targets);
    addLog(`${hero.name}의 ${skill.name}! ${combatResultText(result)}.`);
    announceSkill(skill.name);
    targets.filter((target) => target.hp <= 0).forEach((target) => addLog(`${target.name}이 쓰러졌습니다.`));
    if (hero.extraTurnPending) {
        hero.extraTurnPending = false;
        render();
        return;
    }
    finishNaturalTurn(hero);
    if (state.enemies.every((enemy) => enemy.hp <= 0)) return finishEncounter();
    advanceCombatTurn();
}

function combatantsBySpeed() {
    const combatants = [
        ...party.map((actor, index) => ({ actor, side: 'hero', index })),
        ...state.enemies.map((actor, index) => ({ actor, side: 'enemy', index })),
    ].filter(({ actor }) => actor.hp > 0);
    return combatants.sort((left, right) => combatStat(right.actor, 'speed') - combatStat(left.actor, 'speed'));
}

function advanceCombatTurn() {
    if (checkParty()) return;
    state.turnOrderIndex += 1;
    void activateNextCombatant();
}

function activateNextCombatant() {
    if (state.mode !== 'combat' || checkParty()) return;
    while (true) {
        if (state.enemies.every((enemy) => enemy.hp <= 0)) return finishEncounter();
        if (state.turnOrderIndex >= state.turnOrder.length) {
            state.turnOrder = combatantsBySpeed();
            state.turnOrderIndex = 0;
        }
        const current = state.turnOrder[state.turnOrderIndex];
        if (!current) return finishEncounter();
        if (current.actor.hp <= 0) {
            state.turnOrderIndex += 1;
            continue;
        }
        state.turn = current.side === 'hero' ? current.index : -1;
        state.enemyPhase = current.side === 'enemy';
        state.actingEnemy = current.side === 'enemy' ? current.index : -1;
        state.enemyAttackLanded = false;
        beginNaturalTurn(current.actor);
        if (current.actor.hp <= 0) {
            addLog(`${current.actor.name}이(가) 지속 효과로 쓰러졌습니다.`);
            finishNaturalTurn(current.actor);
            if (checkParty()) return;
            state.turnOrderIndex += 1;
            continue;
        }
        if (hasCombatEffect(current.actor, 'STUN') || hasCombatEffect(current.actor, 'SLEEP')) {
            const control = hasCombatEffect(current.actor, 'STUN') ? '기절' : '수면';
            addLog(`${current.actor.name}은(는) ${control} 상태로 행동하지 못했습니다.`);
            finishNaturalTurn(current.actor);
            state.turnOrderIndex += 1;
            continue;
        }
        render();
        if (current.side === 'enemy') void enemyTurn();
        return;
    }
}

function advance() {
    if (state.mode !== 'explore' || state.ended) return;
    if (state.room >= rooms.length - 1) return startEncounter(true);
    state.room += 1;
    const room = rooms[state.room];
    addLog(`${room.name}에 도착했습니다.`);
    if (room.type === '전투') return startEncounter();
    if (room.type === '보스') {
        state.message = '이 문 너머에서 오래된 숨소리가 들립니다.';
        render();
        return;
    }
    state.message = '낡은 돌바닥에 원정대의 발소리만 메아리칩니다.';
    render();
}

function restart() {
    clearTimeout(skillNoticeTimer);
    state.skillNotice = null;
    party.forEach((hero) => Object.assign(hero, { hp: hero.stats.maxHp, maxHp: hero.stats.maxHp, hitAt: 0, combatNumber: null }));
    Object.assign(state, { room: 0, gold: 175, mode: 'explore', turn: 0, enemies: [], turnOrder: [], turnOrderIndex: 0, enemyPhase: false, actingEnemy: -1, enemyAttackLanded: false, selectedSkill: null, message: '검은 회랑의 입구에 도착했습니다.', log: ['새 원정대가 검은 회랑의 입구에 도착했습니다.'], ended: false });
    render();
}

game.addEventListener('pointerover', (event) => {
    const button = event.target.closest('button');
    if (!button || button.disabled || event.relatedTarget && button.contains(event.relatedTarget)) return;
    playWebSound('hover');
});

game.addEventListener('click', (event) => {
    syncBackgroundMusic();
    if (event.target.closest('button:not(:disabled)')) playWebSound('click');
    const allyTarget = event.target.closest('[data-ally-target]');
    if (allyTarget && !allyTarget.disabled) {
        useAction(state.selectedSkill, Number(allyTarget.dataset.allyTarget));
        return;
    }
    const targetButton = event.target.closest('[data-target]');
    if (targetButton && !targetButton.disabled) {
        if (battleTargetFor(battleSkillsFor(party[state.turn]).find((skill) => skill.id === state.selectedSkill)) === 'enemy') useAction(state.selectedSkill, Number(targetButton.dataset.target));
        return;
    }
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'setup-name-confirm') {
        confirmPlayerName();
        return;
    }
    if (action === 'setup-select-zodiac') {
        state.playerZodiac = event.target.closest('[data-zodiac]').dataset.zodiac;
        state.playerSetupMessage = '';
        game.querySelectorAll('.zodiac-card').forEach((card) => {
            const selected = card.dataset.zodiac === state.playerZodiac;
            card.classList.toggle('selected', selected);
            card.setAttribute('aria-pressed', String(selected));
        });
        game.querySelector('[data-action="setup-zodiac-confirm"]').disabled = false;
        game.querySelector('.player-setup-message')?.remove();
        return;
    }
    if (action === 'setup-zodiac-confirm') {
        confirmPlayerZodiac();
        return;
    }
    if (action === 'lobby-new-game') {
        startNewGame();
        return;
    }
    if (action === 'lobby-continue') {
        state.lobbyDialog = 'load';
        render();
        return;
    }
    if (action === 'lobby-close-load') {
        state.lobbyDialog = '';
        render();
        return;
    }
    if (action === 'load-save') {
        continueGame(event.target.closest('[data-slot]').dataset.slot);
        return;
    }
    if (action === 'game-menu-open') {
        gameMenuOpen = true;
        gameMenuMode = 'menu';
        gameMenuNotice = '';
        render();
        return;
    }
    if (action === 'game-menu-close') {
        gameMenuOpen = false;
        gameMenuNotice = '';
        render();
        return;
    }
    if (action === 'game-menu-save') {
        gameMenuMode = 'save-slots';
        gameMenuNotice = '';
        render();
        return;
    }
    if (action === 'game-menu-back') {
        gameMenuMode = 'menu';
        render();
        return;
    }
    if (action === 'save-slot') {
        const slotId = event.target.closest('[data-slot]').dataset.slot;
        const saved = saveGame(slotId);
        gameMenuMode = 'menu';
        gameMenuOpen = true;
        gameMenuNotice = saved ? `${saveSlots.find((slot) => slot.id === slotId)?.label || '슬롯'}에 저장했습니다.` : '저장하지 못했습니다.';
        render();
        return;
    }
    if (action === 'lobby-open-settings') {
        state.lobbyDialog = 'settings';
        state.lobbyMessage = '';
        render();
        return;
    }
    if (action === 'lobby-close-settings') {
        state.lobbyDialog = '';
        render();
        return;
    }
    if (action === 'lobby-delete-save') {
        state.lobbyDialog = 'delete-save';
        render();
        return;
    }
    if (action === 'lobby-confirm-delete') {
        try {
            Object.values(saveSlotStorageKeys).forEach((key) => localStorage.removeItem(key));
            localStorage.removeItem(legacySaveStorageKey);
            state.lobbyMessage = '저장 데이터가 삭제되었습니다.';
        } catch (error) {
            state.lobbyMessage = '저장 데이터를 삭제하지 못했습니다.';
        }
        state.lobbyDialog = 'settings';
        render();
        return;
    }
    if (action === 'lobby-exit') {
        state.lobbyMessage = '브라우저 보안 정책상 자동으로 닫을 수 없습니다. 탭을 닫아 종료해 주세요.';
        render();
        return;
    }
    if (action === 'catalog') {
        state.catalogReturnView = state.view;
        gameMenuOpen = false;
        gameMenuNotice = '';
        state.view = 'characterCodex';
        state.catalogPage = 0;
        render();
        return;
    }
    if (action === 'developer-catalog') {
        state.catalogReturnView = 'characterCodex';
        state.catalogTab = 'characters';
        state.view = 'catalog';
        state.catalogPage = 0;
        render();
        return;
    }
    if (action === 'character-codex') {
        state.view = 'characterCodex';
        render();
        return;
    }
    if (action === 'view-expedition') {
        state.view = state.catalogReturnView || (party.length ? 'expedition' : 'plaza');
        render();
        return;
    }
    if (action === 'plaza-look-around') {
        encounterNextMercenary();
        return;
    }
    if (action === 'plaza-dialogue-advance') {
        advancePlazaDialogue(event.target.closest('[data-dialogue-next]')?.dataset.dialogueNext || '');
        return;
    }
    if (action === 'plaza-pass') {
        passCurrentMercenary();
        return;
    }
    if (action === 'plaza-gift') {
        giftCurrentMercenary();
        return;
    }
    if (action === 'plaza-guild') {
        inviteCurrentMercenaryToGuild();
        return;
    }
    if (action === 'plaza-hire') {
        hireMercenary(event.target.closest('[data-character-id]').dataset.characterId);
        return;
    }
    if (action === 'plaza-release') {
        releaseMercenary(event.target.closest('[data-character-id]').dataset.characterId);
        return;
    }
    if (action === 'plaza-rest') {
        requestPlazaRest();
        return;
    }
    if (action === 'plaza-dialog-confirm') {
        confirmPlazaDialog();
        return;
    }
    if (action === 'plaza-dialog-cancel') {
        cancelPlazaDialog();
        return;
    }
    if (action === 'plaza-depart') {
        requestExpedition();
        return;
    }
    if (event.target.closest('[data-catalog-tab]')) {
        state.catalogTab = event.target.closest('[data-catalog-tab]').dataset.catalogTab;
        state.catalogPage = 0;
        render();
        return;
    }
    const codexTab = event.target.closest('[data-codex-tab]');
    if (codexTab) {
        state.characterCodexTab = codexTab.dataset.codexTab;
        if (state.characterCodexTab === 'characters' && ['1', '2'].includes(state.catalogGrade)) state.catalogGrade = '';
        render();
        return;
    }
    const codexCharacter = event.target.closest('[data-codex-character]');
    if (codexCharacter) {
        if (suppressCodexCarouselClick) {
            suppressCodexCarouselClick = false;
            return;
        }
        state.catalogSelectedRosterId = codexCharacter.dataset.codexCharacter;
        render();
        return;
    }
    const sortHeader = event.target.closest('[data-catalog-sort]');
    if (sortHeader) {
        const key = sortHeader.dataset.catalogSort;
        if (state.catalogSort.key !== key || state.catalogSort.direction === 'initial') {
            state.catalogSort = { key, direction: 'descending' };
        } else if (state.catalogSort.direction === 'descending') {
            state.catalogSort = { key, direction: 'ascending' };
        } else {
            state.catalogSort = { key, direction: 'initial' };
        }
        state.catalogPage = 0;
        render();
        return;
    }
    if (action === 'catalog-prev' || action === 'catalog-next') {
        state.catalogPage += action === 'catalog-next' ? 1 : -1;
        render();
        return;
    }
    if (action === 'advance') advance();
    if (action === 'skill') selectSkill(event.target.closest('[data-skill]').dataset.skill);
    if (action === 'restart') restart();
    if (action === 'expedition-result-confirm') {
        confirmExpeditionResult();
        return;
    }
    if (action === 'retreat') {
        showExpeditionResult(false, false);
        return;
    }
});

game.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    const viewport = event.target.closest('.codex-roster-viewport');
    if (!viewport) return;
    const captureTarget = event.target.closest('[data-codex-character]') || viewport;
    codexCarouselDrag = {
        viewport,
        captureTarget,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startScrollLeft: viewport.scrollLeft,
        dragging: false,
    };
    captureTarget.setPointerCapture(event.pointerId);
});

game.addEventListener('pointermove', (event) => {
    if (!codexCarouselDrag || event.pointerId !== codexCarouselDrag.pointerId) return;
    const deltaX = event.clientX - codexCarouselDrag.startX;
    const deltaY = event.clientY - codexCarouselDrag.startY;
    if (!codexCarouselDrag.dragging && Math.abs(deltaX) > 6 && Math.abs(deltaX) > Math.abs(deltaY)) {
        codexCarouselDrag.dragging = true;
        codexCarouselDrag.viewport.classList.add('is-dragging');
        suppressCodexCarouselClick = true;
    }
    if (codexCarouselDrag.dragging) codexCarouselDrag.viewport.scrollLeft = codexCarouselDrag.startScrollLeft - deltaX;
});

function finishCodexCarouselDrag(event) {
    if (!codexCarouselDrag || event.pointerId !== codexCarouselDrag.pointerId) return;
    const { viewport, captureTarget, dragging } = codexCarouselDrag;
    viewport.classList.remove('is-dragging');
    if (captureTarget.hasPointerCapture(event.pointerId)) captureTarget.releasePointerCapture(event.pointerId);
    codexCarouselDrag = null;
    if (dragging) window.setTimeout(() => { suppressCodexCarouselClick = false; }, 0);
}

game.addEventListener('pointerup', finishCodexCarouselDrag);
game.addEventListener('pointercancel', finishCodexCarouselDrag);
game.addEventListener('dragstart', (event) => {
    if (event.target.closest('.codex-roster-viewport')) event.preventDefault();
});

game.addEventListener('input', (event) => {
    if (event.target.matches('[data-player-name]')) {
        state.playerDraftName = event.target.value;
        return;
    }
    if (event.target.matches('[data-volume-control]')) {
        const volumeType = event.target.dataset.volumeControl;
        const maxVolume = 1;
        const volume = Math.min(maxVolume, Math.max(0, Number(event.target.value)));
        const storageKey = volumeType === 'bgm' ? musicVolumeStorageKey : soundEffectsVolumeStorageKey;
        if (volumeType === 'bgm') backgroundMusic.volume = volume;
        else soundEffectsVolume = volume;
        try {
            localStorage.setItem(storageKey, String(volume));
        } catch (error) {
            console.warn('The audio volume could not be saved.', error);
        }
        const output = game.querySelector(`[data-volume-label="${volumeType}"]`);
        if (output) output.textContent = `${Math.round(volume * 100)}%`;
        return;
    }
    if (!event.target.matches('[data-catalog-search]')) return;
    state.catalogSearch = event.target.value;
    state.catalogPage = 0;
    render();
    const search = game.querySelector('[data-catalog-search]');
    search.focus();
    search.setSelectionRange(state.catalogSearch.length, state.catalogSearch.length);
});

game.addEventListener('change', (event) => {
    const filter = event.target.dataset.catalogFilter;
    if (!filter) return;
    if (filter === 'type') state.catalogType = event.target.value;
    if (filter === 'target') state.catalogTarget = event.target.value;
    if (filter === 'effect') state.catalogEffect = event.target.value;
    if (filter === 'zodiac') state.catalogZodiac = event.target.value;
    if (filter === 'job') state.catalogJob = event.target.value;
    if (filter === 'grade') state.catalogGrade = event.target.value;
    if (filter === 'element') state.catalogElement = event.target.value;
    if (filter === 'level') {
        state.catalogLevel = Number(event.target.value);
        const rosters = generateRosters(catalogData.growthRows, state.catalogLevel, catalogData.skills);
        catalogData.characters = rosters.characters;
        catalogData.monsters = rosters.monsters;
    }
    state.catalogPage = 0;
    render();
});

document.addEventListener('keydown', (event) => {
    const activeDialogue = state.view === 'plaza' ? getActivePlazaDialogue() : null;
    if (activeDialogue && ['monologue', 'oneOnOne', 'twoPerson'].includes(activeDialogue.dialogue.presentation) && !activeDialogue.node.choices?.length && (event.code === 'Space' || event.key === ' ') && !event.repeat) {
        const target = event.target;
        if (target instanceof HTMLElement && (target.matches('input, textarea, select, [contenteditable="true"]') || target.closest('button'))) return;
        event.preventDefault();
        advancePlazaDialogue();
        return;
    }
    if (state.view === 'playerSetup' && state.playerSetupStep === 'name' && event.key === 'Enter') {
        event.preventDefault();
        confirmPlayerName();
        return;
    }
    if (state.view !== 'expedition') return;
    if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('[data-ally-target]')) {
        event.preventDefault();
        useAction('recover', Number(event.target.dataset.allyTarget));
        return;
    }
    if (['1', '2', '3', '4'].includes(event.key)) {
        const skill = battleSkillsFor(party[state.turn])[Number(event.key) - 1];
        if (skill) selectSkill(skill.id);
    }
    if (event.key === 'Enter' && state.mode === 'explore') advance();
});

render();