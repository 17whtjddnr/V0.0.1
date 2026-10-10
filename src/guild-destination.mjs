import expeditionRegions from '../data/maps/expedition-regions.json' with { type: 'json' };
import { monsterIdsForStage } from './monster-catalog.mjs';
import { recommendedMonsterPower } from './expedition-power.mjs';
import { MAX_ACTIVE_GUILD_DISPATCHES, guildDispatchTerms, guildDestinationDispatchActive } from './guild-dispatch.mjs';
import { goldIcon, elementIcons, jobIcons } from './reference-icons.mjs';

const compassSubregions = [
    ['north', '북부'], ['west', '서부'], ['east', '동부'], ['south', '남부'],
];

export const guildDestinations = {
    meadow: {
        dispatchBasePower: 1200, name: '온바람 평야', icon: 'forest_icon', background: 'meadow',
        subregions: compassSubregions,
        description: '따스한 바람이 풀결을 어루만지는 평야. 고요한 들판 너머로 낯선 울음소리가 들려옵니다.',
    },
    mistwood: {
        dispatchBasePower: 1500, name: '안개솔 숲', icon: 'forest_icon', background: 'forest',
        subregions: compassSubregions,
        description: '솔향을 머금은 옅은 안개가 숲길을 감쌉니다. 나뭇가지 사이로 날카로운 시선이 스쳐 갑니다.',
    },
    quietleaf: {
        dispatchBasePower: 1800, name: '잔물결 강', icon: 'water_drop_icon', background: 'river',
        subregions: compassSubregions,
        description: '햇빛을 머금은 잔물결이 강둑을 따라 흐릅니다. 물가의 고요함 아래 낯선 기척이 숨어 있습니다.',
    },
    ashabyss: {
        dispatchBasePower: 2400, name: '잿빛 심연', icon: 'dungeon_entrance_icon', background: 'dungeon',
        subregions: [['floor-1', '지하 1층'], ['floor-2', '지하 2층'], ['floor-3', '지하 3층'], ['floor-4', '지하 4층']],        description: '젖은 돌벽 사이로 희미한 횃불이 흔들립니다. 아래로 내려갈수록 잊힌 자들의 속삭임이 짙어집니다.',
    },
    windcastle: {
        dispatchBasePower: 2100, name: '바람성', icon: 'castle_icon', background: 'old-city',
        subregions: [['gate', '성문 입구'], ['square', '무너진 광장'], ['royal', '왕실 유적'], ['courtyard', '황폐한 안뜰']],        description: '무너진 성벽과 버려진 왕실에 옛 영광의 흔적만 남았습니다. 바람이 훑고 간 유적 사이로 망령이 떠돕니다.',
    },
};

export const guildRegionNames = { Stormreach: '스톰리치', ...Object.fromEntries(Object.entries(expeditionRegions).map(([id, region]) => [id, region.name])) };
export const guildRegionDestinationIds = { Stormreach: Object.keys(guildDestinations) };
for (const location of Object.values(guildDestinations)) {
    location.region = 'Stormreach';
    location.background = location.background === 'old-city' ? 'battle-final-old-city' : `battle-${location.background}`;
}
guildDestinations.quietleaf.icon = 'forest_icon';

