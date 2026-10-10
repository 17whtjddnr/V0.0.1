import { configureCombatPower } from './combat-power.mjs';
import { createCombatEngine } from './combat-engine.mjs';
import { createBattleEffects } from './battle-effects.mjs';
import { createPopupPresentation } from './popup-presentation.mjs';
import { createGameViewport, logicalPoint, logicalRect } from './game-viewport.mjs';
import { createPressHover } from './press-hover.mjs';
import './game-viewport.css';
import './press-hover.css';
import './popup-presentation.css';
import { normalizedCombatEffect as normalizeCombatEffect, resolvedEffectTarget, battleTargetFor } from './combat-rules.mjs';
import { tutorialExpeditionDestination, startRegularExpeditionDestination, finishRegularExpeditionDestination, migrateRegularExpeditionDestination, regularExpeditionPreparation } from './regular-expedition.mjs';
import { guildRelationshipStages, guildRecruitmentRelationship, guildRecruitmentWage, canInviteGuildMember, recruitGuildMember, levelUpAtWeekStart } from './guild-recruitment.mjs';
import './guild-recruitment.css';
import { tutorialPrologue, tutorialDialogues, tutorialGuides, tutorialActionAllowed, completeTutorialRental, confirmTutorialMilestone, restoreTutorialState, TUTORIAL_COMPANION_ID, syncTutorialCompanion } from './tutorial.mjs';
import './tutorial.css';
import { dialoguePanelMarkup } from './dialogue-panel.mjs';
import { typeDialogueText } from './dialogue-typewriter.mjs';
import { resetTemporaryGuildRoster } from './guild-roster.mjs';
import { togglePlazaGuildMember, hasAvailablePlazaGuildMember } from './plaza-guild-party.mjs';
import { characterPortraitFiles, buildCharacterPortraitFileAssignments, characterPortraitAsset, characterThumbnailAsset, playerThumbnailAsset } from './character-assets.mjs';
import { guildPageMarkup, guildRooms } from './guild-page.mjs';
import { MAX_ACTIVE_GUILD_DISPATCHES, guildDispatchPower, activeGuildDispatch, guildDestinationDispatchActive, guildDispatchPlan, approveGuildDispatch, completeGuildDispatches, pendingGuildDispatchResults, acknowledgeGuildDispatchResults } from './guild-dispatch.mjs';
import { focusGuildMap, returnToGuildWorldMap } from './guild-map.mjs';
import { guildDestinations, configureDestinationMonsterPower, guildDestinationUnlocked, fitDestinationMonsterNames, guildDestinationMonsterIds } from './guild-destination.mjs';
import './guild-page.css';
import { guildLobbyMarkup } from './guild-lobby.mjs';
import './guild-lobby.css';
import './guild-research.css';
import { guildDispatchResultsMarkup } from './guild-dispatch-results.mjs';
import './guild-dispatch-results.css';
import { createLocationTransition } from './location-transition.mjs';
import { playLocationSound } from './location-sound.mjs';
import { createDeveloperCharacterSkillPicker } from './developer-character-skill-picker.mjs';
import { createDeveloperSkillEditor } from './developer-skill-editor.mjs';
import { statusEffectIcons } from './status-effect-icons.mjs';
import { readDefaultSkillRows, readCatalogTable } from './workbook-data.mjs';
import { createImageWarmup } from './image-warmup.mjs';
import { rebalanceSkill } from './skill-balance.js';
import { generateRosters as generateBaseRosters, applyRosterProfile, CHARACTER_COUNT } from './roster-generation.mjs';
import { configureDeveloperSkills, effectiveSkill, activeSkills, skillEnabled, saveSkillSettings, saveSkillEdit, derivedSkill } from './developer-skills.mjs';
import { createDeveloperImagePicker } from './developer-image-picker.mjs';
import { createScenePresentation } from './scene-presentation.mjs';
import { characterEnabled, developerCharacter, saveCharacterSettings, saveCharacterEdit, configureDeveloperCharacters, characterSkillIds, characterSkills } from './developer-characters.mjs';
import { monsterEnabled, developerMonster, saveMonsterSettings, saveMonsterEdit, configureDeveloperMonsters } from './developer-monsters.mjs';
import { initialAffinityFor, zodiacGlyphs, zodiacNames } from './zodiac-affinity.mjs';
import { zodiacIcons, jobIcons as jobGlyphs, elementIcons as elementGlyphs, statIcons, gradeIcon, goldIcon } from './reference-icons.mjs';
import plazaFirstVisitDialogue from '../data/dialogues/plaza-first-visit.json';
import plazaFirstEncounterDialogue from '../data/dialogues/plaza-first-encounter.json';
import plazaFirstConversationDialogue from '../data/dialogues/plaza-first-conversation.json';

import { MONSTER_COUNT, monsterDefinitions, monstersForStage } from './monster-catalog.mjs';

const game = document.querySelector('#game');
const warmImages = createImageWarmup();
game.addEventListener('keydown', (event) => {
    if (!['Enter', ' '].includes(event.key) || !event.target.closest('[data-action="guild-map-focus"], .guild-map-location-marker[data-action], [data-action="tutorial-rent"]')) return;
    event.preventDefault();
    event.stopPropagation();
    event.target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
});
const locationTransition = createLocationTransition(game, (duration) => playWebSound('travel', duration));

// Content remains on the original design canvas; only its background extends.
const DESIGN_WIDTH = 1920;
const DESIGN_HEIGHT = 1080;
const stageCanvas = document.querySelector('#stage-canvas');
const gameViewport = createGameViewport(game, stageCanvas);
createPressHover(game, {
    show(target, touch) {
        if (touch) playWebSound('hover');
        const status = target.closest('.combat-status');
        const skill = target.closest('.developer-skill-trigger');
        if (status) showCombatStatusTooltip(status);
        if (skill) showDeveloperSkillTooltip(skill);
        target.closest('.guild-map-location-marker.is-locked')?.classList.add('is-tooltip-visible');
        const titled = target.closest('[title]');
        if (!titled || status || skill || target.closest('.hero, .plaza-skill-tooltip-trigger, .guild-research-node, .guild-destination-subregion, .guild-map-location-marker') || target.closest('.combat-action')?.querySelector('.skill-tooltip')) return;
        const tip = document.createElement('div');
        tip.className = 'press-title-tooltip'; tip.setAttribute('role', 'tooltip');
        tip.textContent = titled.getAttribute('title'); game.append(tip);
        const rect = logicalRect(titled), canvas = logicalRect(game), scale = canvas.width / DESIGN_WIDTH;
        tip.style.left = `${Math.max(12, Math.min((rect.left - canvas.left) / scale, DESIGN_WIDTH - tip.offsetWidth - 12))}px`;
        const below = (rect.bottom - canvas.top) / scale + 8;
        tip.style.top = `${Math.max(12, below + tip.offsetHeight < DESIGN_HEIGHT ? below : (rect.top - canvas.top) / scale - tip.offsetHeight - 8)}px`;
    },
    hide(target, touch) {
        game.querySelector('.press-title-tooltip')?.remove();
        if (touch) {
            hideCombatStatusTooltip(); hideDeveloperSkillTooltip();
            target.closest('.guild-map-location-marker')?.classList.remove('is-tooltip-visible');
        }
    },
});

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

async function finishInitialLoading() {
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
let guildTestUnlock = false;

const defaultSkills = [
    { id: 'strike', name: '무기 공격', target: 'enemy', icon: '⚔', damageCoefficient: 0.85, cooldown: 0, description: '선택한 적에게 기본 피해를 줍니다.' },
    { id: 'power', name: '방패 강타', target: 'enemy', icon: '✦', damageCoefficient: 1.45, effects: [{ type: 'stun', chance: 30, turns: 1 }], cooldown: 2, description: '30% 확률로 적을 1턴간 기절시킵니다.' },
    { id: 'recover', name: '전열 정비', target: 'ally', icon: '✚', heal: { attackCoefficient: 1, maxHpCoefficient: 0.06 }, cooldown: 2, description: '선택한 아군을 회복합니다.' },
    { id: 'resolve', name: '정신 집중', target: 'self', icon: '◈', effects: [{ type: 'attackUp', chance: 100, turns: 1, value: 0.2 }], cooldown: 3, description: '1턴간 공격력을 높입니다.' },
];

function battleSkillsFor(actor) {
    if (actor?.id?.startsWith('CHAR-')) return characterSkills(actor, defaultSkills);
    return activeSkills(actor?.skills?.length ? actor.skills : defaultSkills);
}

function generateRosters(rows, level, skills) {
    return generateBaseRosters(rows, level, activeSkills(skills || []));
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
    prologueIndex: 0,
    tutorial: null,
    guildFounded: false,
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
    pendingLevelUp: null,
    guildRecruitmentDialog: null,
    week: 1,
    guildMembers: [],
    guildRosterResetVersion: 0,
    guildSecretaryId: null,
    guildDispatchMemberIds: [],
    guildDispatches: [],
    fame: 0,
    guildRoom: 'lobby',
    plazaGuildSelectionOpen: false,
    guildResearchOpen: false,
    guildExpeditionPreparation: false,
    guildExpeditionStep: 'destination',
    guildMapFocusedRegion: '',
    guildDestinationDetail: '',
    guildDestinationSubregion: '',
    guildSelectedDestination: null,
    regularSelectedDestination: null,
    regularMapFocusedRegion: '',
    regularDestinationDetail: '',
    regularDestinationSubregion: '',
    expeditionDestination: null,
    expeditionDestinationVersion: 0,
    guildClearedDestinations: [],
    guildLobbyBackground: 1,
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
    developerCatalogReturnView: 'plaza',
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
let retreatDialogOpen = false;
let gameMenuMode = 'menu';
let gameMenuNotice = '';
const backgroundMusicTracks = {
    lobby: 'Loby.web.mp3',
    playerSetup: 'Loby.web.mp3',
    plaza: 'Town.web.mp3',
    guild: 'Loby.web.mp3',
    catalog: 'Town.web.mp3',
    expedition: 'Dungeon.web.mp3',
};
let backgroundMusic = new Audio();
const bufferedMusic = new Map();
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
const backgroundMusicMasterVolume = 0.15;
let backgroundMusicVolume = readStoredVolume(musicVolumeStorageKey, 0.5);
backgroundMusic.volume = backgroundMusicVolume * backgroundMusicMasterVolume;
let soundEffectsVolume = readStoredVolume(soundEffectsVolumeStorageKey, 0.5);
backgroundMusic.preload = 'auto';

function tryPlayBackgroundMusic() {
    if (state.view === 'prologue' || !backgroundMusic.getAttribute('src')) return;
    if (!backgroundMusic.paused || backgroundMusic.volume === 0) return;
    backgroundMusic.play().catch((error) => {
        if (error.name !== 'NotAllowedError') console.warn('Background music playback failed.', error);
    });
}

backgroundMusic.addEventListener('canplay', tryPlayBackgroundMusic);
document.addEventListener('pointerdown', tryPlayBackgroundMusic, { capture: true, passive: true });
document.addEventListener('keydown', tryPlayBackgroundMusic, true);

function syncBackgroundMusic() {
    if (state.view === 'prologue') {
        backgroundMusic.pause();
        return;
    }
    const filename = backgroundMusicTracks[state.view] || backgroundMusicTracks.lobby;
    const source = `/assets/sound/Bgm/${filename}`;
    if (backgroundMusic.getAttribute('src') !== source) {
        backgroundMusic.pause();
        if (!bufferedMusic.has(source)) {
            const track = new Audio(source);
            track.loop = true;
            track.preload = 'auto';
            track.addEventListener('canplay', tryPlayBackgroundMusic);
            bufferedMusic.set(source, track);
        }
        backgroundMusic = bufferedMusic.get(source);
        backgroundMusic.volume = backgroundMusicVolume * backgroundMusicMasterVolume;
    }
    tryPlayBackgroundMusic();
}

let webSoundContext;
let typingSoundBuffer;
let combatEndTimer = null;
const battleEffects = createBattleEffects({
    isAlly: target => party.includes(target),
    isActive: () => state.view === 'expedition' && state.mode === 'combat',
    volume: () => soundEffectsVolume,
    audioContext: () => {
        webSoundContext ||= new (window.AudioContext || window.webkitAudioContext)();
        return webSoundContext;
    },
    findImage: target => {
        const heroIndex = party.indexOf(target);
        if (heroIndex >= 0) { const card = game.querySelectorAll('.party-panel .hero')[heroIndex]; return card?.querySelector('.hero-thumbnail img') || card?.querySelector('.hero-thumbnail'); }
        const enemyIndex = state.enemies.indexOf(target);
        const enemy = enemyIndex >= 0 ? game.querySelector(`.enemy[data-target="${enemyIndex}"]`) : null;
        return enemy?.querySelector('.enemy-art:not(.enemy-art-highlight)') || enemy?.querySelector('.enemy-mark');
    },
});

const popupPresentation = createPopupPresentation(game, {
    volume: () => soundEffectsVolume,
    audioContext: () => {
        webSoundContext ||= new (window.AudioContext || window.webkitAudioContext)();
        return webSoundContext;
    },
});

function showPopupNotice(message) {
    const backdrop = document.createElement('div');
    backdrop.className = 'end-overlay popup-notice-overlay';
    backdrop.innerHTML = `<section class="end-dialog" role="alertdialog" aria-modal="true" data-popup-kind="negative" aria-label="안내"><h2>안내</h2><p>${escapeHtml(message)}</p><button type="button">확인</button></section>`;
    const previousFocus = document.activeElement;
    const siblings = [...game.children].map(node => [node, node.inert]);
    siblings.forEach(([node]) => { node.inert = true; });
    game.append(backdrop);
    const close = () => {
        backdrop.remove();
        siblings.forEach(([node, inert]) => { if (node.isConnected) node.inert = inert; });
        if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
    const button = backdrop.querySelector('button');
    button.addEventListener('click', close);
    backdrop.addEventListener('keydown', event => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
        if (event.key === 'Tab') { event.preventDefault(); button.focus(); }
    });
    button.focus();
}

function playWebSound(kind, duration) {
    if (soundEffectsVolume === 0) return;
    if (kind === 'typing' && !navigator.userActivation?.hasBeenActive) return;
    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextConstructor) return;
    try {
        webSoundContext ||= new AudioContextConstructor();
        if (webSoundContext.state === 'suspended') void webSoundContext.resume();
        if (kind === 'typing') {
            // Do not queue typing sounds while browser audio is still locked.
            if (webSoundContext.state !== 'running') return;
            if (!typingSoundBuffer) {
                typingSoundBuffer = webSoundContext.createBuffer(1, Math.ceil(webSoundContext.sampleRate * .035), webSoundContext.sampleRate);
                const samples = typingSoundBuffer.getChannelData(0);
                for (let i = 0; i < samples.length; i++) samples[i] = (Math.random() * 2 - 1) * Math.exp(-i / samples.length * 6);
            }
            const source = webSoundContext.createBufferSource();
            const filter = webSoundContext.createBiquadFilter();
            const gain = webSoundContext.createGain();
            source.buffer = typingSoundBuffer;
            source.playbackRate.value = .9 + Math.random() * .2;
            filter.type = 'bandpass';
            filter.frequency.value = 1800 + Math.random() * 700;
            filter.Q.value = .7;
            gain.gain.value = .16 * soundEffectsVolume;
            source.connect(filter).connect(gain).connect(webSoundContext.destination);
            source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
            source.start();
            return;
        }
        if (kind === 'travel') {
            playLocationSound(webSoundContext, soundEffectsVolume, duration);
            return;
        }
        const profiles = {
            hover: { frequency: 720 + Math.random() * 90, endFrequency: 910, duration: 0.055, volume: 0.14, type: 'sine' },
            click: { frequency: 470 + Math.random() * 40, endFrequency: 310, duration: 0.075, volume: 0.24, type: 'triangle' },
            hit: { frequency: 115 + Math.random() * 65, endFrequency: 58, duration: 0.14, volume: 0.64, type: 'triangle' },
            appear: { frequency: 260, endFrequency: 620, duration: 0.28, volume: 0.16, type: 'sine' },
            step: { frequency: 95, endFrequency: 48, duration: 0.16, volume: 0.22, type: 'triangle' },
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
    const rows = [`<div class="tooltip-row"><span>스킬 대상</span><strong>${escapeHtml(targetLabels[skill.target] || skill.target)}</strong></div>`];
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
        rows.push(`<div class="tooltip-row"><span>효과</span><strong>${chanceText}${escapeHtml(effectText)}${magnitude ? ` ${magnitude}` : ''}${durationText} · 효과 대상: ${escapeHtml(describeEffectTarget(skill, effect))}</strong></div>`);
    });
    rows.push(`<div class="tooltip-row"><span>쿨타임</span><strong>${skill.cooldown ? `${skill.cooldown}턴` : '없음'}</strong></div>`);
    return `<div class="skill-tooltip"><div class="tooltip-title">${escapeHtml(skill.name)}</div>${rows.join('')}</div>`;
}

function characterTooltip(hero) {
    const rows = statLabels.map(([key, label]) => `<div class="character-stat-row"><span>${statLabelMarkup(key, label)}</span><b>${hero.baseStats?.[key] ?? hero.stats?.[key] ?? 0}</b><strong>${Math.round(combatStat(hero, key) * 100) / 100}</strong></div>`);
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
    try {
        const rows = await readDefaultSkillRows();
        const loaded = rows.map(workbookSkill).filter((skill) => skill.id && skill.name);
        if (loaded.length === defaultSkills.length) {
            updateLoadingProgress(20);
            return loaded;
        }
    } catch (error) {
        console.warn('Default skills could not be loaded.', error);
    }
    console.warn('No valid skill workbook could be loaded; using built-in defaults.');
    updateLoadingProgress(20);
    return defaultSkills;
}

const skills = await loadSkills();

let catalogWorkbookLoadsComplete = 0;
const catalogWorkbookLoadTotal = 5;

async function readWorkbookTable(filename, sheetName, headerIndex) {
    const rows = await readCatalogTable(filename, sheetName, headerIndex);
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
                unit: rule['값 단위'] || '',
                baseValue: Number(rule['기본값']) || 1,
                baseDuration: Number(rule['지속 턴']) || 0,
                baseCost: Number(rule['기준 비용']) || 0,
                effectTarget: rule['실제 적용 대상'] || '대상',
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
        if (skills.length !== 2000 || basicAttackCount !== 100 || Object.entries(expectedSkillCategories).some(([category, count]) => categoryCounts[category] !== count) || effects.length !== 55 || stats.length !== 72 || characters.length !== CHARACTER_COUNT || monsters.length !== MONSTER_COUNT) {
            throw new Error(`Unexpected workbook totals: ${skills.length} skills, ${effects.length} effects, ${stats.length} stat profiles, ${characters.length} characters, ${monsters.length} monsters`);
        }
        return { skills, effects, stats, characters, monsters, growthRows };
    } catch (error) {
        console.warn('The content catalog workbooks could not be loaded.', error);
        return { skills: [], effects: [], stats: [], characters: [], monsters: [], growthRows: [] };
    }
}

const catalogData = await loadCatalogData();
configureDeveloperSkills(catalogData.skills, skillTooltips);
configureDeveloperCharacters(catalogData.growthRows, catalogData.skills);
configureDeveloperMonsters(catalogData.growthRows, catalogData.skills);
configureCombatPower({ resolveProfile(actor) {
    if (actor.id?.startsWith('CHAR-')) {
        const profile = developerCharacter(actor);
        return { ...profile, skills: characterSkills(profile, defaultSkills) };
    }
    return actor.id?.startsWith('MON-') ? developerMonster(actor) : actor;
} });
let powerRosterCache = null;
function powerRosters() {
    const key = JSON.stringify([state.userLevel, ...['game-developer-skills-v1', 'game-developer-characters-v1', 'game-developer-monsters-v1'].map((storageKey) => localStorage.getItem(storageKey))]);
    if (powerRosterCache?.key !== key) {
        const roster = generateRosters(catalogData.growthRows, state.userLevel, catalogData.skills);
        powerRosterCache = { key,
            monsters: roster.monsters.filter((actor) => monsterEnabled(actor.id)).map(developerMonster),
            characters: roster.characters.filter((actor) => characterEnabled(actor.id)).map(developerCharacter),
        };
    }
    return powerRosterCache;
}
configureDestinationMonsterPower(() => powerRosters().monsters, () => powerRosters().characters);
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
    const location = savedState.view === 'expedition' ? '던전' : savedState.view === 'guild' ? '아지트' : '광장';
    const savedAt = Number(saved.savedAt);
    const time = savedAt ? new Date(savedAt).toLocaleString('ko-KR') : '저장 기록';
    return `${Number(savedState.week) || 1}주차 · ${location} · ${Number(savedState.gold) || 0}G · 용병 ${savedState.recruits.length}명 · ${time}`;
}

function saveSlotMarkup(slot, action) {
    const saved = readSavedGame(slot.id);
    const disabled = action === 'load-save' && !saved;
    const status = saved ? savedGameSummary(saved) : '비어 있음';
    return `<button class="save-slot ${saved ? 'has-save' : 'empty-save'}" type="button" data-action="${action}" data-slot="${slot.id}" ${disabled ? 'disabled' : ''}><span class="save-slot-copy"><strong>${slot.label}</strong><small>${goldTextMarkup(status)}</small></span><span class="save-slot-state">${saved ? action === 'load-save' ? '불러오기' : '덮어쓰기' : '빈 슬롯'}</span></button>`;
}

function retreatDialogMarkup() {
    return '<div class="game-menu-backdrop retreat-dialog-backdrop"><section class="game-menu-popup retreat-dialog" role="alertdialog" aria-modal="true" aria-labelledby="retreat-dialog-title" aria-describedby="retreat-dialog-warning"><h2 id="retreat-dialog-title">원정 포기</h2><p id="retreat-dialog-warning">원정을 포기하면 이번 원정에서 얻은 골드와 경험치를 포함한 보상을 얻을 수 없습니다.</p><div class="retreat-dialog-actions"><button type="button" data-action="retreat-cancel">취소</button><button type="button" class="retreat-confirm" data-action="retreat-confirm">원정 포기</button></div></section></div>';
}

function gameMenuMarkup() {
    if (retreatDialogOpen && state.view === 'expedition' && !state.ended) return retreatDialogMarkup();
    if (!gameMenuOpen) return '';
    const content = gameMenuMode === 'save-slots'
        ? `<p class="game-menu-description">저장할 슬롯을 선택하세요.</p><div class="save-slot-list">${saveSlots.filter((slot) => slot.id !== 'autosave').map((slot) => saveSlotMarkup(slot, 'save-slot')).join('')}</div><button class="game-menu-back" type="button" data-action="game-menu-back">메뉴로 돌아가기</button>`
        : `${state.view === 'characterCodex' ? `<button class="game-menu-back" type="button" data-action="view-expedition">돌아가기</button><label class="codex-menu-level">도감 레벨<select data-catalog-filter="level">${[1, 2, 3, 4, 5].map((value) => `<option value="${value}" ${state.catalogLevel === value ? 'selected' : ''}>Lv.${value}</option>`).join('')}</select></label>` : '<button class="game-menu-catalog" type="button" data-action="catalog">도감</button>'}${import.meta.env.DEV ? '<button class="game-menu-catalog" type="button" data-action="developer-catalog">개발자 자료실</button>' : ''}${state.view === 'expedition' ? '<button class="game-menu-back" type="button" data-action="retreat">원정 포기</button>' : ''}<button class="game-menu-save" type="button" data-action="game-menu-save">저장하기 <span>슬롯 선택</span></button><label class="volume-control"><span>BGM 음량 <output data-volume-label="bgm">${Math.round(backgroundMusicVolume * 100)}%</output></span><input type="range" min="0" max="1" step="0.01" value="${backgroundMusicVolume}" data-volume-control="bgm" aria-label="BGM 음량"></label><label class="volume-control"><span>효과음 음량 <output data-volume-label="sfx">${Math.round(soundEffectsVolume * 100)}%</output></span><input type="range" min="0" max="1" step="0.01" value="${soundEffectsVolume}" data-volume-control="sfx" aria-label="효과음 음량"></label>`;
    return `<div class="game-menu-backdrop"><section class="game-menu-popup" role="dialog" aria-modal="true" aria-labelledby="game-menu-title"><header class="game-menu-heading"><h2 id="game-menu-title">메뉴</h2><button type="button" data-action="game-menu-close" aria-label="메뉴 닫기">×</button></header>${content}${gameMenuNotice ? `<p class="game-menu-notice" role="status">${escapeHtml(gameMenuNotice)}</p>` : ''}</section></div>`;
}