const environmentDescriptions = {
    Meadow: '부드러운 풀결이 바람에 흔들립니다. 들판의 평온함 너머로 낯선 기척이 다가옵니다.',
    Forest: '오래된 나무 사이로 햇빛이 스며듭니다. 깊은 숲의 그림자 속에 사냥꾼들이 숨어 있습니다.',
    Jungle: '무성한 덩굴이 길을 가로막습니다. 축축한 잎사귀 아래 보이지 않는 위협이 숨 쉬고 있습니다.',
    Cave: '돌벽 사이로 발소리가 길게 울립니다. 차가운 바람이 더 깊은 어둠으로 원정대를 이끕니다.',
    Dungeon: '희미한 횃불이 젖은 돌바닥을 비춥니다. 닫힌 문 너머로 쇠사슬 소리가 들려옵니다.',
    'Bandit Hideout': '불 꺼진 망루 아래 도적들의 발자국이 이어집니다. 작은 인기척에도 매복자들이 움직입니다.',
    'Cliffside Path': '아득한 벼랑 아래로 바람이 몰아칩니다. 좁은 바위길에서 한 걸음도 방심할 수 없습니다.',
    'Magic Cave': '푸른 수정이 어둠 속에서 빛납니다. 동굴 깊은 곳에는 오래된 마력이 잠들어 있습니다.',
    River: '잔물결 위로 은빛 햇살이 흩어집니다. 고요한 강둑 아래 낯선 그림자가 스쳐 갑니다.',
    Swamp: '탁한 물 위로 옅은 안개가 깔립니다. 진흙 속에서 무언가 원정대의 발걸음을 기다립니다.',
    'Ancient Ruins': '무너진 기둥 사이에 옛 문명의 흔적이 남아 있습니다. 잠든 수호자들이 침입자를 기다립니다.',
    'Jungle Dungeon': '덩굴이 뒤덮은 묘실에 습한 공기가 맴돕니다. 잊힌 무덤의 문이 천천히 열립니다.',
    Hall: '텅 빈 전당에 발소리만 울려 퍼집니다. 오래된 벽화 너머로 수호자의 시선이 느껴집니다.',
    Coast: '파도가 바위 해안을 두드립니다. 물러난 바닷물 사이로 위험한 길이 드러납니다.',
    'Beach City': '바닷바람이 낡은 항구의 깃발을 흔듭니다. 비어 있는 부두에는 뜻밖의 손님이 숨어 있습니다.',
    Sewer: '축축한 지하수로에 물소리가 울립니다. 어둠에 익숙한 사냥꾼들이 통로를 지키고 있습니다.',
    Desert: '뜨거운 바람이 붉은 모래를 휩씁니다. 끝없는 사구 사이로 사냥감의 흔적이 사라집니다.',
    'Desert Dungeon': '모래에 묻힌 묘실의 봉인이 갈라집니다. 잊힌 왕의 수호자들이 다시 눈을 뜹니다.',
    'Lava Fields': '갈라진 대지 아래로 붉은 용암이 흐릅니다. 타오르는 열기 속에서도 거대한 그림자가 움직입니다.',
    'Lava Dungeon': '뜨거운 돌벽 사이로 불꽃이 솟구칩니다. 심장부에서 잠든 괴물이 깨어나고 있습니다.',
    Darklands: '검은 재가 황폐한 땅을 뒤덮었습니다. 생기를 잃은 대지에서 낮은 울음이 들려옵니다.',
    Snowfield: '끝없이 펼쳐진 설원에 차가운 바람이 붑니다. 눈 아래 숨은 위협이 발자국을 따라옵니다.',
    'Snowfield Dungeon': '얼어붙은 묘굴에 서리가 내려앉았습니다. 깊은 어둠 속에서 얼음송곳니가 번뜩입니다.',
};
for (const [regionId, region] of Object.entries(expeditionRegions)) {
    guildRegionDestinationIds[regionId] = region.destinations.map((location, index) => {
        const id = `${regionId.toLowerCase()}-${index + 1}`;
        const final = location.type === 'final';
        guildDestinations[id] = {
            name: location.name, region: regionId,
            dispatchBasePower: 1800 + Object.keys(expeditionRegions).indexOf(regionId) * 500 + index * 300,
            icon: final || location.type === 'town' ? 'castle_icon' : location.type === 'bandit' ? 'watchtower_icon' : location.type === 'dungeon' ? 'dungeon_entrance_icon' : 'forest_icon',
            background: `battle-${final ? 'final-' : ''}${location.image.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
            sourceImage: `OriginalData/BG/Battlelocation/${final ? 'Finals/' : ''}${location.image}.png`,
            subregions: final ? [['gate', '성문 입구'], ['square', '광장'], ['royal', '왕실'], ['courtyard', '안뜰']]
                : location.type === 'dungeon' ? Array.from({ length: location.floors }, (_, floor) => [`floor-${floor + 1}`, `지하 ${floor + 1}층`])
                : location.type === 'bandit' ? [['outpost', '외곽 초소'], ['camp', '야영지'], ['warehouse', '약탈품 창고'], ['tower', '망루']]
                : location.type === 'town' ? [['entrance', '입구'], ['dock', '부두'], ['market', '시장'], ['square', '광장']] : compassSubregions,            description: final ? `${region.name}의 마지막 성문 앞에 도착했습니다. 높은 성벽 너머로 이 땅의 수호자와 마지막 시련이 기다립니다.` : environmentDescriptions[location.image],
        };
        return id;
    });
}

for (const [id, location] of Object.entries(guildDestinations)) {
    location.monsterIdsBySubregion = Object.fromEntries(location.subregions.map(([subregion]) => [subregion, monsterIdsForStage(id, subregion)]));
    location.monsterIds = Object.values(location.monsterIdsBySubregion).flat();
}

let destinationMonsterRoster = () => [];
let destinationCharacterRoster = () => [];
export function configureDestinationMonsterPower(rosterProvider, characterProvider = () => []) {
    destinationMonsterRoster = rosterProvider;
    destinationCharacterRoster = characterProvider;
}

for (const location of Object.values(guildDestinations)) {
    // Reward and duration settings are independent of the live combat recommendation.
    const terms = guildDispatchTerms({ ...location, power: location.dispatchBasePower });
    location.dispatchWeeks ??= terms.weeks;
    location.dispatchGold ??= terms.gold;
    location.dispatchFame ??= terms.fame;
    Object.defineProperties(location, {
        monstersForSubregion: { value(subregion) {
            const ids = new Set(this.monsterIdsBySubregion[subregion] || []);
            return destinationMonsterRoster().filter((monster) => ids.has(monster.id));
        } },
        powerBySubregion: { enumerable: true, get() {
            return Object.defineProperties({}, Object.fromEntries(location.subregions.map(([subregion]) => [subregion, {
                enumerable: true, get() { return recommendedMonsterPower(location.monstersForSubregion(subregion), destinationCharacterRoster()); },
            }])));
        } },
        power: { enumerable: true, get() { return this.powerBySubregion[this.subregions[0][0]]; } },
    });
}

function activeDestinationSubregion(location, requested, testUnlock) {
    return location.subregions.find(([id], index) => id === requested && (testUnlock || index === 0))?.[0] || location.subregions[0][0];
}

export function guildDestinationMonsterIds(destination, subregion = '', testUnlock = false) {
    const location = guildDestinations[destination];
    if (!location) return [];
    return location.monsterIdsBySubregion[activeDestinationSubregion(location, subregion, testUnlock)] || [];
}

const dispatchBonusElements = Object.keys(elementIcons);
const dispatchBonusJobs = Object.keys(jobIcons);
Object.values(guildDestinations).forEach((location, index) => {
    location.dispatchBonus ||= {
        element: dispatchBonusElements[index % dispatchBonusElements.length],
        job: dispatchBonusJobs[index % dispatchBonusJobs.length],
    };
});

function guildDestinationDispatchMarkup(location, subregion) {
    const terms = guildDispatchTerms(location, subregion);
    return `<section class="guild-destination-dispatch-panel" aria-label="파견 원정 정보"><div class="guild-destination-dispatch-duration"><span>파견 원정 소요시간</span><strong>${terms.weeks}주</strong></div><div class="guild-destination-dispatch-rewards"><span>파견 원정 보상:</span><span class="guild-dispatch-gold-reward"><img src="${goldIcon}" alt="" aria-hidden="true">골드 ${terms.gold.toLocaleString('ko-KR')}</span><span class="guild-dispatch-fame-reward"><img src="/assets/icons/fame_icon.svg" alt="" aria-hidden="true">명성 ${terms.fame}</span></div><div class="guild-destination-dispatch-bonuses"><span>파견 원정 보너스</span><span title="${terms.bonus.element} 속성: 대원 1명당 +5%p"><img src="${elementIcons[terms.bonus.element]}" alt="${terms.bonus.element} 속성"><span>${terms.bonus.element}</span></span><span title="${terms.bonus.job} 직업: 대원 1명당 +5%p"><img src="${jobIcons[terms.bonus.job]}" alt="${terms.bonus.job} 직업"><span>${terms.bonus.job}</span></span></div><p>파견 원정 보너스에 해당하는 속성과 직업을 지닌 캐릭터가 선발되면, 각 요소에 의해 5%씩 성공률 보정 보너스를 획득합니다.</p></section>`;
}

export function guildDestinationUnlocked(destination, clearedDestinations = [], testUnlock = false) {
    if (testUnlock && Object.hasOwn(guildDestinations, destination)) return true;
    const order = guildRegionDestinationIds[guildDestinations[destination]?.region] || [];
    const index = order.indexOf(destination);
    return index === 0 || index > 0 && clearedDestinations.includes(order[index - 1]);
}

export function fitDestinationMonsterNames(root) {
    root.querySelectorAll('.guild-destination-monster > span').forEach((row) => {
        const label = row.querySelector('strong');
        const icon = row.querySelector('img');
        label.style.fontSize = '16px';
        const available = row.clientWidth - icon.offsetWidth - parseFloat(getComputedStyle(row).columnGap);
        const naturalWidth = label.scrollWidth;
        if (available > 0 && naturalWidth > available) {
            label.style.fontSize = `${Math.floor(16 * available / naturalWidth * 10) / 10}px`;
        }
    });
}

export function guildDestinationMarkup({ destination = 'meadow', monsterMarkup = '', selectedDestination = null, testUnlock = false, activeSubregion = '', dispatches = [], regularExpedition = false } = {}) {
    const location = guildDestinations[destination];
    if (!location) return '';
    const active = activeDestinationSubregion(location, activeSubregion, testUnlock);
    const recommendedPower = location.powerBySubregion[active];
    const dispatchFull = !regularExpedition && dispatches.filter((dispatch) => dispatch.status === 'active').length >= MAX_ACTIVE_GUILD_DISPATCHES;
    const dispatched = !regularExpedition && guildDestinationDispatchActive(dispatches, destination);
    const selected = selectedDestination?.location === destination && selectedDestination?.subregion === active;
    const subregions = location.subregions.map(([id, name], index) => [id, name, index && !testUnlock ? `${location.name} ${location.subregions[index - 1][1]} 원정 완료` : '']);
    return `<section class="guild-destination-detail" aria-label="${location.name} 원정지 상세" style="--destination-background:url('/assets/backgrounds/${location.background}.webp')">
        <button class="guild-map-world-return" type="button" data-action="guild-destination-back" aria-label="${guildRegionNames[location.region]} 지역 지도로 돌아가기"><img src="/assets/icons/back_icon.svg" alt="" aria-hidden="true"><span>${guildRegionNames[location.region]}</span></button>
        ${regularExpedition ? '' : guildDestinationDispatchMarkup(location, active)}
        <div class="guild-destination-info">
            <h2>${location.name}</h2>
            <p class="guild-destination-atmosphere">${location.description}</p>
            <section aria-labelledby="guild-subregion-heading"><h3 id="guild-subregion-heading">세부지역</h3>
                <div class="guild-destination-subregions">${subregions.map(([id, name, condition]) => `<button type="button" class="guild-destination-subregion${condition ? ' is-locked' : id === active ? ' is-active' : ''}" data-action="guild-destination-subregion" data-subregion="${id}" ${condition ? `aria-disabled="true" aria-describedby="guild-lock-${id}"` : `aria-pressed="${id === active}"`}><span>${condition ? '<span class="guild-lock-symbol" aria-hidden="true">🔒</span>' : `<img src="/assets/icons/${location.icon}.svg" alt="" aria-hidden="true">`}${location.name} ${name}</span>${condition ? `<span class="guild-destination-lock-tooltip" role="tooltip" id="guild-lock-${id}"><strong>잠금 해제 조건</strong>${condition}</span>` : ''}</button>`).join('')}</div>
            </section>
            <section aria-labelledby="guild-monster-heading"><h3 id="guild-monster-heading">등장 몬스터</h3><div class="guild-destination-monsters">${monsterMarkup}</div></section>
            <div class="guild-destination-power"><span>원정대 권장 전투력</span><strong>${recommendedPower > 0 ? recommendedPower.toLocaleString('ko-KR') : '—'}</strong></div>
            <button class="guild-destination-select${dispatchFull ? ' is-dispatch-full' : dispatched ? ' is-dispatched' : selected ? ' is-cancel' : ''}" type="button" data-action="guild-destination-select" ${dispatchFull || dispatched ? 'disabled' : ''} aria-pressed="${selected}"><img src="/assets/icons/flag_icon.svg" alt="" aria-hidden="true">${dispatchFull ? '파견 한도를 초과 했습니다' : dispatched ? '이미 파견 원정 중인 장소입니다' : selected ? '선택 취소' : regularExpedition ? '원정지 선택' : '파견 원정지 선택'}</button>
        </div>
    </section>`;
}