function expeditionResultMarkup(result) {
    const affinityRows = result.memberAffinities.map((member) => {
        const character = party.find((hero) => hero.id === member.id)
            || catalogData.characters.find((entry) => entry.id === member.id)
            || { ...member, mark: jobGlyphs[member.job] || '✦' };
        return `<article class="expedition-affinity-row"><div class="expedition-affinity-heading"><span class="expedition-member-label">${characterThumbnailMarkup(character, 'expedition-member-thumbnail')}<span class="expedition-member-name">${escapeHtml(member.name)} <small>${escapeHtml(member.job)}</small></span></span><strong class="${member.change > 0 ? 'affinity-up' : member.change < 0 ? 'affinity-down' : ''}">${member.change > 0 ? '+' : ''}${member.change}</strong></div><div class="expedition-affinity-track"><span class="expedition-animated-bar" data-bar-start="${member.before}" data-bar-end="${member.after}" style="width:${member.before}%"></span></div><small class="expedition-affinity-value"><span class="expedition-animated-count" data-count-start="${member.before}" data-count-end="${member.after}">${member.before}</span> / 100</small></article>`;
    }).join('');
    return `<div class="end-overlay expedition-result-overlay"><section class="end-dialog expedition-result-dialog" data-popup-kind="${result.completed ? 'positive' : 'negative'}" role="dialog" aria-modal="true" aria-labelledby="expedition-result-title"><span class="section-kicker">원정 결과</span><h2 id="expedition-result-title">${result.completed ? '원정 성공' : '원정 실패'}</h2><p>${goldTextMarkup(state.message)}</p><div class="expedition-result-rewards"><article class="expedition-reward-item"><div><span>획득 경험치</span><strong><span class="expedition-animated-count" data-count-start="0" data-count-end="${result.rewardExperience}">0</span> EXP</strong></div><div class="expedition-reward-track"><span class="expedition-animated-bar" data-bar-start="${result.experienceBefore}" data-bar-end="${result.experienceAfter}" style="width:${result.experienceBefore}%"></span></div></article><article class="expedition-reward-item expedition-gold-reward"><div><span>획득 골드</span><strong class="gold-amount"><span class="gold-icon" style="--gold-icon-url:url('${goldIcon}')" aria-hidden="true"></span><span class="expedition-animated-count" data-count-start="0" data-count-end="${result.rewardGold}">0</span> G</strong></div></article></div><section class="expedition-affinity-list"><h3>원정대원 호감도</h3>${affinityRows}</section><button class="expedition-result-confirm" type="button" data-action="expedition-result-confirm" disabled>광장으로 복귀하기</button></section></div>`;
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
    Object.assign(state, JSON.parse(JSON.stringify(initialState)), saved.state, {
        view: 'plaza',
        catalogReturnView: 'plaza',
        developerCatalogReturnView: 'plaza',
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
    if (restoreTutorialState(state, saved.state) && state.tutorial.stage === 'battle' && !state.expeditionResult) {
        void activateNextCombatant();
        return;
    }
    render();
}

// Stable positions keep dust from jumping when a lobby dialog opens.
const lobbyDustMarkup = Array.from({ length: 240 }, (_, index) => {
    const height = 10 + ((index * 37) % 76);
    const angle = [177, 198, 219][index % 3];
    const left = 70 - (height + 4) * (1080 / 1920) * Math.tan((angle - 180) * Math.PI / 180);
    const direction = index % 2 ? 1 : -1;
    const duration = 14 + ((index * 7) % 13);
    return `<span class="lobby-dust-particle" style="--dust-x:${left.toFixed(2)}%;--dust-y:${height}%;--dust-size:${(1.2 + (index % 5) * .4).toFixed(1)}px;--dust-dx:${direction * (55 + (index * 13) % 65)}px;--dust-dy:${-18 - (index * 11) % 38}px;--dust-duration:${duration}s;--dust-delay:${-((index * 5.73) % duration).toFixed(2)}s"></span>`;
}).join('');

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
    game.innerHTML = `<section class="title-screen"><div class="lobby-light-effects" aria-hidden="true"><div class="lobby-light-rays"></div><div class="lobby-light-bloom"></div><div class="lobby-lens-flares"><span class="lobby-lens-flare lobby-lens-flare-top"></span><span class="lobby-lens-flare lobby-lens-flare-bottom"></span></div><div class="lobby-light-dust">${lobbyDustMarkup}</div></div><div class="lobby-brand"><span class="lobby-seal" aria-hidden="true"><span class="guild-emblem-icon"></span></span><p class="lobby-kicker">GUILD RECORD · CHAPTER 01</p><h1>HELLO<br><span>GUILD MASTER</span></h1><p class="lobby-tagline">던전 너머의 사랑, 명예, 부 그리고 이야기</p><nav class="lobby-menu" aria-label="메인 메뉴"><button class="lobby-menu-item lobby-menu-primary" type="button" data-action="lobby-new-game"><span class="lobby-menu-label">새 게임</span><span class="lobby-menu-arrow" aria-hidden="true">↗</span></button>${savedGame ? '<button class="lobby-menu-item" type="button" data-action="lobby-continue"><span class="lobby-menu-label">이어하기</span><span class="lobby-menu-arrow" aria-hidden="true">→</span></button>' : ''}<button class="lobby-menu-item" type="button" data-action="lobby-open-settings"><span class="lobby-menu-label">설정</span><span class="lobby-menu-arrow" aria-hidden="true">⚙</span></button><button class="lobby-menu-item lobby-menu-exit" type="button" data-action="lobby-exit"><span class="lobby-menu-label">종료</span><span class="lobby-menu-arrow" aria-hidden="true">×</span></button>${state.lobbyMessage ? `<p class="lobby-feedback" role="status">${escapeHtml(state.lobbyMessage)}</p>` : ''}</nav></div></section>${dialog}`;
}

function renderPlayerSetup() {
    const nameStep = state.playerSetupStep === 'name';
    const zodiacCards = zodiacNames.map((zodiac) => `<button class="zodiac-card ${state.playerZodiac === zodiac ? 'selected' : ''}" type="button" data-action="setup-select-zodiac" data-zodiac="${zodiac}" aria-pressed="${state.playerZodiac === zodiac}"><span class="zodiac-card-glyph" aria-hidden="true">${catalogIconMarkup(zodiacIcons[zodiac], '', '', 'zodiac-choice-icon')}</span><span class="zodiac-card-name">${zodiac}</span></button>`).join('');
    game.innerHTML = `<main class="player-setup-screen"><div class="player-setup-panel"><span class="player-setup-emblem" aria-hidden="true">✠</span><p class="player-setup-step">PLAYER RECORD · ${nameStep ? '01 / 02' : '02 / 02'}</p><h1>${nameStep ? '길드 마스터를 꿈꾸는 모험가여, 당신의 이름은?' : '당신의 별자리는?'}</h1>${nameStep ? `<label class="player-name-field"><span>모험가 이름</span><input type="text" data-player-name maxlength="16" autocomplete="nickname" value="${escapeHtml(state.playerDraftName)}" placeholder="이름 입력" aria-label="모험가 이름"></label>${state.playerSetupMessage ? `<p class="player-setup-message" role="alert">${escapeHtml(state.playerSetupMessage)}</p>` : ''}<button class="player-setup-confirm" type="button" data-action="setup-name-confirm">결정</button>` : `<p class="player-setup-description">선택한 별자리에 따라 원정대원과의 초기 호감도가 정해집니다.</p><div class="zodiac-card-grid">${zodiacCards}</div>${state.playerSetupMessage ? `<p class="player-setup-message" role="alert">${escapeHtml(state.playerSetupMessage)}</p>` : ''}<button class="player-setup-confirm" type="button" data-action="setup-zodiac-confirm" ${state.playerZodiac ? '' : 'disabled'}>결정</button>`}</div></main>`;
    if (nameStep) requestAnimationFrame(() => game.querySelector('[data-player-name]')?.focus());
}

function plazaOfferWithCurrentProfile(offer) {
    const updated = developerCharacter(offer);
    return { ...updated, price: hirePrices[updated.grade] ?? 30, weeklyWage: hirePrices[updated.grade] ?? 30 };
}

function drawPlazaOffers() {
    try {
        const candidates = generateRosters(catalogData.growthRows, state.userLevel, catalogData.skills).characters.filter((entry) => characterEnabled(entry.id) && !(state.guildMembers || []).some(member => member.id === entry.id)).map(developerCharacter);
        const pool = [...candidates];
        const offers = [];
        while (offers.length < 3 && pool.length) {
            const candidate = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
            offers.push({ ...candidate, price: hirePrices[candidate.grade] ?? 30, weeklyWage: hirePrices[candidate.grade] ?? 30 });
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
    ...Object.fromEntries(tutorialDialogues.map(dialogue => [dialogue.id, dialogue])),
    [plazaFirstVisitDialogue.id]: plazaFirstVisitDialogue,
    [plazaFirstEncounterDialogue.id]: plazaFirstEncounterDialogue,
    [plazaFirstConversationDialogue.id]: plazaFirstConversationDialogue,
};
let plazaTransitionPhase = '';
let plazaDialogueExitPending = false;
let stopDialogueTypewriter = () => {};
function playDialogueTypingSound(character, index) {
    if (index % 2 === 0 && /\S/u.test(character)) playWebSound('typing');
}

function getActivePlazaDialogue() {
    const progress = state.activePlazaDialogue;
    const dialogue = plazaDialogues[progress?.id];
    if (dialogue && [dialogue.characterId, ...(dialogue.participants || [])].filter(Boolean).some((id) => !characterEnabled(id))) {
        state.activePlazaDialogue = null;
        return null;
    }
    const node = dialogue?.nodes?.[progress?.nodeId];
    return dialogue && node ? { dialogue: { ...dialogue, presentation: node.presentation || dialogue.presentation }, node, bubbleSide: progress.bubbleSide } : null;
}

function startPlazaDialogue(dialogueId) {
    const dialogue = plazaDialogues[dialogueId];
    if (!dialogue?.nodes?.[dialogue.start]) return false;
    if ([dialogue.characterId, ...(dialogue.participants || [])].filter(Boolean).some((id) => !characterEnabled(id))) return false;
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
        if (finishTutorialStory()) { render(); return; }
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
    state.tutorial = { stage: 'meeting' };
    state.guildRosterResetVersion = 1;
    state.plazaOffers = [];
    startPlazaDialogue('tutorial.meeting');
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
const characterPortraitFileAssignments = buildCharacterPortraitFileAssignments(catalogData.characters);
const characterPortraitAssets = Object.fromEntries(Object.entries(characterPortraitFileAssignments).map(([id, file]) => [id, characterPortraitAsset(file)]));
const characterThumbnailAssets = Object.fromEntries(Object.entries(characterPortraitFileAssignments).map(([id, file]) => [id, characterThumbnailAsset(file)]));
function characterImageSource(character, thumbnail = false) {
    if (!character) return '';
    if (character.id?.startsWith('MON-EXP-')) {
        const entry = developerMonster(character);
        return thumbnail ? entry.thumbnailSrc : entry.portraitSrc;
    }
    const entry = developerCharacter(character);
    if (thumbnail) return entry.thumbnailSrc || characterThumbnailAssets[entry.id];
    const portrait = entry.portraitSrc || characterPortraitAssets[entry.id];
    return portrait?.startsWith('/assets/art/2D/Character/')
        ? characterPortraitAsset(portrait.split('/').pop().split('?')[0]) : portrait;
}
const plazaJobOrder = ['기사', '전사', '마도사', '사수', '정령사', '도적'];

function playerZodiacIconMarkup() {
    const icon = zodiacIcons[state.playerZodiac];
    return icon ? `<span class="player-zodiac-mark" title="${escapeHtml(state.playerZodiac)}" aria-label="${escapeHtml(state.playerZodiac)}">${catalogIconMarkup(icon, '', state.playerZodiac, 'player-zodiac-icon')}</span>` : '';
}

function plazaJobCountsMarkup() {
    const counts = new Map(plazaJobOrder.map((job) => [job, 0]));
    state.plazaOffers.forEach((offer) => {
        if (counts.has(offer.job)) counts.set(offer.job, counts.get(offer.job) + 1);
    });
    return plazaJobOrder.map((job, index) => `<span class="plaza-job-count">${catalogIconMarkup(jobGlyphs[job], '', '', 'plaza-job-count-icon')}${escapeHtml(job)} <strong class="plaza-job-count-number">${counts.get(job)}</strong>명</span>${index < plazaJobOrder.length - 1 ? '<span class="plaza-job-comma">, </span>' : ''}`).join('');
}

function catalogIconMarkup(symbol, tint, label, className = 'catalog-icon', title = '', inlineStyle = '') {
    if (className === 'plaza-action-icon') return plazaActionIconMarkup(symbol, tint);
    if (symbol?.startsWith('/assets/')) return `<img class="${className}" src="${escapeHtml(symbol)}" alt="${escapeHtml(label)}"${title ? ` title="${escapeHtml(title)}"` : ''}${inlineStyle ? ` style="${escapeHtml(inlineStyle)}"` : ''}>`;
    const unframedIcons = ['catalog-icon', 'combat-skill-icon', 'roster-skill-icon', 'roster-job-icon', 'hero-job-icon', 'plaza-hired-icon', 'plaza-encounter-job-icon', 'plaza-skill-icon', 'plaza-affinity-icon'];
    const background = className === 'codex-character-thumb' || unframedIcons.includes(className) ? '' : `<rect x="1" y="1" width="38" height="38" rx="8" fill="#211e19" stroke="${tint}" stroke-opacity=".7"/>`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">${background}<text x="20" y="27" text-anchor="middle" font-family="serif" font-size="23" fill="${tint}">${symbol}</text></svg>`;
    return `<img class="${className}" src="data:image/svg+xml,${encodeURIComponent(svg)}" alt="${escapeHtml(label)}"${title ? ` title="${escapeHtml(title)}"` : ''}${inlineStyle ? ` style="${escapeHtml(inlineStyle)}"` : ''}>`;
}

function statLabelMarkup(key, label) {
    return `<img class="stat-label-icon" src="${statIcons[key]}" alt="" aria-hidden="true">${escapeHtml(label)}`;
}

function goldAmountMarkup(amount, unit = '골드') {
    return `<span class="gold-amount"><span class="gold-icon" style="--gold-icon-url:url('${goldIcon}')" aria-hidden="true"></span>${escapeHtml(amount)} ${escapeHtml(unit)}</span>`;
}

function fameAmountMarkup(amount = 0) {
    const value = Math.max(0, Number(amount) || 0).toLocaleString('ko-KR');
    return `<span class="fame-amount"><span class="gold-icon" style="--gold-icon-url:url('/assets/icons/fame_icon.svg')" aria-hidden="true"></span>${value} 명성</span>`;
}

function goldTextMarkup(text) {
    return escapeHtml(text).replace(/(\d[\d,.]*)\s*(골드|G)(?![A-Za-z])/g, (_, amount, unit) => goldAmountMarkup(amount, unit)).replace(/골드\s+(\d[\d,.]*)/g, (_, amount) => goldAmountMarkup(amount));
}

function plazaActionIconMarkup(symbol, tint) {
    if (symbol?.startsWith('/assets/icons/')) return `<img class="plaza-action-icon" src="${escapeHtml(symbol)}" alt="" aria-hidden="true">`;
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

function skillIconMarkup(source, className, title = '') {
    const skill = effectiveSkill(source);
    if (skill.thumbnailSrc) return `<img class="${className}" src="${escapeHtml(skill.thumbnailSrc)}" alt="${escapeHtml(skill.name)}" title="${escapeHtml(title)}">`;
    const [glyph, tint] = skillGlyph(skill);
    return catalogIconMarkup(glyph, tint, skill.name, className, title);
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
    return `<tr><td>${skillIconMarkup(skill, 'catalog-icon', `${skill.name}\n${skill.tooltipKo}`)}</td><td><strong>${escapeHtml(skill.name)}</strong><small>${escapeHtml(skill.category)}${skill.isBasicAttack ? ' · 기본 공격' : ''}</small></td><td>${escapeHtml(skill.target)}</td><td><div class="catalog-values">${skill.damage.map((value) => `<span>${escapeHtml(value)}</span>`).join('')}${skill.healing.map((value) => `<span>${escapeHtml(value)}</span>`).join('')}${skill.effects.map((effect) => `<span>${escapeHtml(effect.name)} ${escapeHtml(Number(effect.value.toFixed(3)))} · ${Math.round(effect.chance * 100)}% · ${escapeHtml(effect.duration)}턴</span>`).join('')}</div><small class="skill-balanced-tooltip" title="${escapeHtml(skill.tooltipEn)}">${escapeHtml(skill.tooltipKo)}</small></td><td>${skill.cooldown}턴</td><td class="catalog-score"><strong>${(skill.scoreAfter * 100).toFixed(1)}%</strong>${skill.balanceReached ? '' : '<small>목표 범위 밖</small>'}</td>${import.meta.env.DEV ? `<td class="developer-skill-actions"><button type="button" data-skill-edit="${escapeHtml(skill.id)}">편집</button><label><input type="checkbox" data-skill-enabled="${escapeHtml(skill.id)}" ${skillEnabled(skill.id) ? 'checked' : ''} aria-label="${escapeHtml(skill.name)} 활성화">활성화</label></td>` : ''}</tr>`;
}

function effectCatalogRowMarkup(effect) {
    const [glyph, tint] = effectGlyph(effect);
    const icon = statusEffectIcons[effect.code]
        ? `<img class="catalog-icon status-effect-catalog-icon" src="${statusEffectIcons[effect.code]}" alt="${escapeHtml(effect.name)}" title="${escapeHtml(effect.description)}">`
        : catalogIconMarkup(glyph, tint, effect.name, 'catalog-icon', effect.description);
    return `<tr><td>${icon}</td><td><strong>${escapeHtml(effect.name)}</strong><small>${escapeHtml(effect.englishName)}</small></td><td>${escapeHtml(effect.unit)}</td><td><small>${escapeHtml(effect.description)}</small></td></tr>`;
}

function statCatalogRowMarkup(profile) {
    return `<tr><td>${catalogIconMarkup(zodiacIcons[profile.zodiac] || '✧', '#c2a767', profile.zodiac, 'catalog-icon', profile.notes)}</td><td>${escapeHtml(profile.zodiac)}</td><td>${escapeHtml(profile.job)}</td><td>${profile.attack}</td><td>${profile.hp}</td><td>${profile.defense}</td><td>${profile.speed}</td><td>${profile.critChance}</td><td>${profile.critDamage}</td><td>${profile.effectHit}</td><td>${profile.effectResist}</td></tr>`;
}

function rosterRowMarkup(entry) {
    entry = { ...entry, skills: activeSkills(entry.skills) };
    const editable = import.meta.env.DEV;
    const editKind = state.catalogTab === 'monsters' ? 'monster' : 'character';
    const enabled = editKind === 'monster' ? monsterEnabled : characterEnabled;
    const stats = rosterStatColumns.map(([key]) => key);
    const skills = entry.skills.map((skill) => {
        const [glyph, tint] = skillGlyph(skill);
        return `<button type="button" class="developer-skill-trigger" data-developer-character="${escapeHtml(entry.id)}" data-developer-skill="${escapeHtml(skill.id)}" aria-label="${escapeHtml(skill.name)}">${skillIconMarkup(skill, 'roster-skill-icon')}</button>`;
    }).join('');
    const jobIcon = catalogIconMarkup(jobGlyphs[entry.job] || '✦', '#c2a767', entry.job, 'roster-job-icon', entry.job);
    return `<tr><td class="roster-avatar-cell"><span class="roster-avatar-frame element-border-${elementBorderClasses[entry.element] || 'light'}">${characterThumbnailMarkup(entry, 'roster-avatar')}</span></td><td class="roster-name-cell"><strong class="roster-name">${escapeHtml(entry.name)}</strong>${jobIcon}</td><td><span class="roster-grade grade-${entry.grade}">${entry.grade}등급</span></td><td class="roster-skills">${skills}</td>${stats.map((stat) => `<td>${entry.stats[stat]}</td>`).join('')}${editable ? `<td class="developer-character-actions"><button type="button" data-${editKind}-edit="${escapeHtml(entry.id)}">편집</button><label><input type="checkbox" data-${editKind}-enabled="${escapeHtml(entry.id)}" ${enabled(entry.id) ? 'checked' : ''} aria-label="${escapeHtml(entry.name)} 활성화">활성화</label></td>` : ''}</tr>`;
}

function rosterStatHeadersMarkup() {
    return rosterStatColumns.map(([key, label]) => {
        const direction = state.catalogSort.key === key ? state.catalogSort.direction : 'initial';
        const indicator = direction === 'descending' ? '↓' : direction === 'ascending' ? '↑' : '↕';
        return `<th aria-sort="${direction === 'initial' ? 'none' : direction}"><button class="roster-sort ${direction !== 'initial' ? 'active' : ''}" data-catalog-sort="${key}" type="button">${statLabelMarkup(key, label)}<span aria-hidden="true">${indicator}</span></button></th>`;
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
        rows = catalogData.skills.map(effectiveSkill).filter((skill) => {
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
        content = `<div class="catalog-table-wrap"><table class="catalog-table skill-table"><thead><tr><th>아이콘</th><th>스킬</th><th>대상</th><th>수치와 효과</th><th>쿨타임</th><th>균형 점수</th>${import.meta.env.DEV ? '<th>편집 / 활성화</th>' : ''}</tr></thead><tbody>${pageRows.map(skillCatalogRowMarkup).join('')}</tbody></table></div><div class="catalog-pagination"><span>${total ? `${state.catalogPage * catalogPageSize + 1}–${Math.min((state.catalogPage + 1) * catalogPageSize, total)} / ${total}` : '검색 결과 없음'}</span><div><button data-action="catalog-prev" ${state.catalogPage === 0 ? 'disabled' : ''} aria-label="이전 페이지">←</button><button data-action="catalog-next" ${state.catalogPage >= pageCount - 1 ? 'disabled' : ''} aria-label="다음 페이지">→</button></div></div>`;
    } else if (state.catalogTab === 'effects') {
        rows = catalogData.effects.filter((effect) => !query || [effect.code, effect.name, effect.englishName, effect.description, effect.unit].join(' ').toLocaleLowerCase().includes(query));
        total = rows.length;
        content = `<div class="catalog-table-wrap"><table class="catalog-table effect-table"><thead><tr><th>아이콘</th><th>효과</th><th>값 단위</th><th>설명</th></tr></thead><tbody>${rows.map(effectCatalogRowMarkup).join('')}</tbody></table></div>`;
    } else if (state.catalogTab === 'characters' || state.catalogTab === 'monsters') {
        const isMonster = state.catalogTab === 'monsters';
        const roster = isMonster ? catalogData.monsters.map(developerMonster) : catalogData.characters.map(developerCharacter);
        rows = roster.filter((entry) => {
            const matchesQuery = !query || [entry.id, entry.name, entry.element, entry.job, entry.grade, entry.level, entry.stageName, entry.concept].join(' ').toLocaleLowerCase().includes(query);
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
        content = `<div class="catalog-table-wrap"><table class="catalog-table roster-table"><thead><tr><th>초상</th><th>이름</th><th>등급</th><th>스킬</th>${rosterStatHeadersMarkup()}${import.meta.env.DEV ? '<th>편집 / 활성화</th>' : ''}</tr></thead><tbody>${pageRows.map(rosterRowMarkup).join('')}</tbody></table></div><div class="catalog-pagination"><span>${total ? `${state.catalogPage * catalogPageSize + 1}–${Math.min((state.catalogPage + 1) * catalogPageSize, total)} / ${total}` : '검색 결과 없음'}</span><div><button data-action="catalog-prev" ${state.catalogPage === 0 ? 'disabled' : ''} aria-label="이전 페이지">←</button><button data-action="catalog-next" ${state.catalogPage >= pageCount - 1 ? 'disabled' : ''} aria-label="다음 페이지">→</button></div></div>`;
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
    const typeOptions = [...new Set(catalogData.skills.map(effectiveSkill).flatMap((skill) => skill.category.split('|').map((type) => type.trim()).filter(Boolean)))];
    const hasBasicAttacks = catalogData.skills.map(effectiveSkill).some((skill) => skill.isBasicAttack);
    const balancedSkillCount = catalogData.skills.map(effectiveSkill).filter((skill) => skill.balanceReached).length;
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
        ? `${catalogData.characters.length}명 · 전체 Lv.${state.catalogLevel} 적용 · 속성별 52–53명 · 직업별 43–44명 · 등급 3→5 ${characterGradeCounts}`
        : state.catalogTab === 'monsters'
            ? `${catalogData.monsters.length}마리 · 전체 Lv.${state.catalogLevel} 적용 · 속성별 33–34마리 · 직업별 28마리 · 별자리별 14마리 · 등급 1→5 ${monsterGradeCounts}`
            : '';
    const summary = state.catalogTab === 'skills'
        ? `<p class="catalog-balance-summary">개별 균형 목표 ±2%p · ${balancedSkillCount}/${catalogData.skills.length}개 도달 · 지속턴 반영</p>`
        : rosterSummary ? `<p class="catalog-balance-summary">${rosterSummary}</p>` : '';
    return `<header class="topbar catalog-topbar"><a class="wordmark" href="#" aria-label="검은 회랑 도감"><span class="wordmark-sigil">✠</span><span>검은 회랑<small>원정 자료실</small></span></a><span class="catalog-source">워크북 데이터 · ${catalogData.skills.length + catalogData.effects.length + catalogData.stats.length + catalogData.characters.length + catalogData.monsters.length}개 항목</span><button class="game-menu-button codex-back-button" type="button" data-action="view-expedition" aria-label="뒤로가기" title="뒤로가기"><img src="/assets/icons/back_icon.svg" alt="" aria-hidden="true"></button></header><main class="catalog-main"><div class="catalog-heading"><div><span class="section-kicker">자료실</span><h1>전투 자료 도감</h1></div><p>스킬, 효과, 캐릭터, 몬스터, 별자리별 기준 스탯</p></div><nav class="catalog-tabs" aria-label="도감 분류">${tabs.map(([id, label, count]) => `<button class="catalog-tab ${state.catalogTab === id ? 'active' : ''}" data-catalog-tab="${id}" aria-pressed="${state.catalogTab === id}">${label}<span>${count}</span></button>`).join('')}</nav><section class="catalog-browser"><div class="catalog-tools"><label class="catalog-search"><span>검색</span><input type="search" data-catalog-search value="${escapeHtml(state.catalogSearch)}" placeholder="이름, 속성, 설명 검색" autocomplete="off"></label>${filters}<span class="catalog-result-count">${total}개 항목</span></div>${summary}${content}</section></main><footer class="bottom-note"><span>검은 회랑 <i>·</i> 원정 자료실</span><span>조디악 성장표 기반 콘텐츠</span></footer>`;
}

let developerEditingSkillId = null;
let developerCharacterEditorReturn = null;
function renderDeveloperSkillEditor() {
    const original = catalogData.skills.find((skill) => skill.id === developerEditingSkillId);
    if (!original) { state.view = 'catalog'; return renderCatalog(); }
    const skill = effectiveSkill(original);
    const wrapper = document.createElement('div');
    const [glyph, tint] = skillGlyph(original);
    wrapper.innerHTML = catalogIconMarkup(glyph, tint, original.name, 'catalog-icon');
    const iconChoices = [...new Set([...Object.values(statIcons), ...Object.values(jobGlyphs), ...Object.values(elementGlyphs), ...Object.values(zodiacIcons)])].filter((src) => src.startsWith('/'));
    const close = () => {
        if (developerCharacterEditorReturn) {
            const context = developerCharacterEditorReturn;
            developerCharacterEditorReturn = null;
            state.view = 'catalog'; state.catalogTab = 'characters'; render();
            openDeveloperCharacterEditor(context.id, false, context.draft);
            return;
        }
        state.view = 'catalog'; state.catalogTab = 'skills'; render();
        game.querySelector(`[data-skill-edit="${CSS.escape(original.id)}"]`)?.focus();
    };
    const editor = createDeveloperSkillEditor({
        skill, effects: catalogData.effects, deriveSkill: derivedSkill,
        enabled: skillEnabled(skill.id), iconChoices,
        defaultThumbnailSrc: wrapper.querySelector('img').src,
        onSave: (values, enabled) => { saveSkillEdit(original.id, values, enabled); close(); },
        onCancel: close,
    });
    game.replaceChildren(editor);
    document.querySelector('#stage-canvas').scrollTop = 0;
}

function renderCatalog() {
    game.innerHTML = catalogMarkup();
}

function characterCodexMarkup() {
    const query = state.catalogSearch.trim().toLocaleLowerCase();
    const isMonster = state.characterCodexTab === 'monsters';
    const rosterLabel = isMonster ? '몬스터' : '캐릭터';
    const entries = catalogData[isMonster ? 'monsters' : 'characters'].map((entry) => isMonster ? developerMonster(entry) : developerCharacter(entry)).filter((entry) => {
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
    const filters = `<label>속성<select data-catalog-filter="element"><option value="">전체 속성</option>${['불', '물', '풀', '빛', '어둠'].map((value) => `<option value="${value}" ${state.catalogElement === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label><label>직업<select data-catalog-filter="job"><option value="">전체 직업</option>${jobOptions.map((value) => `<option value="${escapeHtml(value)}" ${state.catalogJob === value ? 'selected' : ''}>${escapeHtml(value)}</option>`).join('')}</select></label><label>등급<select data-catalog-filter="grade"><option value="">전체 등급</option>${gradeOptions.map((value) => `<option value="${value}" ${state.catalogGrade === String(value) ? 'selected' : ''}>${value}등급</option>`).join('')}</select></label>`;
    const portraits = entries.map((entry) => {
        const active = entry.id === selected?.id;
        const border = elementBorderClasses[entry.element] || 'light';
        const title = `${entry.name} · ${entry.element} · ${entry.job} · ${entry.grade}등급`;
        const thumbnailSrc = characterImageSource(entry, true);
        const thumbnail = thumbnailSrc
            ? `<img class="codex-character-thumb" src="${thumbnailSrc}" alt="${escapeHtml(entry.name)}" draggable="false">`
            : catalogIconMarkup(entry.mark, elementTints[entry.element] || '#a6d7e8', entry.name, 'codex-character-thumb');
        return `<button class="codex-character-card ${active ? 'active' : ''}" type="button" data-codex-character="${entry.id}" aria-pressed="${active}" aria-label="${escapeHtml(title)}"><span class="codex-character-frame element-border-${border}">${thumbnail}</span><span class="codex-character-name">${escapeHtml(entry.name)}</span></button>`;
    }).join('');
    const tabs = `<nav class="codex-tabs" aria-label="도감 종류"><button class="codex-tab ${isMonster ? '' : 'active'}" type="button" data-codex-tab="characters" aria-pressed="${!isMonster}">캐릭터 도감</button><button class="codex-tab ${isMonster ? 'active' : ''}" type="button" data-codex-tab="monsters" aria-pressed="${isMonster}">몬스터 도감</button><button class="codex-tab" type="button" disabled title="아이템 도감 준비 중">아이템 도감</button><button class="codex-tab" type="button" disabled title="던전 도감 준비 중">던전 도감</button></nav>`;
    const panel = selected
        ? plazaEncounterMarkup(isMonster ? selected : { ...selected, price: hirePrices[selected.grade] ?? 30, weeklyWage: hirePrices[selected.grade] ?? 30, portraitSrc: characterImageSource(selected) })
        : `<div class="codex-empty-state">조건에 맞는 ${rosterLabel}가 없습니다.</div>`;
    const experiencePercent = Math.min(100, Math.max(0, state.experience / state.experienceToNextLevel * 100));
    return `<header class="topbar plaza-topbar codex-topbar">${playerProfileMarkup()}<div class="codex-topbar-actions"><button class="game-menu-button codex-back-button" type="button" data-action="view-expedition" aria-label="돌아가기" title="돌아가기"><img src="/assets/icons/back_icon.svg" alt="" aria-hidden="true"></button></div></header><main class="character-codex-page plaza-page">${tabs}<div class="character-codex-heading"><div><h1 class="${isMonster ? 'codex-monster-heading' : ''}">도감 - ${rosterLabel} 도감</h1></div></div><section class="catalog-browser codex-browser"><section class="codex-feature-panel" aria-label="선택한 ${rosterLabel} 상세 정보">${panel}</section><div class="catalog-tools"><label class="catalog-search"><span>검색</span><input type="search" data-catalog-search value="${escapeHtml(state.catalogSearch)}" placeholder="이름, 속성, 직업 검색" autocomplete="off"></label>${filters}</div><section class="codex-roster" aria-label="${rosterLabel} 목록"><div class="codex-roster-heading"><h2>${rosterLabel} 목록</h2><span>${entries.length}/${catalogData[isMonster ? 'monsters' : 'characters'].length}</span></div><div class="codex-roster-viewport" tabindex="0" aria-label="${rosterLabel}를 좌우로 스크롤하여 선택">${portraits || '<p class="codex-empty-roster">표시할 항목이 없습니다.</p>'}</div></section></section></main>${gameFooterMarkup()}${gameMenuMarkup()}`;
}

function renderCharacterCodex() {
    const selectionKey = `${state.characterCodexTab}:${state.catalogSelectedRosterId}`;
    const animatePortrait = selectionKey !== renderedPortraitSelection;
    renderedPortraitSelection = selectionKey;
    const previousScrollLeft = game.querySelector('.codex-roster-viewport')?.scrollLeft;
    game.innerHTML = characterCodexMarkup();
    if (previousScrollLeft !== undefined) {
        const viewport = game.querySelector('.codex-roster-viewport');
        if (viewport) viewport.scrollLeft = previousScrollLeft;
    }
    const portraitSrc = state.characterCodexTab === 'characters'
        ? characterImageSource(catalogData.characters.find((entry) => entry.id === state.catalogSelectedRosterId))
        : characterImageSource(catalogData.monsters.find((entry) => entry.id === state.catalogSelectedRosterId) || {});
    const panel = game.querySelector('.codex-feature-panel');
    if (!portraitSrc || !panel) return;
    const mask = document.createElement('div');
    const isMonster = state.characterCodexTab === 'monsters';
    mask.className = `codex-character-art-mask${isMonster ? ' codex-monster-art-mask' : ''}${animatePortrait && !isMonster ? ' is-entering' : ''}`;
    mask.setAttribute('aria-hidden', 'true');
    const image = document.createElement('img');
    image.src = portraitSrc;
    image.alt = '';
    image.draggable = false;
    mask.append(image);
    panel.prepend(mask);
    if (isMonster) {
        const info = panel.querySelector('.plaza-encounter-info') ? logicalRect(panel.querySelector('.plaza-encounter-info')) : null;
        const skills = panel.querySelector('.plaza-encounter-skills') ? logicalRect(panel.querySelector('.plaza-encounter-skills')) : null;
        const bounds = logicalRect(mask);
        if (info && skills && bounds.width) {
            const center = (info.right + skills.left) / 2;
            mask.style.setProperty('--monster-art-center', `${(center - bounds.left) / bounds.width * 100}%`);
        }
    }
}

function plazaEncounterMarkup(offer) {
    if (!offer) {
        const exhausted = state.plazaOffers.length === 0;
        return `<div class="plaza-empty-stage"><span class="plaza-stage-sigil">✦</span><p>${escapeHtml(state.plazaMessage || (exhausted ? '더 이상 제안할 용병이 없는 듯 하다' : '광장에는 여러 모험가가 오갑니다.'))}</p></div>`;
    }
    const skillIcons = activeSkills(offer.skills).map((skill) => {
        const [glyph, tint] = skillGlyph(skill);
        return `<button type="button" class="plaza-skill-tooltip-trigger" aria-label="${escapeHtml(skill.name)}">${skillIconMarkup(skill, 'plaza-skill-icon')}${skillTooltip(skill, offer)}</button>`;
    }).join('');
    const elementColor = elementTints[offer.element] || '#a99060';
    const portrait = offer.portraitSrc
        ? ''
        : catalogIconMarkup(offer.mark, elementColor, offer.name, 'plaza-portrait-icon', `${offer.name} · ${offer.element}`);
    const statRows = rosterStatColumns.map(([key, label]) => [key, label, offer.stats[key]]);
    const gradeCount = Math.min(5, Math.max(0, Math.floor(Number(offer.grade) || 0)));
    const gradeMarkup = `<span class="detail-grade"><span class="grade-stars" role="img" aria-label="${gradeCount}등급">${Array.from({ length: gradeCount }, () => `<img src="${gradeIcon}" class="grade-star-icon" alt="">`).join('')}</span></span>`;
    const jobIcon = plazaActionIconMarkup(jobGlyphs[offer.job] || '✦', '#a6d7e8');
    const elementIcon = plazaActionIconMarkup(elementGlyphs[offer.element] || '◇', elementColor);
    const affinity = Math.min(100, Math.max(0, Number(state.affinityByCharacterId[offer.id] ?? offer.affinity ?? 10)));
    const zodiacGlyph = zodiacIcons[offer.zodiac] || '✧';
    const affinityLabel = affinity === 0 ? '앙숙' : affinity <= 10 ? '데면데면한 사이' : affinity <= 20 ? '보통 사이' : affinity <= 50 ? '호감이 있는 사이' : affinity <= 90 ? '친밀한 사이' : '소울메이트';
    const zodiacIcon = catalogIconMarkup(zodiacGlyph, '#a6d7e8', offer.zodiac || '별자리', 'plaza-affinity-icon');
    const affinityPanel = `<div class="plaza-encounter-affinity"><span class="section-kicker">친밀도</span><div class="plaza-affinity-main"><div class="plaza-affinity-copy"><strong>${affinityLabel}</strong><small>${affinity} / 100</small></div>${zodiacIcon}</div><div class="plaza-affinity-meter"><span style="width:${affinity}%"></span></div></div>`;
    const weeklyWage = offer.weeklyWage;
    const wageLabel = weeklyWage !== undefined && weeklyWage !== null && weeklyWage !== '' && Number.isFinite(Number(weeklyWage))
        ? goldAmountMarkup(Math.max(0, Number(weeklyWage)))
        : '미정';
    const priceMarkup = offer.price === undefined ? '' : `<span class="plaza-encounter-price">영입가 <strong>${goldAmountMarkup(offer.price)}</strong></span><span class="plaza-encounter-price plaza-encounter-wage">주급 <strong>${wageLabel}</strong></span>`;
    return `<article class="plaza-encounter"><section class="plaza-encounter-info"><div class="plaza-encounter-title"><span class="plaza-encounter-meta">${jobIcon}<span>${escapeHtml(offer.job)}</span></span><span class="plaza-encounter-meta">${elementIcon}<span>${escapeHtml(offer.element)}</span></span><span class="plaza-encounter-level">Lv.${offer.level}</span></div><h2 class="plaza-encounter-name"><span>${escapeHtml(offer.name)}</span>${gradeMarkup}</h2>${offer.stageName ? `<p class="monster-stage-info">${escapeHtml(offer.stageName)} · ${offer.isBoss ? '보스' : '일반'} · ${escapeHtml(offer.size)}형</p><p class="monster-concept">${escapeHtml(offer.concept)}</p>` : ''}<div class="plaza-encounter-stats">${statRows.map(([key, label, value]) => `<span><small>${statLabelMarkup(key, label)}</small><strong>${value}</strong></span>`).join('')}</div>${priceMarkup}</section><div class="plaza-encounter-art">${portrait}</div><section class="plaza-encounter-skills"><span class="section-kicker plaza-encounter-skills-title">스킬 정보</span><div class="plaza-encounter-skill-icons">${skillIcons}</div>${affinityPanel}</section></article>`;
}

function combatStatsFromProfile(stats) {
    return { ...stats };
}

function hireMercenary(characterId) {
    if (!characterEnabled(characterId)) return;
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
    if (state.tutorial?.stage === 'hire-first') state.tutorial.stage = 'look-second';
    else if (state.tutorial?.stage === 'hire-second') state.tutorial.stage = 'depart';
    state.plazaMessage = `${offer.name}을(를) 고용했습니다.`;
    render();
}

function releaseMercenary(characterId) {
    const index = state.recruits.findIndex((candidate) => candidate.id === characterId);
    if (index < 0) return;
    const [character] = state.recruits.splice(index, 1);
    if (!character.isGuildMember) {
        state.gold += character.price;
        state.plazaOffers.push(character);
    }
    state.plazaMessage = `${character.name}의 ${character.isGuildMember ? '선발' : '고용'}을 취소했습니다.`;
    render();
}

function encounterNextMercenary() {
    state.plazaOffers = state.plazaOffers.filter((entry) => characterEnabled(entry.id) && !state.guildMembers.some(member => member.id === entry.id)).map(plazaOfferWithCurrentProfile);
    if (!state.plazaOffers.length) {
        state.plazaCurrentOffer = null;
        state.plazaMessage = '더 이상 제안할 용병이 없는 듯 하다';
        render();
        return;
    }
    const index = Math.floor(Math.random() * state.plazaOffers.length);
    state.plazaCurrentOffer = state.plazaOffers.splice(index, 1)[0];
    if (state.tutorial?.stage === 'look-first') state.tutorial.stage = 'hire-first';
    else if (state.tutorial?.stage === 'look-second') state.tutorial.stage = 'hire-second';
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
    if (!offer || !characterEnabled(offer.id) || !canInviteGuildMember(state, offer)) return;
    state.guildRecruitmentDialog = { type: 'proposal', memberId: offer.id };
    render();
}

function confirmGuildRecruitment() {
    const dialog = state.guildRecruitmentDialog;
    const offer = state.plazaCurrentOffer;
    if (dialog?.type !== 'proposal' || offer?.id !== dialog.memberId) return;
    const result = recruitGuildMember(state, offer);
    if (!result) {
        state.guildRecruitmentDialog = null;
        render();
        return;
    }
    state.guildRecruitmentDialog = { type: 'result', ...result };
    state.plazaMessage = result.success ? `${result.name}이(가) 길드에 합류했습니다.` : `${result.name}이(가) 길드원 제안을 거절했습니다.`;
    render();
}

function renderGuildProgressPopup() {
    if (['lobby', 'playerSetup', 'prologue'].includes(state.view)) return;
    let content = '';
    if (state.pendingLevelUp) {
        const level = state.pendingLevelUp;
        content = `<span class="section-kicker">새로운 주 · 새로운 성장</span><h2 id="guild-progress-title">레벨 업!</h2><strong class="level-up-number">Lv.${level.previousLevel} → Lv.${level.level}</strong><p>경험치가 0으로 초기화되었습니다. 다음 레벨에 필요한 경험치는 ${level.maximumExperience.toLocaleString('ko-KR')}입니다.</p>${level.level === 2 ? '<div class="guild-recruitment-summary"><strong>길드원 제안 해금</strong><span>광장에서 동료를 영입하세요.</span></div>' : ''}<div class="plaza-dialog-actions single-action"><button type="button" data-action="level-up-confirm">확인</button></div>`;
    } else if (!pendingGuildDispatchResults(state).length && state.guildRecruitmentDialog) {
        const dialog = state.guildRecruitmentDialog;
        if (dialog.type === 'proposal') {
            const offer = state.plazaCurrentOffer;
            if (!offer || offer.id !== dialog.memberId) return;
            const relationship = guildRecruitmentRelationship(state, offer);
            const wage = guildRecruitmentWage(offer);
            content = `<span class="section-kicker">새로운 동료</span><h2 id="guild-progress-title">${escapeHtml(offer.name)} · 길드원 제안</h2><p>길드원으로 영입되면 즉시 첫 주차 주급이 차감됩니다. 이후 매주 시작될 때마다 주급을 지급합니다.</p><p>친밀도가 낮으면 상대방이 제안을 거절할 수 있습니다. 거절 시 골드는 차감되지 않으며, 이번 주에는 다시 제안할 수 없습니다.</p><div class="guild-recruitment-summary"><span>첫 주차 주급 / 매주</span><strong>${goldAmountMarkup(wage, 'G')}</strong></div><table class="guild-recruitment-rates"><thead><tr><th scope="col">관계 단계</th><th scope="col">영입 성공률</th></tr></thead><tbody>${guildRelationshipStages.map(stage => `<tr class="${stage === relationship ? 'is-current' : ''}"><td>${stage.label}${stage === relationship ? '<small>현재 관계</small>' : ''}</td><td>${stage.chance}%</td></tr>`).join('')}</tbody></table><div class="plaza-dialog-actions"><button type="button" class="plaza-dialog-cancel" data-action="guild-recruitment-cancel">취소</button><button type="button" data-action="guild-recruitment-confirm" ${canInviteGuildMember(state, offer) ? '' : 'disabled'}>길드원 제안 · ${relationship.chance}%</button></div>`;
        } else {
            content = `<span class="section-kicker">길드원 제안 결과</span><h2 id="guild-progress-title">${dialog.success ? '영입 성공' : '영입 실패'}</h2><p>${escapeHtml(dialog.name)}${dialog.success ? '이(가) 길드에 합류했습니다. 길드원 목록에서 원정대에 선발할 수 있습니다.' : '이(가) 아직 함께할 준비가 되지 않았다며 제안을 거절했습니다.'}</p><div class="guild-recruitment-summary"><span>${dialog.success ? '첫 주차 주급 지급' : '골드 차감 없음'}</span><strong>${goldAmountMarkup(dialog.success ? dialog.wage : 0, 'G')}</strong></div><div class="plaza-dialog-actions single-action"><button type="button" data-action="guild-recruitment-result-confirm">확인</button></div>`;
        }
    }
    if (!content) return;
    game.insertAdjacentHTML('beforeend', `<div class="end-overlay guild-recruitment-overlay"><section class="end-dialog guild-recruitment-dialog" data-popup-kind="${state.pendingLevelUp || state.guildRecruitmentDialog?.success ? 'positive' : 'negative'}" role="dialog" aria-modal="true" aria-labelledby="guild-progress-title">${content}</section></div>`);
    for (const child of game.children) if (!child.classList.contains('guild-recruitment-overlay')) child.inert = true;
    game.querySelector('.guild-recruitment-overlay button:not(:disabled)')?.focus({ preventScroll: true });
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

function resetPlazaEncounters() {
    state.plazaCurrentOffer = null;
    state.plazaGiftedIds = [];
    state.plazaGuildInvitedIds = [];
    state.plazaGuildSelectionOpen = false;
    state.plazaOffers = drawPlazaOffers();
}

function advanceWeekWithFixedCost(message = '', { resetEncounters = true } = {}) {
    state.week += 1;
    levelUpAtWeekStart(state);
    const returnedDispatches = completeGuildDispatches(state);
    const guildWages = weeklyGuildWages();
    const fixedCost = 100 + guildWages;
    state.gold -= fixedCost;
    if (resetEncounters) resetPlazaEncounters();
    state.plazaMessage = `${message ? `${message} ` : ''}${state.week}주차 고정비 ${fixedCost}골드(생활비 100 + 길드 주급 ${guildWages})를 차감했습니다.`;
    if (returnedDispatches.length) state.plazaMessage += ' ' + returnedDispatches.map((dispatch) => `${dispatch.destination.name} 파견 복귀: ${dispatch.status === 'success' ? `성공 · 골드 ${dispatch.gold}, 명성 ${dispatch.fame}` : '실패 · 보수 없음'}`).join(' / ');
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
    finishRegularExpeditionDestination(state, completed, guildDestinations);
    state.expeditionRewardBaseline = null;
    if (state.tutorial?.stage === 'battle' && completed) {
        advanceWeekWithFixedCost('첫 원정을 마쳤습니다.');
        state.plazaDialog = '';
        state.fixedCostNoticeShown = true;
        state.tutorial.stage = 'founding-story';
        startPlazaDialogue('tutorial.founding');
        render();
        return;
    }
    if (state.tutorial?.stage === 'battle' && !completed) state.tutorial.stage = 'select-open';
    advanceWeekWithFixedCost(completed ? '원정을 완수했습니다.' : defeated ? '원정대가 전멸했습니다.' : '원정에서 복귀했습니다.', { resetEncounters: false });
    // Every regular expedition return starts a fresh encounter pool, regardless of outcome.
    state.activePlazaDialogue = null;
    resetPlazaEncounters();
    render();
}

function showExpeditionResult(completed, defeated = false) {
    if (state.expeditionResult) return;
    retreatDialogOpen = false;
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
        ? state.tutorial?.stage === 'battle' ? '온바람 평야 북부의 첫 원정을 무사히 마쳤습니다.' : '보스를 처치하고 회랑을 정복했습니다.'
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
    if (!regularDepartureStatus().canDepart) return;
    if (state.tutorial?.stage === 'depart') return startExpedition();
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
        state.plazaMessage = `국가 원정 지원금 ${supportAmount}골드를 받았습니다.`;
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
    if (!regularDepartureStatus().canDepart) return;
    state.plazaGuildSelectionOpen = false;
    startRegularExpeditionDestination(state, state.tutorial?.stage === 'depart' ? tutorialExpeditionDestination : regularDepartureStatus().destination);
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
    if (state.tutorial?.stage === 'depart') {
        state.tutorial.stage = 'battle';
        return startEncounter();
    }
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
        ? `<div class="plaza-choice-grid"><button data-action="plaza-hire" data-character-id="${escapeHtml(offer.id)}" ${state.recruits.length >= maxPartySize || state.gold < offer.price ? 'disabled' : ''}>용병 제안 · ${goldAmountMarkup(offer.price, 'G')}</button><button data-action="plaza-guild" ${canInviteGuildMember(state, offer) ? '' : 'disabled'}>${guildInvited ? '길드원 제안 완료' : '길드원 제안'} · ${goldAmountMarkup(guildRecruitmentWage(offer), 'G')}</button><button data-action="plaza-gift" disabled>${giftUsed ? '선물 전달 완료' : `선물 주기 · ${goldAmountMarkup(giftPrice, 'G')}`}</button><button data-action="plaza-pass">지나가기 <span>→</span></button></div><p class="plaza-feedback">${goldTextMarkup(state.plazaMessage)}</p>`
        : `<button class="plaza-look-around" data-action="plaza-look-around" ${state.plazaOffers.length === 0 ? 'disabled' : ''}>광장을 둘러본다 <span>→</span></button><p class="plaza-feedback">${escapeHtml(state.plazaMessage || (state.plazaOffers.length === 0 ? '더 이상 제안할 용병이 없는 듯 하다' : ''))}</p>`;
    game.innerHTML = `<div class="plaza-page-background" aria-hidden="true"></div><header class="topbar plaza-topbar"><a class="wordmark" href="#" aria-label="검은 회랑 광장"><span class="wordmark-sigil">✠</span><span>검은 회랑<small>모험가 광장</small></span></a><div class="plaza-player-meta"><span>플레이어 Lv.${state.userLevel}</span><strong>${goldAmountMarkup(state.gold)}</strong><strong class="current-fame">${fameAmountMarkup(state.fame)}</strong><button class="catalog-open" data-action="catalog">도감</button></div></header><main class="plaza-page"><section class="scene plaza-scene"><div class="scene-heading"><span class="section-kicker">모험가 광장</span><h1>${offer ? '새로운 만남' : '광장을 둘러보다'}</h1><p>${offer ? '광장에 한 명의 모험가가 다가왔습니다.' : `${remaining}명의 용병을 만날 수 있습니다.`}</p></div><div class="dungeon-art plaza-encounter-stage"><div class="art-haze haze-one"></div><div class="art-haze haze-two"></div><div class="arch arch-outer"><div class="arch arch-inner"><div class="arch-opening"><div class="distant-light"></div><div class="distant-floor"></div></div></div></div><div class="wall wall-left"><i></i><i></i><i></i><i></i><i></i></div><div class="wall wall-right"><i></i><i></i><i></i><i></i><i></i></div><div class="floor-stone"></div>${offer ? plazaEncounterMarkup(offer) : `<div class="plaza-empty-stage"><span class="plaza-stage-sigil">✦</span><p>${escapeHtml(state.plazaMessage || (state.plazaOffers.length === 0 ? '더 이상 제안할 용병이 없는 듯 하다' : '광장에는 여러 모험가가 오갑니다.'))}</p></div>`}</div></section><section class="lower-grid plaza-lower-grid"><section class="party-panel plaza-roster"><div class="panel-heading"><div><span class="section-kicker">원정 준비</span><h2>용병단 <small>${state.recruits.length}/${maxPartySize}</small></h2></div><span class="formation-label">Lv.${state.userLevel}</span></div><div class="plaza-hired-list">${recruits}${vacantSlots}</div><div class="plaza-depart-row"><button class="plaza-depart" data-action="plaza-depart" ${state.recruits.length === 0 ? 'disabled' : ''}>원정 출발 <span>→</span></button></div></section><aside class="action-panel plaza-action-panel"><div class="panel-heading"><div><span class="section-kicker">${offer ? '선택' : '다음 조우'}</span><h2>${offer ? `${offer.name}과의 대화` : '광장을 살펴본다'}</h2></div><span class="turn-indicator">${remaining}명 남음</span></div>${choices}</aside></section></main><footer class="bottom-note"><span>검은 회랑 <i>·</i> 광장</span><span>직업별 용병 제안 · 최대 ${maxPartySize}명</span></footer>`;
}

function renderPlaza() {
    state.plazaOffers = state.plazaOffers.filter((entry) => characterEnabled(entry.id) && !state.guildMembers.some(member => member.id === entry.id)).map(plazaOfferWithCurrentProfile);
    if (state.plazaCurrentOffer && !characterEnabled(state.plazaCurrentOffer.id)) state.plazaCurrentOffer = null;
    if (state.plazaCurrentOffer) state.plazaCurrentOffer = plazaOfferWithCurrentProfile(state.plazaCurrentOffer);
    const transitionClass = plazaTransitionPhase ? ` plaza-transition-${plazaTransitionPhase}` : '';
    plazaTransitionPhase = '';
    const offer = !state.plazaGuildSelectionOpen && state.plazaCurrentOffer
        ? { ...state.plazaCurrentOffer, portraitSrc: characterImageSource(state.plazaCurrentOffer) }
        : null;
    const activeDialogue = state.plazaGuildSelectionOpen ? null : getActivePlazaDialogue();
    const isMonologue = activeDialogue?.dialogue.presentation === 'monologue';
    const isOneOnOne = activeDialogue?.dialogue.presentation === 'oneOnOne';
    const isTwoPerson = activeDialogue?.dialogue.presentation === 'twoPerson';
    const dialogueCharacter = isOneOnOne
        ? developerCharacter(catalogData.characters.find((character) => character.id === activeDialogue.dialogue.characterId))
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
    const recruits = state.recruits.map((hero, index) => heroMarkup(hero, index, { plazaControls: true })).join('');
    const vacantSlots = Array.from({ length: maxPartySize - state.recruits.length }, () => emptyPartySlotMarkup().replace('</article>', `<button class="plaza-guild-select-open" type="button" data-action="plaza-guild-select-open" ${hasAvailablePlazaGuildMember(state, maxPartySize) ? '' : 'disabled'}><img src="/assets/icons/plus_icon.svg" alt="" aria-hidden="true">길드원 선발</button></article>`)).join('');
    const giftUsed = offer && state.plazaGiftedIds.includes(offer.id);
    const guildInvited = offer && state.plazaGuildInvitedIds.includes(offer.id);
    const departure = regularDepartureStatus();
    const choices = state.plazaGuildSelectionOpen
        ? '<div class="action-buttons plaza-action-buttons"><button class="combat-action" type="button" data-action="plaza-guild-select-close"><span class="plaza-action-label">광장으로 돌아가기</span></button></div>'
        : offer
        ? `<div class="action-buttons plaza-choice-grid plaza-action-buttons"><button class="combat-action" data-action="plaza-hire" data-character-id="${escapeHtml(offer.id)}" ${state.recruits.length >= maxPartySize || state.gold < offer.price ? 'disabled' : ''}>${catalogIconMarkup('/assets/icons/party_icon.svg', '#a6d7e8', '', 'plaza-action-icon')}<span class="plaza-action-label">용병 제안</span></button><button class="combat-action" data-action="plaza-guild" ${canInviteGuildMember(state, offer) ? '' : 'disabled'}>${catalogIconMarkup('/assets/icons/royal_fleur_no_shadow.svg', '#a6d7e8', '', 'plaza-action-icon')}<span class="plaza-action-label">${guildInvited ? '길드원 제안 완료' : '길드원 제안'} · ${goldAmountMarkup(guildRecruitmentWage(offer), 'G')}</span></button><button class="combat-action" data-action="plaza-gift" disabled>${catalogIconMarkup('/assets/icons/event_icon.svg', '#a6d7e8', '', 'plaza-action-icon')}<span class="plaza-action-label">${giftUsed ? '선물 전달 완료' : `선물 주기 · ${goldAmountMarkup(giftPrice, 'G')}`}</span></button><button class="combat-action" data-action="plaza-pass">${catalogIconMarkup('/assets/icons/shoe_footprints_icon.svg', '#a6d7e8', '', 'plaza-action-icon')}<span class="plaza-action-label">지나가기</span></button></div><p class="target-hint plaza-feedback">${goldTextMarkup(state.plazaMessage)}</p>`
        : `<div class="action-buttons plaza-town-actions plaza-action-buttons"><button class="combat-action" data-action="plaza-look-around" ${state.plazaOffers.length === 0 ? 'disabled' : ''}>${catalogIconMarkup('/assets/icons/shoe_footprints_icon.svg', '#a6d7e8', '', 'plaza-action-icon')}<span class="plaza-action-label">광장을 살펴본다</span></button>${departure.requiresDestination ? `<button class="combat-action regular-destination-button${departure.destination ? ' is-destination-selected' : ''}" type="button" data-action="regular-destination-open">${catalogIconMarkup('/assets/icons/map_icon.svg', '#a6d7e8', '', 'plaza-action-icon')}<span class="plaza-action-label">원정지 선택${departure.destination ? ` - ${escapeHtml(departure.destination.name)}` : ''}</span></button>` : ''}<button class="combat-action" data-action="plaza-rest">${catalogIconMarkup('◷', '#a6d7e8', '', 'plaza-action-icon')}<span class="plaza-action-label">한 주 쉬기</span></button><button class="combat-action${departure.canDepart ? ' is-departure-ready' : ''}" data-action="plaza-depart" ${departure.canDepart ? '' : 'disabled'}>${catalogIconMarkup('/assets/icons/flag_icon.svg', '#a6d7e8', '', 'plaza-action-icon')}<span class="plaza-action-label">${departure.label}</span></button></div><p class="target-hint plaza-feedback">${goldTextMarkup(state.plazaMessage)}</p>`;
    const experiencePercent = Math.min(100, Math.max(0, state.experience / state.experienceToNextLevel * 100));
    const guildWages = weeklyGuildWages();
    const maintenance = weeklyMaintenanceCost();
    const dialog = state.plazaDialog === 'rest'
        ? { title: '한 주 쉬기', label: '주간 고정비', message: `생활비 100골드와 길드원 주급 ${guildWages}골드, 총 ${maintenance}골드가 차감됩니다. 한 주를 건너뛰시겠습니까?`, confirm: '한 주 쉬기' }
        : state.plazaDialog === 'maintenance'
            ? { title: '주간 고정비 안내', label: '첫 고정비 납부', message: `매주 생활비 100골드와 길드원 주급 ${guildWages}골드가 차감됩니다. 이번 주 고정비 ${maintenance}골드를 납부했습니다.`, confirm: '확인', cancel: false }
        : state.plazaDialog === 'support'
            ? { title: '국가 원정 지원금', label: '왕국의 격려', message: '회랑의 평화를 위해 나서는 원정대여, 왕국은 그대들의 용기와 노고를 기억한다. 여정을 멈추지 않도록 금화를 보탠다.', confirm: `${goldAmountMarkup(Math.max(0, 175 - state.gold))} 받기`, cancel: false }
        : state.plazaDialog === 'expedition'
            ? { title: '원정 출발', label: '원정대 확인', message: `원정에는 4명의 용병을 고용하는 것을 추천합니다. 현재 ${state.recruits.length}명의 용병이 원정대에 참여한 상태입니다. 이대로 원정을 떠나시겠습니까?`, confirm: '이대로 출발' }
            : null;
    const header = `<header class="topbar plaza-topbar${transitionClass}">${playerProfileMarkup()}<div class="plaza-player-meta">${gameMenuButtonsMarkup()}</div></header>`;
    const sceneContent = isOneOnOne || isTwoPerson ? '' : offer ? plazaEncounterMarkup(offer) : '<div class="plaza-empty-stage"></div>';
    const sceneTitle = dialogueContextLabel || (offer ? `${offer.name}과 조우` : '원정 준비 중');
    const scene = `<section class="scene plaza-scene"><div class="scene-heading location-heading"><h1>모험가 광장 - ${state.plazaGuildSelectionOpen ? '길드원 선발' : escapeHtml(sceneTitle)}</h1><div class="plaza-current-info"><span>${state.week}주차 -</span><strong>${goldAmountMarkup(state.gold)}</strong><strong class="current-fame">${fameAmountMarkup(state.fame)}</strong></div></div><div class="dungeon-art plaza-encounter-stage">${state.plazaGuildSelectionOpen ? guildDispatchMembersMarkup({ normalParty: true }) : sceneContent}</div></section>`;
    const roster = `<section class="party-panel plaza-roster"><div class="panel-heading"><div><h2>원정대 <small>${state.recruits.length}/${maxPartySize}</small></h2></div>${partyPowerMarkup(state.recruits)}</div><div class="party-list plaza-party-list">${recruits}${vacantSlots}</div></section>`;
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
        ? `<div class="plaza-dialogue-copy" aria-live="polite"><span class="plaza-dialogue-speaker">${escapeHtml(dialogueSpeaker)}</span><p>${goldTextMarkup(dialogueText)}</p></div>${dialogueChoices}`
        : isMonologue ? '' : choices;
    const actionPanel = `<aside class="action-panel plaza-action-panel"><div class="panel-heading ${activeDialogue ? '' : offer ? 'contract-heading' : 'expedition-ready-heading'}"><div><h2>${activeDialogue ? '선택' : offer ? '계약' : '원정 준비'}</h2></div></div>${dialogueMarkup}</aside>`;
    const modal = dialog && !state.pendingLevelUp && !state.guildRecruitmentDialog && !pendingGuildDispatchResults(state).length ? `<div class="end-overlay plaza-confirm-overlay"><section class="end-dialog" data-popup-kind="${state.plazaDialog === 'support' ? 'positive' : 'negative'}" role="dialog" aria-modal="true" aria-labelledby="plaza-dialog-title"><span class="section-kicker">${dialog.label}</span><h2 id="plaza-dialog-title">${dialog.title}</h2><p>${goldTextMarkup(dialog.message)}</p><div class="plaza-dialog-actions ${dialog.cancel === false ? 'single-action' : ''}">${dialog.cancel === false ? '' : '<button class="plaza-dialog-cancel" data-action="plaza-dialog-cancel">취소</button>'}<button data-action="plaza-dialog-confirm">${dialog.confirm}</button></div></section></div>` : '';
    const plazaJobSummary = !activeDialogue && !offer && state.plazaOffers.length
        ? `<p class="plaza-job-summary">광장에 <span class="plaza-job-counts">${plazaJobCountsMarkup()}</span>이 남아 있습니다. 광장을 탐색하여 그들과 조우해보세요.</p>`
        : '';
    game.innerHTML = `<div class="plaza-page-background" aria-hidden="true"></div>${header}<main class="plaza-page${transitionClass}">${scene}<section class="lower-grid plaza-lower-grid">${roster}${actionPanel}</section></main>${gameFooterMarkup()}${modal}${gameMenuMarkup()}`;
    if (offer?.portraitSrc && !activeDialogue) {
        const mask = document.createElement('div');
        mask.className = 'codex-character-art-mask plaza-encounter-character-mask';
        mask.setAttribute('aria-hidden', 'true');
        const image = document.createElement('img');
        image.src = offer.portraitSrc;
        image.alt = '';
        image.draggable = false;
        const additiveImage = image.cloneNode();
        additiveImage.className = 'plaza-encounter-additive';
        additiveImage.setAttribute('aria-hidden', 'true');
        mask.append(image, additiveImage);
        game.querySelector('.plaza-encounter-stage')?.prepend(mask);
    }
    if (!state.plazaGuildSelectionOpen && plazaJobSummary) game.querySelector('.plaza-empty-stage')?.insertAdjacentHTML('beforeend', plazaJobSummary);
    if (isMonologue) {
        const lowerGrid = game.querySelector('.plaza-lower-grid');
        if (lowerGrid) {
            lowerGrid.classList.add('plaza-lower-grid-monologue');
            lowerGrid.innerHTML = dialoguePanelMarkup(dialogueNode?.speaker === '' ? '' : '나', dialogueText);
            stopDialogueTypewriter = typeDialogueText(lowerGrid.querySelector('.plaza-monologue-line'), dialogueText, {
                immediate: plazaDialogueExitPending || window.matchMedia('(prefers-reduced-motion: reduce)').matches,
                onCharacter: playDialogueTypingSound,
            });
            if (!modal) lowerGrid.querySelector('.plaza-monologue-dialogue')?.focus({ preventScroll: true });
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
            const portraitSrc = character ? characterImageSource(character) : '';
            const listener = isTwoPerson && id !== (dialogueNode.speakerCharacterId || dialogueParticipants[0]);
            const listenerClass = listener ? ' is-listener' : '';
            return portraitSrc
                ? `<div class="codex-character-art-mask plaza-dialogue-character-mask plaza-dialogue-character-${side}${listenerClass}" aria-hidden="true"><img src="${portraitSrc}" alt="" draggable="false"></div>`
                : `<div class="plaza-dialogue-character-fallback plaza-dialogue-character-${side}${listenerClass}">${catalogIconMarkup(character?.mark || jobGlyphs[character?.job] || '✧', elementTints[character?.element] || '#a6d7e8', name, 'plaza-dialogue-character-icon')}</div>`;
        }).join('');
        stage?.insertAdjacentHTML('beforeend', portraitMarkup);
        const lowerGrid = game.querySelector('.plaza-lower-grid');
        const choices = (dialogueNode?.choices || []).slice(0, 8);
        const choiceButtons = choices.map((choice) => `<button class="combat-action plaza-dialogue-choice" type="button" data-action="plaza-dialogue-advance" data-dialogue-next="${escapeHtml(choice.next)}">${escapeHtml(choice.text)}</button>`).join('');
        if (lowerGrid) {
            lowerGrid.classList.add('plaza-lower-grid-dialogue');
            lowerGrid.classList.toggle('has-dialogue-choices', choices.length > 0);
            lowerGrid.innerHTML = `${dialoguePanelMarkup(dialogueSpeaker, dialogueText, !choices.length)}${choices.length ? `<div class="plaza-dialogue-choice-area"><div class="panel-heading"><h2>선택</h2></div><div class="plaza-dialogue-options" data-choice-count="${choices.length}" role="group" aria-label="대화 선택지">${choiceButtons}</div></div>` : ''}`;
            stopDialogueTypewriter = typeDialogueText(lowerGrid.querySelector('.plaza-monologue-line'), dialogueText, {
                immediate: plazaDialogueExitPending || window.matchMedia('(prefers-reduced-motion: reduce)').matches,
                onCharacter: playDialogueTypingSound,
            });
            if (!modal) lowerGrid.querySelector(choices.length ? '.plaza-dialogue-choice' : '.plaza-monologue-dialogue')?.focus({ preventScroll: true });
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

function guildDispatchCardActionsMarkup(member, normalParty = false) {
    const canSwap = !normalParty || member.isGuildMember;
    return `<div class="guild-dispatch-card-actions">${canSwap ? `<button type="button" data-action="${normalParty ? 'plaza-party-swap' : 'guild-dispatch-swap'}" data-member-id="${escapeHtml(member.id)}" aria-label="${escapeHtml(member.name)} 선발 취소 후 대원 선택" title="선발 취소 후 대원 선택"><img src="/assets/icons/swap_icon.svg" alt="" aria-hidden="true"></button>` : ''}<button type="button" disabled aria-label="스크롤 · 추후 개발" title="추후 개발"><img src="/assets/icons/scroll_icon.svg" alt="" aria-hidden="true"></button></div>`;
}

function heroMarkup(hero, index, { dispatchControls = false, plazaControls = false, readOnly = false } = {}) {
    const preparationControls = dispatchControls || plazaControls || readOnly;
    const fallen = hero.hp <= 0;
    const hit = Date.now() - (hero.hitAt || 0) < 1500;
    const selectedSkill = battleSkillsFor(party[state.turn]).find((skill) => skill.id === state.selectedSkill);
    const canRevive = selectedSkill?.effects?.some((effect) => normalizedCombatEffect(effect).code === 'REVIVE');
    const targetable = !preparationControls && battleTargetFor(selectedSkill) === 'ally' && !state.enemyPhase && (!fallen || canRevive);
    return `<article class="hero ${fallen ? 'fallen' : ''} ${hit ? 'hit' : ''} ${targetable ? 'targetable' : ''} ${!preparationControls && state.mode === 'combat' && !state.enemyPhase && state.turn === index ? 'active' : ''}" ${targetable ? `data-ally-target="${index}" role="button" tabindex="0" aria-label="${hero.name}, 체력 ${hero.hp}/${hero.maxHp}"` : ''}>
        ${combatNumberMarkup(hero)}
        ${characterTooltip(hero)}
        ${preparationControls ? `<button type="button" class="hero-thumbnail hero-codex-button roster-avatar-frame element-border-${elementBorderClasses[hero.element] || 'light'}" data-action="party-character-codex" data-member-id="${escapeHtml(hero.id)}" aria-label="${escapeHtml(hero.name)} 도감 보기">${characterThumbnailMarkup(hero, 'roster-avatar')}</button>` : `<span class="hero-thumbnail roster-avatar-frame element-border-${elementBorderClasses[hero.element] || 'light'}">${characterThumbnailMarkup(hero, 'roster-avatar')}</span>`}
        ${preparationControls && !readOnly ? guildDispatchCardActionsMarkup(hero, plazaControls) : statusEffectsMarkup(hero, true)}
        <div class="hero-name-row">${catalogIconMarkup(jobGlyphs[hero.job] || '✦', elementTints[hero.element] || '#a99060', hero.job, 'hero-job-icon')}<strong class="hero-name">${escapeHtml(hero.name)}</strong><span class="hero-level">Lv.${escapeHtml(hero.level || 1)}</span></div>
        <div class="hero-vitals"><strong class="hero-status ${hit ? 'hit-text' : ''}">${fallen ? '전투 불능' : `${hero.hp}<small>/${hero.maxHp}</small>`}</strong></div>
        ${combatHealthMarkup(hero, 'health')}
    </article>`;
}

function enemyMarkup(enemy, index) {
    const hit = Date.now() - (enemy.hitAt || 0) < 1500;
    const acting = state.enemyPhase && state.actingEnemy === index;
    return `<button class="enemy ${enemy.hp <= 0 ? 'defeated' : ''} ${acting ? 'acting' : ''} ${acting && state.enemyAttackLanded ? 'settled' : ''} ${hit ? 'hit' : ''}" data-target="${index}" ${enemy.hp <= 0 || state.mode !== 'combat' || state.enemyPhase ? 'disabled' : ''} aria-label="${escapeHtml(enemy.name)}, 체력 ${enemy.hp}">
        ${combatNumberMarkup(enemy)}
        <span class="enemy-mark" data-monster-size="${enemy.size || '중'}">${enemy.portraitSrc ? `<img class="enemy-art" src="${escapeHtml(enemy.portraitSrc)}" alt="" draggable="false"><img class="enemy-art enemy-art-highlight" src="${escapeHtml(enemy.portraitSrc)}" alt="" aria-hidden="true" draggable="false">` : escapeHtml(enemy.mark)}</span><span class="enemy-name">${escapeHtml(enemy.name)}</span>
        ${statusEffectsMarkup(enemy, true)}
        <span class="enemy-hp ${hit ? 'hit-text' : ''}">${enemy.hp > 0 ? `${enemy.hp}/${enemy.maxHp}` : '쓰러짐'}</span>${combatHealthMarkup(enemy, 'enemy-health')}
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

function migrateSavedMonsters() {
    const definitions = new Map(catalogData.monsters.map(developerMonster).map((entry) => [entry.id, entry]));
    if (!state.enemies?.some((enemy) => !definitions.has(enemy.id) || definitions.get(enemy.id).name !== enemy.name)) return;
    const roster = generateRosters(catalogData.growthRows, state.userLevel, catalogData.skills).monsters.map(developerMonster);
    const regular = monstersForStage(roster, state.expeditionDestination, false);
    const bosses = monstersForStage(roster, state.expeditionDestination, true);
    state.enemies = state.enemies.map((enemy, index) => {
        const candidates = enemy.isBoss || enemy.grade === 5 ? bosses : regular;
        const profile = roster.find((entry) => entry.id === enemy.id) || candidates[index % candidates.length];
        if (!profile) return null;
        const replacement = combatMonsterFromProfile(profile);
        replacement.hp = enemy.hp <= 0 ? 0 : Math.max(1, Math.round(replacement.maxHp * Math.min(1, enemy.hp / Math.max(1, enemy.maxHp))));
        return replacement;
    }).filter(Boolean);
}

function monstersForEncounter(boss) {
    const roster = generateRosters(catalogData.growthRows, state.userLevel, catalogData.skills).monsters.map(developerMonster);
    const candidates = monstersForStage(roster, state.expeditionDestination, boss).filter((entry) => monsterEnabled(entry.id));
    if (state.tutorial?.stage === 'battle') return candidates.slice(0, 1).map(combatMonsterFromProfile);
    const count = boss ? 1 : 2 + Math.floor(Math.random() * 3);
    const selected = [];
    while (selected.length < count && candidates.length) {
        const index = Math.floor(Math.random() * candidates.length);
        selected.push(combatMonsterFromProfile(candidates.splice(index, 1)[0]));
    }
    return selected;
}

const updateScenePresentation = createScenePresentation(playWebSound);

function tutorialCompanionProfile() {
    const profile = developerCharacter(catalogData.characters.find(character => character.id === TUTORIAL_COMPANION_ID));
    const stats = { ...profile.stats };
    return { ...profile, stats, baseStats: { ...stats }, hp: stats.maxHp, maxHp: stats.maxHp,
        color: ({ 불: 'red', 물: 'blue', 풀: 'green', 빛: 'ivory', 어둠: 'gold' })[profile.element] || 'ivory',
        price: 0, weeklyWage: 0, wageExempt: true, tutorialCompanion: true, cooldowns: {}, effects: [] };
}

function finishTutorialStory() {
    const id = state.activePlazaDialogue?.id;
    if (id === 'tutorial.meeting' && state.tutorial?.stage === 'meeting') {
        const companion = tutorialCompanionProfile();
        state.recruits = [companion];
        const pool = generateRosters(catalogData.growthRows, state.userLevel, catalogData.skills).characters
            .filter(character => character.id !== companion.id && characterEnabled(character.id) && character.grade === 3).map(developerCharacter);
        state.plazaOffers = [];
        while (state.plazaOffers.length < 2 && pool.length) {
            const candidate = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
            state.plazaOffers.push({ ...candidate, price: hirePrices[candidate.grade] ?? 30, weeklyWage: hirePrices[candidate.grade] ?? 30 });
        }
        state.activePlazaDialogue = null;
        state.plazaCurrentOffer = null;
        state.tutorial.stage = 'look-first';
        return true;
    }
    if (id === 'tutorial.founding' && state.tutorial?.stage === 'founding-story') {
        if (!state.tutorial.donationReceived) {
            state.gold += 5000;
            state.tutorial.donationReceived = true;
        }
        state.activePlazaDialogue = null;
        state.tutorial.stage = 'guild-open';
        return true;
    }
    return false;
}

function renderTutorialPrologue() {
    const scene = tutorialPrologue[state.prologueIndex];
    game.innerHTML = `<main class="tutorial-prologue-page"><header><span>HELLO GUILD MASTER</span><h1>잊혀진 세계, 새로운 시대</h1></header><div class="tutorial-prologue-scene" style="background-image:url('/assets/backgrounds/${scene.background}')"><span class="tutorial-prologue-chapter">PROLOGUE · ${state.prologueIndex + 1} / ${tutorialPrologue.length}</span></div><div class="tutorial-prologue-dialogue">${dialoguePanelMarkup('서막', scene.text).replace('data-action="plaza-dialogue-advance"', 'data-action="tutorial-prologue-next"')}</div></main>`;
    stopDialogueTypewriter = typeDialogueText(game.querySelector('.plaza-monologue-line'), scene.text, { immediate: window.matchMedia('(prefers-reduced-motion: reduce)').matches, onCharacter: playDialogueTypingSound });
    game.querySelector('[data-action="tutorial-prologue-next"]')?.focus({ preventScroll: true });
}

function tutorialElementAllowed(element) {
    const target = element.closest('[data-action], [data-target], [data-ally-target]');
    const action = target?.dataset.action || (target?.hasAttribute('data-target') ? 'combat-target' : target?.hasAttribute('data-ally-target') ? 'combat-ally' : '');
    return tutorialActionAllowed(state.tutorial, action, target?.dataset.memberId);
}

function applyTutorialGuide() {
    const stage = state.tutorial?.stage;
    if (!stage || stage === 'done') return;
    const companionName = tutorialCompanionProfile().name;
    const milestones = {
        'rent-popup': ['1단계 아지트 임대 완료', '이제 동료들이 돌아올 자리가 생겼습니다.', '최대 길드원 4명 · 첫 아지트 마련', 'castle_icon.svg'],
        'companion-popup': [`${escapeHtml(companionName)} 영입 완료`, `첫 길드원 ${escapeHtml(companionName)}이(가) 함께합니다. 그녀는 주급을 받지 않습니다.`, '길드 비서로 임명되었습니다.', 'party_icon.svg'],
        'final-popup': ['길드와 함께하는 원정', '길드원은 주급 이외의 추가 비용 없이 원정대에 선발할 수 있습니다.', '파견 원정은 마스터가 직접 전투를 지휘하지 않아도 대원들이 임무를 수행하고 보상을 가져옵니다.', 'flag_icon.svg'],
    };
    const milestone = milestones[stage];
    if (milestone) {
        game.insertAdjacentHTML('beforeend', `<div class="tutorial-overlay"><section class="tutorial-milestone" data-popup-kind="positive" role="dialog" aria-modal="true" aria-labelledby="tutorial-milestone-title"><img src="/assets/icons/${milestone[3]}" alt="" aria-hidden="true"><h2 id="tutorial-milestone-title">${milestone[0]}</h2><p>${milestone[1]}</p><p>${milestone[2]}</p><button type="button" data-action="tutorial-confirm">확인</button></section></div>`);
    }
    const guide = tutorialGuides[stage];
    if (guide && !milestone) game.insertAdjacentHTML('beforeend', `<div class="tutorial-guide" role="status"><span>첫걸음</span>${escapeHtml(guide[0].replaceAll('{{characterName}}', companionName))}</div>`);
    const controls = [...game.querySelectorAll('button, input, select, a, [data-action], [data-target], [data-ally-target]')];
    const enabled = [];
    controls.forEach(control => {
        const allowed = tutorialElementAllowed(control);
        if (!allowed) {
            if ('disabled' in control) control.disabled = true;
            control.setAttribute('aria-disabled', 'true');
            control.tabIndex = -1;
        } else {
            if (guide && control.dataset.action === guide[1] || control.dataset.action === 'expedition-result-confirm') control.classList.add('tutorial-highlight');
            if (!control.disabled) enabled.push(control);
        }
    });
    if (milestone) game.querySelector('[data-action="tutorial-confirm"]')?.focus({ preventScroll: true });
    else if (guide && stage !== 'battle') enabled[0]?.focus({ preventScroll: true });
}

// Guard nested targets as well as native buttons throughout the guided sequence.
game.addEventListener('click', event => {
    if (!state.tutorial?.stage || state.tutorial.stage === 'done') return;
    if (!tutorialElementAllowed(event.target)) { event.preventDefault(); event.stopImmediatePropagation(); }
}, true);
game.addEventListener('keydown', event => {
    if (retreatDialogOpen) return;
    if (!state.tutorial?.stage || state.tutorial.stage === 'done') return;
    if (event.key === 'Escape' || ['Enter', ' '].includes(event.key) && !tutorialElementAllowed(event.target)) {
        event.preventDefault(); event.stopImmediatePropagation();
    }
}, true);

function render() {
    stopDialogueTypewriter();
    if (!['lobby', 'playerSetup', 'prologue'].includes(state.view)) {
        migrateRegularExpeditionDestination(state);
        migrateSavedMonsters();
        resetTemporaryGuildRoster(state);
    }
    if (!['lobby', 'playerSetup', 'prologue'].includes(state.view)) {
        syncTutorialCompanion(state, tutorialCompanionProfile(), party);
        [...(state.guildMembers || []), ...(state.recruits || []), ...(state.plazaOffers || []), ...(state.plazaCurrentOffer ? [state.plazaCurrentOffer] : [])].forEach((member) => {
            member.weeklyWage = member.wageExempt ? 0 : temporaryGuildWeeklyWage(member);
        });
    }
    if (!['lobby', 'playerSetup', 'prologue'].includes(state.view)) completeGuildDispatches(state);
    if (state.view === 'guild') {
        ensureGuildMembers();
        if (!state.guildMembers.some((member) => member.id === state.guildSecretaryId)) state.guildSecretaryId = state.guildMembers[0]?.id || null;
    }
    renderScene();
    renderGuildDispatchResults();
    applyTutorialGuide();
    renderGuildProgressPopup();
    gameViewport.syncBackground();
    warmNextSceneImages();
    popupPresentation.sync();
    const dialogue = state.view === 'plaza' && !state.plazaGuildSelectionOpen ? getActivePlazaDialogue() : null;
    let sceneKey = '';
    let contentKey = '';
    let sound = 'appear';
    if (state.view === 'plaza' && state.plazaGuildSelectionOpen) {
        sceneKey = 'plaza:guild-selection';
    } else if (dialogue) {
        sceneKey = `dialogue:${dialogue.dialogue.id}`;
        contentKey = `${sceneKey}:${state.activePlazaDialogue.nodeId}`;
    } else if (state.view === 'plaza' && state.plazaCurrentOffer) {
        sceneKey = `offer:${state.week}:${state.plazaCurrentOffer.id}`;
        sound = 'step';
    } else if (state.view === 'expedition' && state.mode === 'combat') {
        sceneKey = `monsters:${state.room}:${state.enemies.map((enemy) => enemy.id).join(',')}`;
        sound = 'step';
    } else if (state.view === 'characterCodex') {
        sceneKey = `codex:${state.characterCodexTab}:${state.catalogSelectedRosterId}`;
        contentKey = `${sceneKey}:${state.catalogLevel}`;
    } else if (state.view === 'guild') {
        sceneKey = `guild:${state.guildRoom}`;
        sound = 'step';
    }
    updateScenePresentation(game, {
        sceneKey, contentKey: contentKey || sceneKey, sound,
        images: [...game.querySelectorAll('.codex-character-art-mask, .plaza-dialogue-character-fallback, .enemy, .plaza-encounter-art')],
        information: [...game.querySelectorAll('.plaza-encounter-info, .plaza-encounter-skills, .plaza-dialogue-bubble, .plaza-monologue-text, .plaza-dialogue-options, .enemy-name, .enemy-hp, .enemy-health, .enemy .combat-statuses')],
    });
}

function warmNextSceneImages() {
    if (navigator.connection?.saveData) return;
    const urls = [];
    if (state.view === 'lobby' || state.view === 'playerSetup') urls.push(`/assets/backgrounds/${tutorialPrologue[0].background}`);
    if (state.view === 'prologue') {
        const current = tutorialPrologue[state.prologueIndex]?.background;
        const next = tutorialPrologue.slice(state.prologueIndex + 1).find(scene => scene.background !== current);
        urls.push(next ? `/assets/backgrounds/${next.background}` : '/assets/backgrounds/town-square.webp');
    }
    if (state.view === 'plaza') urls.push(`/assets/backgrounds/guild-lobby-${state.guildLobbyBackground || 1}.webp`);
    if (state.view === 'guild') urls.push('/assets/backgrounds/town-square.webp', '/assets/backgrounds/guild-war-room-1.webp');
    const destination = state.regularSelectedDestination;
    if (destination && ['plaza', 'expeditionSelect'].includes(state.view)) {
        urls.push(...monsterDefinitions.filter(monster => monster.location === destination.location && monster.subregion === destination.subregion).map(monster => monster.portraitSrc));
    }
    warmImages(urls);
}

function renderScene() {
    if (state.view !== 'expedition' || state.ended) retreatDialogOpen = false;
    if (state.view === 'expedition' && state.mode === 'combat') void battleEffects.preload();
    else { battleEffects.clear(); clearTimeout(combatEndTimer); combatEndTimer = null; }
    syncBackgroundMusic();
    if (state.view === 'prologue') return renderTutorialPrologue();
    if (state.view === 'lobby') return renderLobby();
    if (state.view === 'playerSetup') return renderPlayerSetup();
    if (state.view === 'skillEditor' && import.meta.env.DEV) return renderDeveloperSkillEditor();
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
    if (state.view === 'expeditionSelect') {
        saveGame();
        return renderRegularDestinationSelection();
    }
    if (state.view === 'guild') {
        saveGame();
        return renderGuild();
    }
    normalizeCombatState();
    saveGame();
    const tutorialBattle = state.tutorial?.stage === 'battle';
    const room = tutorialBattle ? { name: '북부', type: '전투' } : rooms[Math.min(state.room, rooms.length - 1)];
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
            ${playerProfileMarkup()}
            <div class="topbar-menu-actions">${gameMenuButtonsMarkup()}</div>
        </header>

        <section class="journey-strip" aria-label="원정 진행도">
            <div class="journey-label location-heading"><strong>${tutorialBattle ? '온바람 평야' : escapeHtml(state.expeditionDestination?.name || '지하 묘지')} - ${room.name}${encounter ? ' - 전투' : ''}</strong></div>
            <div class="journey-track"><div class="journey-fill" style="width:${tutorialBattle ? 0 : progress}%"></div>${(tutorialBattle ? [room] : rooms).map((item, index) => `<span class="journey-node ${index < state.room ? 'passed' : ''} ${index === state.room ? 'current' : ''} ${item.type === '보스' ? 'boss-node' : ''}" style="left:${tutorialBattle ? 0 : (index / (rooms.length - 1)) * 100}%" title="${item.name}"></span>`).join('')}</div>
        </section>

        <section class="scene ${encounter ? 'in-combat' : ''}" aria-label="던전 장면">
            <div class="dungeon-art ${encounter ? 'battle-art' : ''}${tutorialBattle ? ' tutorial-battle-art' : ''}">
                ${encounter ? `<div class="enemy-line ${state.enemyPhase ? 'enemy-phase' : ''} ${choosingEnemy ? 'choosing-target' : ''}">${state.enemies.map(enemyMarkup).join('')}</div>` : `<div class="scene-caption"><span>${goldTextMarkup(state.message)}</span></div>`}
                ${state.skillNotice && Date.now() - state.skillNotice.startedAt < 1800 ? `<div class="skill-announce" style="animation-delay:-${Date.now() - state.skillNotice.startedAt}ms">${escapeHtml(state.skillNotice.name)}</div>` : ''}
            </div>
        </section>

        <section class="lower-grid">
            <section class="party-panel"><div class="panel-heading"><div><h2>원정대 <small>${party.length}/${maxPartySize}</small></h2></div>${partyPowerMarkup(party)}</div><div class="party-list ${choosingAlly ? 'choosing-ally' : ''}">${party.map(heroMarkup).join('')}${Array.from({ length: Math.max(0, maxPartySize - party.length) }, emptyPartySlotMarkup).join('')}</div></section>
            <aside class="action-panel ${encounter && !state.enemyPhase ? 'is-hero-turn' : ''}"><div class="panel-heading"><div><h2>${encounter ? (!state.enemyPhase && currentHero ? `${escapeHtml(currentHero.name)}의 스킬` : '스킬') : '원정 일지'}</h2></div></div>
                ${encounter ? `<div class="action-buttons ${state.enemyPhase ? '' : selectedTargetType === 'enemy' || selectedTargetType === 'ally' ? 'choosing-target' : 'choosing-skill'}">${currentSkills.map((skill) => { const cooldown = currentHero.cooldowns?.[skill.id] || 0; const [glyph, tint] = skillGlyph(skill); return `<button class="combat-action ${state.selectedSkill === skill.id ? 'selected' : ''} ${cooldown ? 'on-cooldown' : ''}" data-action="skill" data-skill="${skill.id}" aria-label="${escapeHtml(skill.name)}" ${currentHero.hp <= 0 || state.enemyPhase || cooldown > 0 ? 'disabled' : ''}>${skillIconMarkup(skill, 'combat-skill-icon')}<span class="combat-skill-name">${escapeHtml(skill.name)}</span>${cooldown ? '<small class="combat-skill-cooldown">대기</small>' : ''}${skillTooltip(skill, currentHero)}</button>`; }).join('')}${!currentSkills.length ? `<button data-action="combat-wait" ${state.enemyPhase ? 'disabled' : ''}>대기</button>` : ''}</div><p class="target-hint">${state.enemyPhase ? '적의 기술을 기다리십시오.' : selectedSkill && selectedTargetType === 'ally' ? `${selectedSkill.name} · 아군 대상을 선택하십시오.` : selectedSkill && selectedTargetType === 'enemy' ? `${selectedSkill.name} · 적 대상을 선택하십시오.` : '먼저 사용할 기술을 선택하십시오.'}</p>` : `<div class="journal-list"><p>${goldTextMarkup(state.message)}</p></div><button class="continue-button" data-action="advance" ${state.ended ? 'disabled' : ''}>${state.ended ? '원정 종료' : room.type === '보스' ? '최후의 문을 열기' : '다음 방으로 이동'}<span>→</span></button>`}
            </aside>
        </section>
        ${gameFooterMarkup()}
        ${state.expeditionResult ? expeditionResultMarkup(state.expeditionResult) : state.ended ? `<div class="end-overlay"><div class="end-dialog"><span class="section-kicker">원정 결과</span><h2>${state.mode === 'victory' ? '던전 정복' : '원정의 끝'}</h2><p>${state.message}</p><button data-action="restart">새 원정 시작 <span>→</span></button></div></div>` : ''}
        ${gameMenuMarkup()}
    `;
    if (state.expeditionResult) animateExpeditionResults();
}

function startEncounter(boss = false) {
    const enemies = monstersForEncounter(boss);
    if (!enemies.length) {
        state.message = '이 구역에 활성화된 몬스터가 없습니다. 개발자 자료실에서 몬스터를 활성화해 주세요.';
        render();
        return;
    }
    state.mode = 'combat';
    state.turn = -1;
    state.enemyPhase = false;
    state.actingEnemy = -1;
    state.enemyAttackLanded = false;
    state.selectedSkill = null;
    state.enemies = enemies;
    if (state.tutorial?.stage === 'battle') {
        const enemy = state.enemies[0];
        enemy.stats = Object.fromEntries(Object.keys(enemy.stats).map(key => [key, 1]));
        enemy.hp = enemy.maxHp = 1;
        enemy.effects = [];
        state.enemies = [enemy];
    }
    state.turnOrder = [];
    state.turnOrderIndex = 0;
    state.message = boss ? '깊은 곳에서 무언가 깨어났습니다.' : '적들이 어둠 속에서 달려듭니다.';
    addLog(`${boss ? '잊힌 선조' : '적'}과 조우했습니다.`);
    void activateNextCombatant();
}

function presentCombatEnd(action) {
    if (combatEndTimer !== null) return;
    if (!battleEffects.hasPending()) return action();
    // Let the final impact play on its target before replacing the battle scene.
    combatEndTimer = setTimeout(() => {
        combatEndTimer = null;
        if (state.view === 'expedition' && state.mode === 'combat') action();
    }, 1100);
    render();
}

function checkParty() {
    if (party.every((hero) => hero.hp <= 0)) {
        presentCombatEnd(() => showExpeditionResult(false, true));
        return true;
    }
    return false;
}

function finishEncounter(presented = false) {
    if (!presented) return presentCombatEnd(() => finishEncounter(true));
    if (state.tutorial?.stage === 'battle') return showExpeditionResult(true);
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

function normalizedCombatEffect(effect) {
    const normalized = normalizeCombatEffect(effect);
    return { ...normalized, name: effect.name || effectLabels[effect.type]?.(effect) || normalized.code };
}

function statusEffectsMarkup(actor, showSlots = false) {
    const effects = (actor.effects || []).filter((effect) => effect.turnsRemaining > 0 || effect.code === 'INJURY');
    if (!effects.length && !showSlots) return '';
    return `<div class="combat-statuses">${effects.map((effect) => {
        const rule = catalogData.effects.find((item) => item.code === effect.code);
        const name = effect.name || rule?.name || effect.code;
        const value = effectMagnitude({ ...effect, unit: effect.unit ?? rule?.unit ?? '', value: Number(effect.value ?? 0) }, 'ko') || String(effect.value ?? 0);
        const turns = effect.turnsRemaining > 0 ? `${effect.turnsRemaining}턴` : '지속';
        const icon = statusEffectIcons[effect.code] || '/assets/icons/skill_icon.svg';
        return `<span class="combat-status ${escapeHtml(effect.category || 'status')}" tabindex="0" data-status-name="${escapeHtml(name)}" data-status-value="${escapeHtml(value)}" data-status-turns="${escapeHtml(turns)}" aria-label="${escapeHtml(name)} · ${escapeHtml(value)} · ${escapeHtml(turns)}"><img src="${icon}" alt="" aria-hidden="true"><small>${effect.turnsRemaining > 0 ? effect.turnsRemaining : '∞'}</small></span>`;
    }).join('')}${showSlots ? Array.from({ length: Math.max(0, 4 - effects.length) }, () => '<span class="combat-status-empty" aria-hidden="true"></span>').join('') : ''}</div>`;
}

function characterThumbnailMarkup(character, className) {
    const src = characterImageSource(character, true);
    return src
        ? `<img class="${className}" src="${src}" alt="${escapeHtml(character.name)}" draggable="false">`
        : catalogIconMarkup(character.mark, elementTints[character.element] || '#a99060', character.name, className);
}

function combatHealthMarkup(actor, className) {
    const maxHp = Math.max(1, Number(actor.maxHp) || 1);
    const hp = Math.max(0, Math.min(maxHp, Number(actor.hp) || 0));
    const active = (actor.effects || []).filter((effect) => effect.turnsRemaining > 0);
    const shield = active.filter((effect) => effect.code === 'BARRIER').reduce((max, effect) => Math.max(max, Number(effect.shield) || 0), 0);
    const recovery = hp <= 0 || active.some((effect) => effect.code === 'HEAL_BLOCK') ? 0 : Math.min(maxHp - hp, active.filter((effect) => effect.code === 'CONTINUOUS_HEAL').reduce((sum, effect) => sum + maxHp * (Number(effect.value) || 0), 0));
    const capacity = maxHp + shield;
    return `<div class="meter ${className}" aria-label="체력 ${hp}/${maxHp}, 보호막 ${shield}, 지속 회복 ${recovery}"><span class="health-current" style="width:${hp / capacity * 100}%"></span><span class="health-recovery" style="left:${hp / capacity * 100}%;width:${recovery / capacity * 100}%"></span><span class="health-shield" style="left:${maxHp / capacity * 100}%;width:${shield / capacity * 100}%"></span></div>`;
}

function gameMenuButtonsMarkup() {
    const leadingButton = state.view === 'expedition'
        ? state.ended ? '' : `<button class="game-menu-button retreat-menu-button" type="button" data-action="retreat" aria-label="원정 포기" title="원정 포기" ${combatEndTimer !== null ? 'disabled' : ''}><img src="/assets/icons/flag_icon.svg" alt="" aria-hidden="true"></button>`
        : state.view === 'guild' ? '' : `<button class="game-menu-button guild-menu-button" type="button" data-action="guild-open" aria-label="길드" title="길드" ${state.view !== 'plaza' ? 'disabled' : ''}><span class="guild-emblem-icon" aria-hidden="true"></span></button>`;
    return `${leadingButton}<button class="game-menu-button" type="button" data-action="game-menu-open" aria-label="메뉴" title="메뉴">☰</button>`;
}

let guildDispatchDialogOpen = false;
let guildDispatchDetailId = '';

// Temporary payroll matches the recruitment price for each grade.
function temporaryGuildWeeklyWage(member) {
    return hirePrices[member.grade] ?? 30;
}

function ensureGuildMembers() {
    if (!Array.isArray(state.guildMembers)) state.guildMembers = [];
    if (!Array.isArray(state.guildDispatchMemberIds)) state.guildDispatchMemberIds = [];
    if (!Array.isArray(state.guildDispatches)) state.guildDispatches = [];
    state.guildDispatchMemberIds = [...new Set(state.guildDispatchMemberIds)].filter((id) => state.guildMembers.some((member) => member.id === id) && !activeGuildDispatch(state, id)).slice(0, maxPartySize);
}

function guildDispatchMembersMarkup({ normalParty = false } = {}) {
    const dispatchFull = !normalParty && state.guildDispatches.filter((dispatch) => dispatch.status === 'active').length >= MAX_ACTIVE_GUILD_DISPATCHES;
    const normalIds = new Set(state.recruits.map((member) => member.id));
    const selectedIds = normalParty ? normalIds : new Set(state.guildDispatchMemberIds);
    return `<section class="guild-dispatch-members" aria-label="${normalParty ? '길드원 선발' : '파견 원정대원 선택'}"><div class="codex-roster-heading"><h2>길드원 목록</h2><span>${state.guildMembers.length}명 · 선발 ${selectedIds.size}/${maxPartySize}</span></div><div class="guild-dispatch-member-grid">${state.guildMembers.map((member) => {
        const selected = selectedIds.has(member.id);
        const dispatch = activeGuildDispatch(state, member.id);
        const inNormalParty = normalIds.has(member.id);
        const unavailable = normalParty ? !selected && state.guildDispatchMemberIds.includes(member.id) : inNormalParty;
        const remainingWeeks = dispatch ? Math.max(0, dispatch.returnWeek - state.week) : 0;
        const selectionLabel = unavailable ? (normalParty ? '파견 선발 중' : '원정대 선발 중') : dispatch ? `파견 중 - ${remainingWeeks}주` : selected ? '선발 취소' : dispatchFull ? '파견 한도 초과' : normalParty ? '원정 대원 선발' : '파견 원정 선발';
        const full = selectedIds.size >= maxPartySize;
        return `<article class="codex-character-card guild-dispatch-member-card ${selected ? 'active' : ''}"><button class="guild-dispatch-thumbnail" type="button" data-action="${normalParty ? 'plaza-guild-codex' : 'guild-dispatch-codex'}" data-member-id="${escapeHtml(member.id)}" aria-label="${escapeHtml(member.name)} 도감 보기"><span class="codex-character-frame element-border-${elementBorderClasses[member.element] || 'light'}">${characterThumbnailMarkup(member, 'codex-character-thumb')}</span>${inNormalParty ? '<img class="guild-dispatch-selected-flag" src="/assets/icons/party_icon.svg" alt="원정대 선발">' : selected || dispatch ? '<img class="guild-dispatch-selected-flag" src="/assets/icons/flag_icon.svg" alt="파견 원정대 선발">' : ''}</button><span class="codex-character-name" title="${escapeHtml(member.name)}">${jobGlyphs[member.job] ? `<img class="guild-dispatch-job-icon" src="${jobGlyphs[member.job]}" alt="${escapeHtml(member.job)}" title="${escapeHtml(member.job)}" draggable="false">` : ''}<span class="guild-dispatch-member-name">${escapeHtml(member.name)}</span></span><button class="guild-dispatch-select ${dispatch ? 'is-away' : selected ? 'is-cancel' : dispatchFull ? 'is-dispatch-full' : ''}" type="button" data-action="${normalParty ? 'plaza-guild-toggle' : 'guild-dispatch-toggle'}" data-member-id="${escapeHtml(member.id)}" aria-pressed="${selected}" aria-label="${escapeHtml(member.name)} ${selectionLabel}" ${unavailable || dispatch || !selected && (full || dispatchFull) ? 'disabled' : ''}>${selectionLabel}</button></article>`;
    }).join('')}</div></section>`;
}

function partyPowerMarkup(members) {
    return `<span class="guild-dispatch-power"><img src="/assets/icons/battle_icon.svg" alt="" aria-hidden="true"><span><span class="guild-dispatch-power-label">원정대 전투력</span> ${guildDispatchPower(members).toLocaleString('ko-KR')}</span></span>`;
}

function guildDispatchPartyMarkup() {
    const members = state.guildDispatchMemberIds.map((id) => state.guildMembers.find((member) => member.id === id)).filter(Boolean);
    const power = guildDispatchPower(members);
    return `<section class="party-panel plaza-roster guild-dispatch-party"><div class="panel-heading"><div><h2>파견 원정대 <small>${members.length}/${maxPartySize}</small></h2></div><span class="guild-dispatch-power"><img src="/assets/icons/battle_icon.svg" alt="" aria-hidden="true"><span><span class="guild-dispatch-power-label">원정대 전투력</span> ${power.toLocaleString('ko-KR')}</span></span></div><div class="party-list plaza-party-list">${members.map((member, index) => heroMarkup({ ...member, hp: member.hp ?? member.stats.maxHp, maxHp: member.maxHp ?? member.stats.maxHp, effects: member.effects || [] }, index, { dispatchControls: true })).join('')}${Array.from({ length: Math.max(0, maxPartySize - members.length) }, emptyPartySlotMarkup).join('')}</div></section>`;
}

function renderGuildDispatchResults() {
    if (['lobby', 'playerSetup', 'prologue'].includes(state.view) || state.pendingLevelUp) return;
    const markup = guildDispatchResultsMarkup(state, guildDestinations, characterThumbnailMarkup);
    if (!markup) return;
    game.insertAdjacentHTML('beforeend', markup);
    for (const child of game.children) if (!child.classList.contains('guild-dispatch-results-backdrop')) child.inert = true;
    game.querySelector('[data-action="guild-dispatch-results-confirm"]')?.focus();
}

function confirmGuildDispatchResults() {
    const ids = [...game.querySelectorAll('[data-dispatch-result-id]')].map((card) => card.dataset.dispatchResultId);
    acknowledgeGuildDispatchResults(state, ids);
    render();
    const nextAction = game.querySelector('.plaza-confirm-overlay [data-action="plaza-dialog-confirm"]')
        || game.querySelector('[data-action="plaza-rest"]') || game.querySelector('[data-action="guild-expedition-prepare"]');
    nextAction?.focus({ preventScroll: true });
}

function currentGuildDispatchPlan() {
    const plan = guildDispatchPlan(state, guildDestinations, maxPartySize);
    if (!plan || !guildDestinationUnlocked(plan.destination.location, state.guildClearedDestinations, guildTestUnlock)) return null;
    if (!guildTestUnlock && plan.destination.subregion !== plan.location.subregions[0][0]) return null;
    return plan;
}

function guildDispatchDialogMarkup() {
    if (!guildDispatchDialogOpen && !guildDispatchDetailId) return '';
    const dispatch = guildDispatchDetailId ? state.guildDispatches.find((item) => item.id === guildDispatchDetailId && item.status === 'active') : null;
    const plan = dispatch ? {
        ...dispatch, bonusChance: dispatch.bonusChance || 0,
        location: guildDestinations[dispatch.destination.location],
        members: dispatch.memberSnapshots || dispatch.memberIds.map((id) => state.guildMembers.find((member) => member.id === id)).filter(Boolean),
    } : guildDispatchDetailId ? null : currentGuildDispatchPlan();
    if (!plan || !plan.location) { guildDispatchDialogOpen = false; guildDispatchDetailId = ''; return ''; }
    return `<div class="guild-dispatch-dialog-backdrop"><section class="guild-dispatch-dialog" role="dialog" aria-modal="true" aria-labelledby="guild-dispatch-title" aria-describedby="guild-dispatch-description" tabindex="-1"><header><h2 id="guild-dispatch-title">${dispatch ? '진행 중인 파견 원정' : '파견 원정'}</h2><p id="guild-dispatch-description">${dispatch ? `${dispatch.startedWeek}주차에 출발한 대원 ${plan.members.length}명이 원정을 진행 중입니다. ${dispatch.returnWeek}주차 복귀 예정입니다.` : '파견 원정은 마스터가 직접 전투를 지휘하지 않으며, 선발 대원이 파견되어 원정을 진행 합니다.'}</p></header><div class="guild-dispatch-dialog-content"><section class="guild-dispatch-destination-summary"><img class="guild-dispatch-destination-image" src="/assets/backgrounds/${plan.location.background}.webp" alt="${escapeHtml(plan.location.name)}"><h3>${escapeHtml(plan.destination.name)}</h3><p>${escapeHtml(plan.location.description)}</p><div class="guild-dispatch-summary-line"><span>권장 원정대 전투력</span><strong>${plan.recommendedPower.toLocaleString('ko-KR')}</strong></div></section><section class="guild-dispatch-team-summary"><h3>파견 원정대원 <small>${plan.members.length}명</small></h3><div class="guild-dispatch-dialog-members">${plan.members.map((member) => `<article><span class="guild-dispatch-dialog-thumb">${characterThumbnailMarkup(member, 'codex-character-thumb')}</span><strong>${escapeHtml(member.name)}</strong><span>${escapeHtml(member.job)} · Lv.${member.level} · ${member.grade}등급</span></article>`).join('')}</div><div class="guild-dispatch-summary-line"><span><img src="/assets/icons/battle_icon.svg" alt="" aria-hidden="true">원정대 전투력</span><strong>${plan.power.toLocaleString('ko-KR')}</strong></div><div class="guild-dispatch-highlights"><div><span>${dispatch ? '남은 소요시간' : '소요시간'}</span><strong>${dispatch ? Math.max(0, dispatch.returnWeek - state.week) : plan.weeks}주</strong><small>${dispatch ? dispatch.returnWeek : state.week + plan.weeks}주차 복귀 예정</small></div><div><span>성공 보수</span><strong class="guild-dispatch-gold-reward"><img src="/assets/icons/coin_pouch_icon.svg" alt="" aria-hidden="true">골드 ${plan.gold.toLocaleString('ko-KR')}</strong><strong class="guild-dispatch-fame-reward"><img src="/assets/icons/fame_icon.svg" alt="" aria-hidden="true">명성 ${plan.fame}</strong></div><div><span>예상 성공 확률</span><strong>${Math.round(plan.successChance * 10) / 10}%</strong><small>보너스 +${plan.bonusChance}%p</small></div></div></section></div><footer>${dispatch ? '<button type="button" data-action="guild-dispatch-detail-close">닫기</button>' : '<button type="button" class="guild-dispatch-approve" data-action="guild-dispatch-approve">파견 승인</button><button type="button" data-action="guild-dispatch-cancel">취소</button>'}</footer></section></div>`;
}

function regularDepartureStatus() {
    const selected = state.regularSelectedDestination;
    const available = selected && guildDestinationUnlocked(selected.location, state.guildClearedDestinations, guildTestUnlock)
        && (guildTestUnlock || selected.subregion === guildDestinations[selected.location]?.subregions[0][0]);
    return regularExpeditionPreparation({ ...state, regularSelectedDestination: available ? selected : null }, guildDestinations);
}

function destinationMonsterMarkup(detail, subregion) {
    return guildDestinationMonsterIds(detail, subregion, guildTestUnlock).map((id) => catalogData.monsters.find((monster) => monster.id === id)).filter((monster) => monster && monsterEnabled(monster.id)).map(developerMonster).map((monster, index) => `<button class="guild-destination-monster" type="button" data-action="guild-destination-monster" data-monster-id="${monster.id}" aria-label="${escapeHtml(monster.name)} 도감 보기"><div class="guild-destination-monster-art"><span class="roster-avatar-frame element-border-${elementBorderClasses[monster.element] || 'light'}" title="${escapeHtml(monster.element)} 속성">${catalogIconMarkup(monster.thumbnailSrc || monster.mark, elementTints[monster.element] || '#a6d7e8', monster.name, 'guild-destination-monster-thumbnail')}</span>${monster.isBoss ? '<img class="guild-destination-monster-badge" src="/assets/icons/monster_icon.svg" alt="" aria-hidden="true">' : ''}</div><span><img src="${jobGlyphs[monster.job]}" alt="${escapeHtml(monster.job)}"><strong>${escapeHtml(monster.name)}</strong></span></button>`).join('');
}

function renderRegularDestinationSelection() {
    const roster = `<section class="party-panel"><div class="panel-heading"><h2>원정대 <small>${state.recruits.length}/${maxPartySize}</small></h2>${partyPowerMarkup(state.recruits)}</div><div class="party-list">${state.recruits.map((member, index) => heroMarkup(member, index, { readOnly: true })).join('')}${Array.from({ length: Math.max(0, maxPartySize - state.recruits.length) }, emptyPartySlotMarkup).join('')}</div></section>`;
    const page = guildPageMarkup({
        room: 'strategy', expeditionPreparation: true, regularExpedition: true,
        week: state.week, goldMarkup: goldAmountMarkup(state.gold), fameMarkup: fameAmountMarkup(state.fame),
        destinationDetail: state.regularDestinationDetail, activeSubregion: state.regularDestinationSubregion,
        selectedDestination: regularDepartureStatus().destination, testUnlock: guildTestUnlock,
        monsterMarkup: destinationMonsterMarkup(state.regularDestinationDetail, state.regularDestinationSubregion),
        dispatchPartyMarkup: roster,
    });
    game.innerHTML = `<div class="plaza-page-background" aria-hidden="true"></div><header class="topbar plaza-topbar">${playerProfileMarkup()}<div class="topbar-menu-actions">${gameMenuButtonsMarkup()}</div></header>${page}${gameFooterMarkup()}${gameMenuMarkup()}`;
    if (state.regularMapFocusedRegion && !state.regularDestinationDetail) focusGuildMap(game, state.regularMapFocusedRegion, { animate: false, clearedDestinations: state.guildClearedDestinations, testUnlock: guildTestUnlock });
    if (state.regularDestinationDetail) {
        fitDestinationMonsterNames(game);
        void document.fonts.ready.then(() => fitDestinationMonsterNames(game));
    }
}

function renderGuild() {
    ensureGuildMembers();
    const memberCount = Array.isArray(state.guildMembers) ? state.guildMembers.length : 0;
    const page = guildPageMarkup({
        room: state.guildRoom,
        expeditionPreparation: state.guildExpeditionPreparation,
        researchOpen: state.guildResearchOpen,
        gold: state.gold,
        foundingResearch: state.tutorial?.stage === 'rent' || state.tutorial?.stage === 'rent-popup',
        expeditionStep: state.guildExpeditionStep,
        background: state.guildLobbyBackground,
        goldMarkup: goldAmountMarkup(state.gold),
        fameMarkup: fameAmountMarkup(state.fame),
        week: Number(state.week) || 1,
        memberCount,
        lobbyMarkup: guildLobbyMarkup(state, characterImageSource(state.guildMembers.find((member) => member.id === state.guildSecretaryId))),
        membersMarkup: guildDispatchMembersMarkup(),
        dispatchPartyMarkup: guildDispatchPartyMarkup(),
        selectedMemberCount: state.guildDispatchMemberIds.length,
        canDispatch: Boolean(currentGuildDispatchPlan()),
        dispatches: state.guildDispatches,
        destinationDetail: state.guildDestinationDetail,
        selectedDestination: state.guildSelectedDestination,
        testUnlock: guildTestUnlock,
        activeSubregion: state.guildDestinationSubregion,
        monsterMarkup: destinationMonsterMarkup(state.guildDestinationDetail, state.guildDestinationSubregion),
    });
    game.innerHTML = `<div class="guild-page-background" aria-hidden="true"></div><header class="topbar plaza-topbar guild-topbar">${playerProfileMarkup()}<div class="topbar-menu-actions">${gameMenuButtonsMarkup()}</div></header>${page}${gameFooterMarkup()}${gameMenuMarkup()}${guildDispatchDialogMarkup()}`;
    if (guildDispatchDialogOpen || guildDispatchDetailId) {
        for (const child of game.children) if (!child.classList.contains('guild-dispatch-dialog-backdrop')) child.inert = true;
        game.querySelector(guildDispatchDetailId ? '[data-action="guild-dispatch-detail-close"]' : '[data-action="guild-dispatch-approve"]')?.focus();
    }
    const showingMembers = state.guildExpeditionPreparation && state.guildExpeditionStep === 'members';
    if (!showingMembers && state.guildMapFocusedRegion && !state.guildDestinationDetail) focusGuildMap(game, state.guildMapFocusedRegion, { animate: false, clearedDestinations: state.guildClearedDestinations, testUnlock: guildTestUnlock });
    if (!showingMembers && state.guildDestinationDetail) {
        fitDestinationMonsterNames(game);
        void document.fonts.ready.then(() => fitDestinationMonsterNames(game));
    }
}

function moveBetweenPlazaAndGuild(view) {
    if (locationTransition.isRunning()) return;
    gameMenuOpen = false;
    gameMenuNotice = '';
    state.guildRoom = 'lobby';
    state.guildExpeditionPreparation = false;
    state.guildMapFocusedRegion = '';
    state.guildDestinationDetail = '';
    if (state.view === view) return render();
    plazaTransitionPhase = '';
    void locationTransition.run(() => {
        state.view = view;
        render();
    }).catch((error) => console.warn('Location transition could not be played.', error));
}

function playerProfileMarkup() {
    const experiencePercent = Math.min(100, Math.max(0, state.experience / state.experienceToNextLevel * 100));
    return `<div class="player-profile"><img class="player-avatar" src="${playerThumbnailAsset}" alt="" aria-hidden="true" draggable="false"><div class="player-profile-name">${playerZodiacIconMarkup() || '<span class="player-zodiac-mark" aria-hidden="true"></span>'}<strong>${escapeHtml(state.playerName)}</strong><span>Lv.${state.userLevel}</span><label class="player-test-unlock" title="테스트: 모든 세부지역 잠금 해제"><input type="checkbox" data-guild-test-unlock aria-label="테스트: 모든 세부지역 잠금 해제" ${guildTestUnlock ? 'checked' : ''}></label></div><div class="player-experience"><div><span>경험치</span><strong>${state.experience}/${state.experienceToNextLevel}</strong></div><div class="plaza-exp-track"><span style="width:${experiencePercent}%"></span></div></div></div>`;
}

function gameFooterMarkup() {
    return '<footer class="bottom-note"><span>V 0.0.1</span><span>HELLO GUILD MASTER</span></footer>';
}

function emptyPartySlotMarkup() {
    return '<article class="hero plaza-empty-hero"><span class="plaza-empty-avatar" aria-hidden="true">◇</span><span class="plaza-empty-label">빈 자리</span></article>';
}

const { combatStat, hasCombatEffect, combatTargets, skillHasDamage, beginNaturalTurn, finishNaturalTurn, executeCombatSkill } = createCombatEngine({
    get party() { return party; }, state, normalizedCombatEffect, showCombatNumber, playWebSound,
    onEffect: (target, effect) => battleEffects.effect(target, effect),
    onImpact: (target, kind, code) => battleEffects.impact(target, kind, code),
});

function combatResultText(result) {
    const parts = [];
    if (result.damage > 0) parts.push(`${result.damage} 피해`);
    if (result.healing > 0) parts.push(`생명력 ${result.healing} 회복`);
    return parts.join(', ') || '효과를 사용했습니다';
}


async function enemyTurn() {
    const enemyIndex = state.actingEnemy;
    const enemy = state.enemies[enemyIndex];
    if (!enemy || enemy.hp <= 0) return advanceCombatTurn();
    let extraAction = true;
    while (extraAction && enemy.hp > 0) {
        extraAction = false;
        enemy.effects = (enemy.effects || []).filter((effect) => effect.code !== 'PROVOKE' || party.some((hero) => hero.hp > 0 && hero.id === effect.sourceId));
        const enemySkills = battleSkillsFor(enemy);
        if (!enemySkills.length) { addLog(`${enemy.name}은 사용할 수 있는 스킬이 없어 대기합니다.`); break; }
        const availableSkills = enemySkills.filter((skill) => (enemy.cooldowns?.[skill.id] || 0) <= 0);
        const taunt = enemy.effects.find((effect) => effect.code === 'PROVOKE' && effect.turnsRemaining > 0);
        const provokedIndex = taunt ? party.findIndex((hero) => hero.id === taunt.sourceId && hero.hp > 0) : -1;
        const attackSkills = availableSkills.filter((skill) => ['enemy', 'enemyAll'].includes(battleTargetFor(skill)) && skillHasDamage(skill));
        const basicAttack = enemySkills.find((skill) => skill.isBasicAttack) || enemySkills[0];
        const skillPool = provokedIndex >= 0 ? (attackSkills.length ? attackSkills : [basicAttack]) : availableSkills.length ? availableSkills : [basicAttack];
        const skill = skillPool[Math.floor(Math.random() * skillPool.length)];
        await wait(2000);
        while (retreatDialogOpen && state.view === 'expedition' && state.mode === 'combat') await wait(100);
        if (state.view !== 'expedition' || state.mode !== 'combat' || state.ended || state.enemies[enemyIndex] !== enemy) return;
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
    while (retreatDialogOpen && state.view === 'expedition' && state.mode === 'combat') await wait(100);
    if (state.view !== 'expedition' || state.mode !== 'combat' || state.ended || state.enemies[enemyIndex] !== enemy) return;
    advanceCombatTurn();
}

function selectSkill(skillId) {
    if (state.mode !== 'combat' || state.enemyPhase || combatEndTimer !== null || retreatDialogOpen) return;
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
    if (retreatDialogOpen) return;
    if (state.mode !== 'explore' || state.ended) return;
    playWebSound('travel', 1);
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
    if (event.pointerType !== 'mouse') return;
    const button = event.target.closest('button');
    if (!button || button.disabled || event.relatedTarget && button.contains(event.relatedTarget)) return;
    playWebSound('hover');
});

game.addEventListener('click', (event) => {
    if (locationTransition.isRunning()) {
        event.preventDefault();
        return;
    }
    if (event.target.closest('[data-action="guild-dispatch-results-confirm"]')) {
        confirmGuildDispatchResults();
        return;
    }
    if (game.querySelector('.guild-dispatch-results-backdrop')) return;
    if (event.target.closest('.combat-status, .combat-status-popup')) return;
    const skillEdit = event.target.closest('[data-skill-edit]');
    if (skillEdit && import.meta.env.DEV) {
        developerEditingSkillId = skillEdit.dataset.skillEdit;
        state.view = 'skillEditor';
        render();
        return;
    }
    const monsterEditButton = event.target.closest('[data-monster-edit]');
    if (monsterEditButton && import.meta.env.DEV) {
        openDeveloperCharacterEditor(monsterEditButton.dataset.monsterEdit, true);
        return;
    }
    const editButton = event.target.closest('[data-character-edit]');
    if (editButton && import.meta.env.DEV) {
        openDeveloperCharacterEditor(editButton.dataset.characterEdit);
        return;
    }
    syncBackgroundMusic();
    if (event.target.closest('button:not(:disabled), .plaza-monologue-dialogue[data-action]')) playWebSound('click');
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
    if (action === 'party-character-codex') {
        const memberId = event.target.closest('[data-member-id]')?.dataset.memberId;
        const isDispatch = state.view === 'guild' && state.guildRoom === 'strategy' && state.guildExpeditionPreparation;
        const memberIds = isDispatch ? state.guildDispatchMemberIds
            : ['plaza', 'expeditionSelect'].includes(state.view) ? state.recruits.map((member) => member.id) : [];
        if (!memberIds.includes(memberId) || !catalogData.characters.some((character) => character.id === memberId)) return;
        state.catalogReturnView = state.view;
        state.characterCodexTab = 'characters';
        state.catalogSelectedRosterId = memberId;
        state.catalogSearch = state.catalogElement = state.catalogJob = state.catalogGrade = '';
        gameMenuOpen = false;
        state.view = 'characterCodex';
        render();
        return;
    }
    const regularSelection = state.view === 'expeditionSelect';
    const destinationSelectionAllowed = regularSelection || (state.view === 'guild' && state.guildRoom === 'strategy' && state.guildExpeditionPreparation);
    const destinationKeys = regularSelection
        ? { detail: 'regularDestinationDetail', subregion: 'regularDestinationSubregion', region: 'regularMapFocusedRegion', selected: 'regularSelectedDestination' }
        : { detail: 'guildDestinationDetail', subregion: 'guildDestinationSubregion', region: 'guildMapFocusedRegion', selected: 'guildSelectedDestination' };
    if (action === 'regular-destination-open') {
        if (state.view !== 'plaza' || !regularDepartureStatus().requiresDestination) return;
        state.view = 'expeditionSelect';
        state.regularMapFocusedRegion = state.regularSelectedDestination?.region || '';
        state.regularDestinationDetail = state.regularSelectedDestination?.location || '';
        state.regularDestinationSubregion = state.regularSelectedDestination?.subregion || '';
        render();
        return;
    }
    if (action === 'regular-destination-close') {
        if (!regularSelection) return;
        state.view = 'plaza';
        render();
        game.querySelector('[data-action="regular-destination-open"]')?.focus();
        return;
    }
    if (action === 'combat-wait' && state.mode === 'combat' && !state.enemyPhase && !battleSkillsFor(party[state.turn]).length) {
        finishNaturalTurn(party[state.turn]);
        advanceCombatTurn();
        return;
    }
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
    if (action === 'plaza-guild-select-open' || action === 'plaza-guild-select-close') {
        if (state.view !== 'plaza' || action === 'plaza-guild-select-open' && !hasAvailablePlazaGuildMember(state, maxPartySize)) return;
        state.plazaGuildSelectionOpen = action === 'plaza-guild-select-open';
        if (state.tutorial?.stage === 'select-open') state.tutorial.stage = 'select-companion';
        render();
        return;
    }
    if (action === 'plaza-party-swap') {
        if (state.view !== 'plaza') return;
        const memberId = event.target.closest('[data-member-id]')?.dataset.memberId;
        if (!state.recruits.some((member) => member.id === memberId && member.isGuildMember)) return;
        state.plazaGuildSelectionOpen = true;
        releaseMercenary(memberId);
        game.querySelector(`[data-action="plaza-guild-toggle"][data-member-id="${memberId}"]`)?.focus({ preventScroll: true });
        return;
    }
    if (action === 'plaza-guild-toggle') {
        if (state.view !== 'plaza' || !state.plazaGuildSelectionOpen) return;
        const memberId = event.target.closest('[data-member-id]')?.dataset.memberId;
        const scrollTop = game.querySelector('.guild-dispatch-member-grid')?.scrollTop || 0;
        if (!togglePlazaGuildMember(state, memberId, maxPartySize)) return;
        if (state.tutorial?.stage === 'select-companion') state.tutorial.stage = 'final-popup';
        render();
        const grid = game.querySelector('.guild-dispatch-member-grid');
        if (grid) grid.scrollTop = scrollTop;
        game.querySelector(`[data-action="plaza-guild-toggle"][data-member-id="${memberId}"]`)?.focus({preventScroll:true});
        return;
    }
    if (action === 'plaza-guild-codex') {
        if (state.view !== 'plaza' || !state.plazaGuildSelectionOpen) return;
        const memberId = event.target.closest('[data-member-id]')?.dataset.memberId;
        if (!catalogData.characters.some((member) => member.id === memberId)) return;
        state.catalogReturnView = 'plaza';
        state.characterCodexTab = 'characters';
        state.catalogSelectedRosterId = memberId;
        state.catalogSearch = state.catalogElement = state.catalogJob = state.catalogGrade = '';
        state.view = 'characterCodex';
        render();
        return;
    }
    if (action === 'tutorial-prologue-next') {
        if (state.view !== 'prologue') return;
        state.prologueIndex += 1;
        if (state.prologueIndex >= tutorialPrologue.length) state.view = 'lobby';
        render();
        return;
    }
    if (action === 'tutorial-rent') {
        if (completeTutorialRental(state, tutorialCompanionProfile())) render();
        return;
    }
    if (action === 'tutorial-confirm') {
        if (confirmTutorialMilestone(state)) {
            if (state.tutorial.stage === 'done') state.plazaOffers = drawPlazaOffers();
            render();
        }
        return;
    }
    if (action === 'guild-open') {
        if (state.tutorial?.stage === 'guild-open') {
            state.tutorial.stage = 'rent';
            state.view = 'guild';
            state.guildRoom = 'strategy';
            state.guildResearchOpen = true;
            state.guildExpeditionPreparation = false;
            render();
            return;
        }
        if (state.view !== 'plaza' && state.view !== 'guild') return;
        moveBetweenPlazaAndGuild('guild');
        return;
    }
    if (action === 'guild-room') {
        if (state.view !== 'guild') return;
        const room = event.target.closest('[data-guild-room]')?.dataset.guildRoom;
        if (!Object.hasOwn(guildRooms, room) || guildRooms[room].disabled) return;
        if (state.guildRoom === room) return;
        const changeRoom = () => {
            state.guildRoom = room;
            state.guildResearchOpen = false;
            state.guildExpeditionPreparation = false;
            state.guildMapFocusedRegion = '';
            state.guildDestinationDetail = '';
            render();
        };
        if (room === 'strategy' || state.guildRoom === 'strategy') {
            void locationTransition.run(changeRoom).catch((error) => console.warn('Guild room transition could not be played.', error));
        } else {
            changeRoom();
        }
        return;
    }
    if (action === 'guild-research') {
        if (state.view !== 'guild' || state.guildRoom !== 'strategy') return;
        state.guildResearchOpen = true;
        state.guildExpeditionPreparation = false;
        render();
        return;
    }
    if (action === 'guild-expedition-prepare') {
        if (state.view !== 'guild' || state.guildRoom !== 'strategy') return;
        state.guildResearchOpen = false;
        state.guildExpeditionPreparation = true;
        state.guildExpeditionStep = 'destination';
        state.guildMapFocusedRegion = '';
        state.guildDestinationDetail = '';
        render();
        playWebSound('travel', 1.2);
        return;
    }
    if (action === 'guild-expedition-step') {
        if (state.view !== 'guild' || state.guildRoom !== 'strategy' || !state.guildExpeditionPreparation) return;
        const step = event.target.closest('[data-expedition-step]')?.dataset.expeditionStep;
        if (!['destination', 'members'].includes(step) || state.guildExpeditionStep === step) return;
        state.guildExpeditionStep = step;
        render();
        return;
    }
    if (action === 'guild-dispatch-codex') {
        if (state.view !== 'guild' || state.guildRoom !== 'strategy' || !state.guildExpeditionPreparation || state.guildExpeditionStep !== 'members') return;
        const memberId = event.target.closest('[data-member-id]')?.dataset.memberId;
        if (!state.guildMembers.some((member) => member.id === memberId) || !catalogData.characters.some((character) => character.id === memberId)) return;
        state.catalogReturnView = 'guild';
        state.characterCodexTab = 'characters';
        state.catalogSelectedRosterId = memberId;
        state.catalogSearch = state.catalogElement = state.catalogJob = state.catalogGrade = '';
        gameMenuOpen = false;
        state.view = 'characterCodex';
        render();
        return;
    }
    if (action === 'guild-dispatch-swap') {
        if (state.view !== 'guild' || state.guildRoom !== 'strategy' || !state.guildExpeditionPreparation) return;
        const memberId = event.target.closest('[data-member-id]')?.dataset.memberId;
        if (!state.guildDispatchMemberIds.includes(memberId)) return;
        state.guildDispatchMemberIds = state.guildDispatchMemberIds.filter((id) => id !== memberId);
        state.guildExpeditionStep = 'members';
        render();
        game.querySelector(`.guild-dispatch-select[data-member-id="${memberId}"]`)?.focus({ preventScroll: true });
        return;
    }
    if (action === 'guild-dispatch-toggle') {
        if (state.view !== 'guild' || state.guildRoom !== 'strategy' || !state.guildExpeditionPreparation || state.guildExpeditionStep !== 'members') return;
        const memberId = event.target.closest('[data-member-id]')?.dataset.memberId;
        if (!state.guildMembers.some((member) => member.id === memberId) || activeGuildDispatch(state, memberId) || state.recruits.some((member) => member.id === memberId)) return;
        const selectedIndex = state.guildDispatchMemberIds.indexOf(memberId);
        if (selectedIndex >= 0) state.guildDispatchMemberIds.splice(selectedIndex, 1);
        else if (state.guildDispatches.filter((dispatch) => dispatch.status === 'active').length < MAX_ACTIVE_GUILD_DISPATCHES && state.guildDispatchMemberIds.length < maxPartySize) state.guildDispatchMemberIds.push(memberId);
        else return;
        const scrollTop = game.querySelector('.guild-dispatch-member-grid')?.scrollTop || 0;
        render();
        const grid = game.querySelector('.guild-dispatch-member-grid');
        if (grid) grid.scrollTop = scrollTop;
        game.querySelector(`[data-member-id="${memberId}"]`)?.focus({ preventScroll: true });
        return;
    }
    if (action === 'guild-dispatch-detail') {
        if (state.view !== 'guild' || state.guildRoom !== 'lobby') return;
        const dispatchId = event.target.closest('[data-dispatch-id]')?.dataset.dispatchId;
        if (!state.guildDispatches.some((dispatch) => dispatch.id === dispatchId && dispatch.status === 'active')) return;
        guildDispatchDialogOpen = false;
        guildDispatchDetailId = dispatchId;
        render();
        return;
    }
    if (action === 'guild-dispatch-detail-close') {
        const dispatchId = guildDispatchDetailId;
        guildDispatchDetailId = '';
        render();
        game.querySelector(`[data-dispatch-id="${dispatchId}"]`)?.focus({ preventScroll: true });
        return;
    }
    if (action === 'guild-dispatch-send') {
        if (state.view !== 'guild' || state.guildRoom !== 'strategy' || !state.guildExpeditionPreparation || !currentGuildDispatchPlan()) return;
        guildDispatchDialogOpen = true;
        render();
        return;
    }
    if (action === 'guild-dispatch-cancel') {
        guildDispatchDialogOpen = false;
        render();
        game.querySelector('[data-action="guild-dispatch-send"]')?.focus();
        return;
    }
    if (action === 'guild-dispatch-approve') {
        if (!guildDispatchDialogOpen || state.view !== 'guild' || !currentGuildDispatchPlan()) return;
        const dispatch = approveGuildDispatch(state, guildDestinations, maxPartySize);
        if (!dispatch) return;
        guildDispatchDialogOpen = false;
        render();
        game.querySelector('[data-action="guild-expedition-step"][data-expedition-step="members"]')?.focus();
        return;
    }
    if (action === 'guild-expedition-other') {
        if (state.view !== 'guild' || state.guildRoom !== 'strategy') return;
        state.guildExpeditionPreparation = false;
        state.guildExpeditionStep = 'destination';
        state.guildMapFocusedRegion = '';
        state.guildDestinationDetail = '';
        render();
        return;
    }
    if (action === 'guild-destination-open') {
        if (!destinationSelectionAllowed || !state[destinationKeys.region]) return;
        const destination = event.target.closest('[data-destination]')?.dataset.destination;
        if (!Object.hasOwn(guildDestinations, destination)) return;
        if (guildDestinations[destination].region !== state[destinationKeys.region]) return;
        if (!guildDestinationUnlocked(destination, state.guildClearedDestinations, guildTestUnlock)) return;
        state[destinationKeys.detail] = destination;
        state[destinationKeys.subregion] = guildDestinations[destination].subregions[0][0];
        render();
        playWebSound('click');
        return;
    }
    if (action === 'guild-destination-back') {
        if (!destinationSelectionAllowed || !state[destinationKeys.detail]) return;
        state[destinationKeys.region] = guildDestinations[state[destinationKeys.detail]].region;
        state[destinationKeys.detail] = '';
        render();
        return;
    }
    if (action === 'guild-destination-subregion') {
        if (!destinationSelectionAllowed) return;
        const location = guildDestinations[state[destinationKeys.detail]];
        const subregion = event.target.closest('[data-subregion]')?.dataset.subregion;
        const index = location?.subregions.findIndex(([id]) => id === subregion);
        if (index === undefined || index < 0 || index > 0 && !guildTestUnlock) return;
        state[destinationKeys.subregion] = subregion;
        render();
        return;
    }
    if (action === 'guild-destination-select') {
        const location = guildDestinations[state[destinationKeys.detail]];
        if (!destinationSelectionAllowed || !location) return;
        const [subregion, subregionName] = location.subregions.find(([id], index) => id === state[destinationKeys.subregion] && (guildTestUnlock || index === 0)) || location.subregions[0];
        if (!regularSelection && (state.guildDispatches.filter((dispatch) => dispatch.status === 'active').length >= MAX_ACTIVE_GUILD_DISPATCHES || guildDestinationDispatchActive(state.guildDispatches, state[destinationKeys.detail]))) return;
        const selected = state[destinationKeys.selected]?.location === state[destinationKeys.detail] && state[destinationKeys.selected]?.subregion === subregion;
        state[destinationKeys.selected] = selected ? null : { region: location.region, location: state[destinationKeys.detail], subregion, name: `${location.name} ${subregionName}` };
        if (regularSelection && !selected) state.view = 'plaza';
        render();
        playWebSound('click');
        return;
    }
    if (action === 'guild-destination-monster') {
        if (!destinationSelectionAllowed || !Object.hasOwn(guildDestinations, state[destinationKeys.detail])) return;
        const monsterId = event.target.closest('[data-monster-id]')?.dataset.monsterId;
        if (!catalogData.monsters.some((monster) => monster.id === monsterId)) return;
        state.catalogReturnView = state.view;
        state.characterCodexTab = 'monsters';
        state.catalogSelectedRosterId = monsterId;
        state.catalogSearch = state.catalogElement = state.catalogJob = state.catalogGrade = '';
        gameMenuOpen = false;
        state.view = 'characterCodex';
        render();
        return;
    }
    if (action === 'guild-map-world') {
        if (!destinationSelectionAllowed) return;
        if (returnToGuildWorldMap(game)) state[destinationKeys.region] = '';
        return;
    }
    if (action === 'guild-map-focus') {
        if (!destinationSelectionAllowed) return;
        const region = event.target.closest('[data-map-region]')?.dataset.mapRegion;
        if (focusGuildMap(game, region, { clearedDestinations: state.guildClearedDestinations, testUnlock: guildTestUnlock })) {
            state[destinationKeys.region] = region;
            playWebSound('click');
        }
        return;
    }
    if (action === 'guild-exit') {
        if (state.tutorial?.stage === 'guild-exit') state.tutorial.stage = 'select-open';
        if (state.view !== 'guild') return;
        moveBetweenPlazaAndGuild('plaza');
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
        gameMenuOpen = false;
        if (state.view !== 'catalog' && state.view !== 'skillEditor') state.developerCatalogReturnView = state.view;
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
        gameMenuOpen = false;
        const returnView = state.view === 'catalog' ? state.developerCatalogReturnView : state.catalogReturnView;
        const allowedViews = state.view === 'catalog'
            ? ['lobby', 'playerSetup', 'plaza', 'guild', 'expedition', 'expeditionSelect', 'characterCodex']
            : ['lobby', 'playerSetup', 'plaza', 'guild', 'expedition', 'expeditionSelect'];
        state.view = allowedViews.includes(returnView) ? returnView : (party.length ? 'expedition' : 'plaza');
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
    if (action === 'level-up-confirm') {
        state.pendingLevelUp = null;
        render();
        return;
    }
    if (action === 'guild-recruitment-confirm') {
        confirmGuildRecruitment();
        return;
    }
    if (action === 'guild-recruitment-cancel' || action === 'guild-recruitment-result-confirm') {
        state.guildRecruitmentDialog = null;
        render();
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
        if (state.view !== 'expedition' || state.ended || combatEndTimer !== null) return;
        gameMenuOpen = false;
        retreatDialogOpen = true;
        battleEffects.clear();
        render();
        game.querySelector('[data-action="retreat-cancel"]')?.focus();
        return;
    }
    if (action === 'retreat-cancel') {
        retreatDialogOpen = false;
        render();
        game.querySelector('[data-action="retreat"]')?.focus();
        return;
    }
    if (action === 'retreat-confirm') {
        if (!retreatDialogOpen || state.view !== 'expedition' || state.ended) return;
        retreatDialogOpen = false;
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
        startX: logicalPoint(event.clientX, event.clientY).x,
        startY: logicalPoint(event.clientX, event.clientY).y,
        startScrollLeft: viewport.scrollLeft,
        dragging: false,
    };
    captureTarget.setPointerCapture(event.pointerId);
});

game.addEventListener('pointermove', (event) => {
    if (!codexCarouselDrag || event.pointerId !== codexCarouselDrag.pointerId) return;
    const deltaX = logicalPoint(event.clientX, event.clientY).x - codexCarouselDrag.startX;
    const deltaY = logicalPoint(event.clientX, event.clientY).y - codexCarouselDrag.startY;
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
        if (volumeType === 'bgm') {
            backgroundMusicVolume = volume;
            backgroundMusic.volume = backgroundMusicVolume * backgroundMusicMasterVolume;
        }
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
    if (event.target.matches('[data-guild-test-unlock]')) {
        guildTestUnlock = event.target.checked;
        if (!guildTestUnlock) {
            if (!regularDepartureStatus().destination) state.regularSelectedDestination = null;
            const detail = guildDestinations[state.regularDestinationDetail];
            if (detail) {
                state.regularDestinationSubregion = detail.subregions[0][0];
                if (!guildDestinationUnlocked(state.regularDestinationDetail, state.guildClearedDestinations)) state.regularDestinationDetail = '';
            }
            if (state.regularMapFocusedRegion !== 'Stormreach') {
                state.regularMapFocusedRegion = '';
                state.regularDestinationDetail = '';
            }
        }
        if (!guildTestUnlock) {
            const selected = state.guildSelectedDestination;
            if (selected && (selected.region !== 'Stormreach' || !guildDestinationUnlocked(selected.location, state.guildClearedDestinations) || selected.subregion !== guildDestinations[selected.location]?.subregions[0][0])) {
                state.guildSelectedDestination = null;
            }
            const detail = guildDestinations[state.guildDestinationDetail];
            if (detail) {
                state.guildDestinationSubregion = detail.subregions[0][0];
                if (!guildDestinationUnlocked(state.guildDestinationDetail, state.guildClearedDestinations)) {
                    state.guildMapFocusedRegion = detail.region;
                    state.guildDestinationDetail = '';
                }
            }
            if (state.guildMapFocusedRegion && state.guildMapFocusedRegion !== 'Stormreach') {
                state.guildMapFocusedRegion = '';
                state.guildDestinationDetail = '';
                state.guildDestinationSubregion = '';
            }
        }
        render();
        return;
    }
    if (event.target.matches('[data-skill-enabled]') && import.meta.env.DEV) {
        const id = event.target.dataset.skillEnabled;
        try {
            saveSkillSettings(id, { enabled: event.target.checked });
            if (!event.target.checked && state.selectedSkill === id) state.selectedSkill = null;
        } catch {
            event.target.checked = skillEnabled(id);
            showPopupNotice('활성화 설정을 저장하지 못했습니다. 브라우저 저장 공간을 확인해주세요.');
        }
        return;
    }
    if (event.target.matches('[data-monster-enabled]') && import.meta.env.DEV) {
        try {
            saveMonsterSettings(event.target.dataset.monsterEnabled, { enabled: event.target.checked });
        } catch (error) {
            event.target.checked = monsterEnabled(event.target.dataset.monsterEnabled);
            showPopupNotice(`저장하지 못했습니다. ${error.message}`);
        }
        return;
    }
    if (event.target.matches('[data-character-enabled]') && import.meta.env.DEV) {
        try {
            saveCharacterSettings(event.target.dataset.characterEnabled, { enabled: event.target.checked });
            state.plazaOffers = state.plazaOffers.filter((entry) => characterEnabled(entry.id));
            if (state.plazaCurrentOffer && !characterEnabled(state.plazaCurrentOffer.id)) state.plazaCurrentOffer = null;
        } catch {
            event.target.checked = characterEnabled(event.target.dataset.characterEnabled);
            showPopupNotice('활성화 설정을 저장하지 못했습니다. 브라우저 저장 공간을 확인해주세요.');
        }
        return;
    }
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

function fitPlazaDialogueBubble(stage) {
    const bubble = stage?.querySelector('.plaza-dialogue-bubble');
    if (!bubble) return;
    const availableHeight = stage.clientHeight - 60;
    const maxWidth = stage.clientWidth - 80;
    let width = bubble.offsetWidth;
    while (bubble.offsetHeight > availableHeight && width < maxWidth) {
        width = Math.min(maxWidth, width + 80);
        bubble.style.width = `${width}px`;
    }
    if (bubble.offsetHeight > availableHeight) stage.style.minHeight = `${bubble.offsetHeight + 60}px`;
}

function openDeveloperCharacterEditor(id, isMonster = false, draft = null) {
    const original = catalogData[isMonster ? 'monsters' : 'characters'].find((entry) => entry.id === id);
    if (!original) return;
    const entry = { ...(isMonster ? developerMonster(original) : developerCharacter(original)), ...draft };
    const dialog = document.createElement('dialog');
    dialog.className = 'developer-character-editor';
    dialog.setAttribute('aria-labelledby', 'developer-editor-title');
    const options = (items, current) => items.map((value) => `<option value="${escapeHtml(value)}" ${value === current ? 'selected' : ''}>${escapeHtml(value)}</option>`).join('');
    const jobs = [...new Set(catalogData.growthRows.map((row) => row['직업']).filter(Boolean))];
    dialog.innerHTML = `<form><h2 id="developer-editor-title">${isMonster ? '몬스터' : '캐릭터'} 편집</h2>${isMonster ? `<p>${escapeHtml(entry.stageName)} · ${entry.isBoss ? '보스' : '일반'} · ${escapeHtml(entry.size)}형</p>` : ''}<p>Lv.${entry.level} · 스탯은 별자리·직업·등급에 따라 자동 적용됩니다.</p><div class="developer-editor-body"><div class="developer-image-picker"></div><div class="developer-editor-details"><div class="developer-editor-fields"><label>이름<input name="name" value="${escapeHtml(entry.name)}" maxlength="60" required></label><label>속성<select name="element">${options(Object.keys(elementTints), entry.element)}</select></label><label>별자리<select name="zodiac">${options(zodiacNames, entry.zodiac)}</select></label><label>직업<select name="job">${options(jobs, entry.job)}</select></label><label>등급<select name="grade">${(isMonster ? [1, 2, 3, 4, 5] : [3, 4, 5]).map((grade) => `<option value="${grade}" ${grade === entry.grade ? 'selected' : ''}>${grade}등급</option>`).join('')}</select></label></div><section class="developer-editor-stats" aria-label="자동 계산 스탯" aria-live="polite"><h3>자동 적용 스탯</h3><div>${rosterStatColumns.map(([key, label]) => `<div><span class="developer-stat-label">${statLabelMarkup(key, label)}</span><output data-preview-stat="${key}">${entry.stats[key]}</output></div>`).join('')}</div></section>${isMonster ? '' : '<section class="developer-editor-skills" aria-label="캐릭터 스킬 배정"></section>'}</div></div><p class="developer-editor-error" role="alert"></p><div class="developer-editor-buttons"><button type="button" data-editor-cancel>취소</button><button type="submit">저장</button></div></form>`;
    game.append(dialog);
    const form = dialog.querySelector('form');
    const errorText = dialog.querySelector('.developer-editor-error');
    const saveButton = form.querySelector('[type=submit]');
    const imagePicker = createDeveloperImagePicker(dialog.querySelector('.developer-image-picker'), {
        files: isMonster ? monsterDefinitions.map((entry) => entry.id) : characterPortraitFiles,
        asset: isMonster
            ? (id, type) => monsterDefinitions.find((entry) => entry.id === id)[type === 'portrait' ? 'portraitSrc' : 'thumbnailSrc']
            : (file, type) => type === 'portrait' ? characterPortraitAsset(file) : characterThumbnailAsset(file),
        portraitSrc: entry.portraitSrc,
        thumbnailSrc: entry.thumbnailSrc,
        defaults: {
            portrait: isMonster ? original.portraitSrc : characterPortraitAssets[id] || jobGlyphs[entry.job],
            thumbnail: isMonster ? original.thumbnailSrc : characterThumbnailAssets[id] || jobGlyphs[entry.job],
        },
        onError: (text) => { errorText.textContent = text; },
        onBusy: (busy) => { saveButton.disabled = busy; },
    });
    const skillPicker = isMonster ? null : createDeveloperCharacterSkillPicker(dialog.querySelector('.developer-editor-skills'), {
        skills: catalogData.skills.map(effectiveSkill),
        skillIds: draft?.skillIds || characterSkillIds(entry),
        isEnabled: skillEnabled,
        onEdit: (skillId) => {
            if (saveButton.disabled) { errorText.textContent = '이미지 처리가 끝난 뒤 스킬을 편집해주세요.'; return; }
            const fields = new FormData(form);
            developerCharacterEditorReturn = { id, draft: {
                name: String(fields.get('name')), element: String(fields.get('element')),
                zodiac: String(fields.get('zodiac')), job: String(fields.get('job')), grade: Number(fields.get('grade')),
                ...imagePicker.values(), skillIds: skillPicker.values(),
            } };
            imagePicker.dispose();
            dialog.close();
            dialog.remove();
            developerEditingSkillId = skillId;
            state.view = 'skillEditor';
            render();
        },
    });
    const previewStats = () => {
        const fields = new FormData(form);
        const preview = applyRosterProfile(original, {
            zodiac: String(fields.get('zodiac')),
            job: String(fields.get('job')),
            grade: Number(fields.get('grade')),
        }, catalogData.growthRows, catalogData.skills);
        rosterStatColumns.forEach(([key]) => {
            dialog.querySelector(`[data-preview-stat="${key}"]`).textContent = preview.stats[key];
        });
        return preview;
    };
    dialog.querySelector('[data-editor-cancel]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => { imagePicker.dispose(); dialog.remove(); });
    form.addEventListener('change', async (event) => {
        errorText.textContent = '';
        if (['zodiac', 'job', 'grade'].includes(event.target.name)) {
            try { previewStats(); } catch (error) { errorText.textContent = error.message; }
        }
    });
    form.addEventListener('submit', (event) => {
        event.preventDefault();
        if (saveButton.disabled) return;
        const fields = new FormData(form);
        const name = String(fields.get('name')).trim();
        if (!name) { errorText.textContent = '이름을 입력해주세요.'; return; }
        try {
            const preview = previewStats();
            (isMonster ? saveMonsterEdit : saveCharacterEdit)(original, {
                name, element: String(fields.get('element')), zodiac: preview.zodiac,
                job: preview.job, grade: preview.grade, ...imagePicker.values(),
                ...(skillPicker ? { skillIds: skillPicker.values() } : {}),
            });
        } catch (error) {
            errorText.textContent = `저장하지 못했습니다. ${error.message}`;
            return;
        }
        dialog.close();
        render();
        game.querySelector(`[data-${isMonster ? 'monster' : 'character'}-edit="${CSS.escape(id)}"]`)?.focus();
    });
    previewStats();
    dialog.showModal();
}

function hideCombatStatusTooltip() {
    game.querySelector('.combat-status-popup')?.remove();
    game.querySelectorAll('.combat-status[aria-describedby]').forEach((trigger) => trigger.removeAttribute('aria-describedby'));
}

function showCombatStatusTooltip(trigger) {
    hideCombatStatusTooltip();
    const popup = document.createElement('div');
    popup.className = 'combat-status-popup';
    popup.id = 'combat-status-tooltip';
    popup.setAttribute('role', 'tooltip');
    popup.innerHTML = `<strong>${escapeHtml(trigger.dataset.statusName)}</strong><div><span>수치</span><b>${escapeHtml(trigger.dataset.statusValue)}</b></div><div><span>지속</span><b>${escapeHtml(trigger.dataset.statusTurns)}</b></div>`;
    game.append(popup);
    trigger.setAttribute('aria-describedby', popup.id);
    const rect = logicalRect(trigger);
    const canvas = logicalRect(game);
    const scale = canvas.width / DESIGN_WIDTH;
    popup.style.left = `${Math.max(12, Math.min((rect.right - canvas.left) / scale + 8, DESIGN_WIDTH - popup.offsetWidth - 12))}px`;
    popup.style.top = `${Math.max(12, Math.min((rect.top - canvas.top) / scale, DESIGN_HEIGHT - popup.offsetHeight - 12))}px`;
}

game.addEventListener('mouseover', (event) => {
    if (!document.documentElement.hasAttribute('data-mouse-input')) return;
    const trigger = event.target.closest('.combat-status');
    if (trigger && !trigger.contains(event.relatedTarget)) showCombatStatusTooltip(trigger);
});
game.addEventListener('focusin', (event) => {
    if (!document.documentElement.hasAttribute('data-mouse-input')) return;
    const trigger = event.target.closest('.combat-status');
    if (trigger) showCombatStatusTooltip(trigger);
});
game.addEventListener('mouseout', (event) => {
    if (!event.target.closest('.combat-status, .combat-status-popup')) return;
    if (event.relatedTarget?.closest?.('.combat-status, .combat-status-popup')) return;
    hideCombatStatusTooltip();
});
game.addEventListener('focusout', (event) => {
    if (event.target.closest('.combat-status')) hideCombatStatusTooltip();
});
stageCanvas?.addEventListener('scroll', hideCombatStatusTooltip);
game.addEventListener('scroll', hideCombatStatusTooltip, true);
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') hideCombatStatusTooltip();
});

function showDeveloperSkillTooltip(trigger) {
    hideDeveloperSkillTooltip();
    const entries = state.catalogTab === 'monsters' ? catalogData.monsters : catalogData.characters;
    const original = entries.find((entry) => entry.id === trigger.dataset.developerCharacter);
    if (!original) return;
    const entry = state.catalogTab === 'characters' ? developerCharacter(original) : developerMonster(original);
    const skill = activeSkills(entry.skills).find((item) => item.id === trigger.dataset.developerSkill);
    if (!skill) return;
    const popup = document.createElement('div');
    popup.className = 'developer-skill-popup';
    popup.id = 'developer-skill-tooltip';
    popup.setAttribute('role', 'tooltip');
    popup.innerHTML = skillTooltip(skill, entry);
    game.append(popup);
    trigger.setAttribute('aria-describedby', popup.id);
    const rect = logicalRect(trigger);
    const canvas = logicalRect(game);
    const scale = canvas.width / DESIGN_WIDTH;
    const left = Math.max(12, Math.min((rect.left - canvas.left) / scale, DESIGN_WIDTH - popup.offsetWidth - 12));
    const below = (rect.bottom - canvas.top) / scale + 8;
    popup.style.left = `${left}px`;
    popup.style.top = `${Math.max(12, below + popup.offsetHeight <= DESIGN_HEIGHT - 12 ? below : (rect.top - canvas.top) / scale - popup.offsetHeight - 8)}px`;
}

function hideDeveloperSkillTooltip() {
    game.querySelector('.developer-skill-popup')?.remove();
    game.querySelectorAll('.developer-skill-trigger[aria-describedby]').forEach((trigger) => trigger.removeAttribute('aria-describedby'));
}
game.addEventListener('mouseover', (event) => {
    if (!document.documentElement.hasAttribute('data-mouse-input')) return;
    const trigger = event.target.closest('.developer-skill-trigger');
    if (trigger && !trigger.contains(event.relatedTarget)) showDeveloperSkillTooltip(trigger);
});
game.addEventListener('focusin', (event) => {
    if (!document.documentElement.hasAttribute('data-mouse-input')) return;
    const trigger = event.target.closest('.developer-skill-trigger');
    if (trigger) showDeveloperSkillTooltip(trigger);
});
game.addEventListener('mouseout', (event) => {
    if (!event.target.closest('.developer-skill-trigger, .developer-skill-popup')) return;
    if (event.relatedTarget?.closest?.('.developer-skill-trigger, .developer-skill-popup')) return;
    hideDeveloperSkillTooltip();
});
game.addEventListener('focusout', (event) => {
    if (event.target.closest('.developer-skill-trigger')) hideDeveloperSkillTooltip();
});
stageCanvas?.addEventListener('scroll', hideDeveloperSkillTooltip);
game.addEventListener('scroll', (event) => {
    if (!event.target.closest?.('.developer-skill-popup')) hideDeveloperSkillTooltip();
}, true);

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') hideDeveloperSkillTooltip();
    const activeDialogue = state.view === 'plaza' && !state.plazaGuildSelectionOpen ? getActivePlazaDialogue() : null;
    if (activeDialogue && !activeDialogue.node.choices?.length && event.key === 'Enter' && event.target.closest?.('.plaza-monologue-dialogue') && !event.repeat) {
        event.preventDefault();
        playWebSound('click');
        advancePlazaDialogue();
        return;
    }
    if (activeDialogue && ['monologue', 'oneOnOne', 'twoPerson'].includes(activeDialogue.dialogue.presentation) && !activeDialogue.node.choices?.length && (event.code === 'Space' || event.key === ' ') && !event.repeat) {
        const target = event.target;
        if (target instanceof HTMLElement && (target.matches('input, textarea, select, [contenteditable="true"]') || target.closest('button'))) return;
        event.preventDefault();
        playWebSound('click');
        advancePlazaDialogue();
        return;
    }
    if (state.view === 'playerSetup' && state.playerSetupStep === 'name' && event.key === 'Enter') {
        event.preventDefault();
        confirmPlayerName();
        return;
    }
    if (state.view === 'prologue' && ['Enter', ' '].includes(event.key) && !event.repeat) {
        event.preventDefault();
        game.querySelector('[data-action="tutorial-prologue-next"]')?.click();
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

if (!hasSavedGame()) state.view = 'prologue';
render();


game.addEventListener('keydown', (event) => {
    if ((!guildDispatchDialogOpen && !guildDispatchDetailId) || state.view !== 'guild') return;
    if (event.key === 'Escape') {
        event.preventDefault();
        if (guildDispatchDetailId) {
            game.querySelector('[data-action="guild-dispatch-detail-close"]')?.click();
        } else {
            guildDispatchDialogOpen = false;
            render();
            game.querySelector('[data-action="guild-dispatch-send"]')?.focus();
        }
    } else if (event.key === 'Tab') {
        const buttons = [...game.querySelectorAll('.guild-dispatch-dialog button:not(:disabled)')];
        const first = buttons[0], last = buttons.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
});


game.addEventListener('keydown', (event) => {
    const dialog = game.querySelector('.guild-dispatch-results-dialog');
    if (!dialog) return;
    event.stopPropagation();
    if (event.key === 'Escape') {
        event.preventDefault();
        confirmGuildDispatchResults();
    } else if (event.key === 'Tab') {
        const controls = [...dialog.querySelectorAll('button:not(:disabled), [tabindex="0"]')];
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
}, true);


game.addEventListener('keydown', (event) => {
    const dialog = game.querySelector('.guild-recruitment-dialog');
    if (!dialog) return;
    event.stopImmediatePropagation();
    if (event.key === 'Escape') {
        event.preventDefault();
        dialog.querySelector('[data-action="guild-recruitment-cancel"], [data-action="guild-recruitment-result-confirm"], [data-action="level-up-confirm"]')?.click();
    } else if (event.key === 'Tab') {
        const controls = [...dialog.querySelectorAll('button:not(:disabled)')];
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
}, true);


game.addEventListener('keydown', event => {
    if (!retreatDialogOpen) return;
    event.stopImmediatePropagation();
    if (event.key === 'Escape') {
        event.preventDefault();
        game.querySelector('[data-action="retreat-cancel"]')?.click();
    } else if (event.key === 'Tab') {
        const buttons = [...game.querySelectorAll('.retreat-dialog button')];
        const first = buttons[0], last = buttons.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
}, true);
