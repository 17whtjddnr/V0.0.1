import { guildResearchMarkup } from './guild-research.mjs';
import { MAX_ACTIVE_GUILD_DISPATCHES } from './guild-dispatch.mjs';
import { guildExpeditionMapMarkup } from './guild-map.mjs';
import { guildDestinationMarkup, guildDestinations } from './guild-destination.mjs';

export const guildLobbyBackgrounds = Object.freeze({
    1: '/assets/backgrounds/guild-lobby-1.webp',
    2: '/assets/backgrounds/guild-lobby-2.webp',
    3: '/assets/backgrounds/guild-lobby-3.webp',
});

export const guildRooms = Object.freeze({
    lobby: { title: '아지트 로비', content: '길드의 하루를 시작할 장소를 선택하세요.' },
    master: { disabled: true, title: '길드 마스터 방', content: '이벤트 관리', description: '길드에서 진행할 이벤트를 관리하는 공간입니다.' },
    strategy: { title: '작전실', content: '파견 원정 준비 · 연구 · 길드원 관리', description: '원정을 준비하고 연구와 길드원 관리 업무를 선택하세요.', background: '/assets/backgrounds/guild-war-room-1.webp' },
    member: { title: '길드원의 방', content: '데이트', description: '길드원과 함께 시간을 보내는 공간입니다.' },
});

export function guildExpeditionActionsMarkup({ step = 'destination', selectedDestination = null, selectedMemberCount = 0, canDispatch = false, dispatches = [] } = {}) {
    const activeDispatchCount = dispatches.filter((dispatch) => dispatch.status === 'active').length;
    const dispatchFull = activeDispatchCount >= MAX_ACTIVE_GUILD_DISPATCHES;
    const isMembers = step === 'members';
    const title = isMembers ? '선발 대원 선택' : '파견 원정지 선택';
    const selectedLocation = guildDestinations[selectedDestination?.location];
    const selectedSubregion = selectedLocation?.subregions.find(([id]) => id === selectedDestination.subregion);
    const selectedName = selectedSubregion ? `${selectedLocation.name} ${selectedSubregion[1]}` : '';
    return `<div class="panel-heading guild-work-heading"><h2>${title}</h2></div>
        <nav class="action-buttons guild-room-actions" aria-label="파견 원정 준비 업무">
            <button class="combat-action guild-room-button${selectedName ? ' is-destination-selected' : ''}" type="button" data-action="guild-expedition-step" data-expedition-step="destination" ${isMembers ? '' : 'disabled aria-current="step"'}><img src="/assets/icons/map_icon.svg" class="guild-action-icon" alt="" aria-hidden="true"><span class="guild-destination-action-label">파견 원정지 선택${selectedName ? ` - ${selectedName}` : ''}</span></button>
            <button class="combat-action guild-room-button${selectedMemberCount ? ' is-members-selected' : ''}" type="button" data-action="guild-expedition-step" data-expedition-step="members" ${isMembers ? 'disabled aria-current="step"' : ''}><img src="/assets/icons/party_icon.svg" class="guild-action-icon" alt="" aria-hidden="true"><span>${selectedMemberCount ? `선발 대원 선택 - ${selectedMemberCount}명` : '선발 대원 선택'}</span></button>
            <button class="combat-action guild-room-button${dispatchFull ? ' is-dispatch-full' : ''}" type="button" data-action="guild-dispatch-send" ${dispatchFull ? 'disabled title="동시 파견은 최대 4개까지 가능합니다."' : canDispatch ? '' : 'disabled title="원정지와 파견 대원을 선택하세요."'}><img src="/assets/icons/flag_icon.svg" class="guild-action-icon" alt="" aria-hidden="true"><span>파견 원정 보내기 ${activeDispatchCount}/${MAX_ACTIVE_GUILD_DISPATCHES}</span></button>
            <button class="combat-action guild-room-button" type="button" data-action="guild-room" data-guild-room="lobby"><img src="/assets/icons/shoe_footprints_icon.svg" class="guild-action-icon" alt="" aria-hidden="true"><span>아지트 로비로 이동</span></button>
        </nav>`;
}

export function guildPageMarkup({ room = 'lobby', background = 1, week = 1, memberCount = 0, goldMarkup = '', fameMarkup = '', expeditionPreparation = false, expeditionStep = 'destination', destinationDetail = '', monsterMarkup = '', selectedDestination = null, testUnlock = false, activeSubregion = '', membersMarkup = '', dispatchPartyMarkup = '', selectedMemberCount = 0, canDispatch = false, lobbyMarkup = '', dispatches = [], researchOpen = false, gold = 0, foundingResearch = false, regularExpedition = false }) {
    const currentRoom = guildRooms[room] || guildRooms.lobby;
    const isLobby = currentRoom === guildRooms.lobby;
    const isStrategy = currentRoom === guildRooms.strategy;
    const showResearch = isStrategy && researchOpen;
    const showMembers = isStrategy && expeditionPreparation && expeditionStep === 'members';
    const showExpeditionMap = isStrategy && expeditionPreparation && !showMembers;
    const expeditionMap = showExpeditionMap ? (guildDestinations[destinationDetail] ? guildDestinationMarkup({ destination: destinationDetail, monsterMarkup, selectedDestination, testUnlock, activeSubregion, dispatches, regularExpedition }) : guildExpeditionMapMarkup({ testUnlock })) : '';
    const backgroundSrc = currentRoom.background || guildLobbyBackgrounds[background] || guildLobbyBackgrounds[1];
    const destinations = [
        ['strategy', '작전실 - 연구, 길드원 관리', 'scroll_icon.svg'],
        ['master', '길드 마스터 방 - 이벤트 관리', 'event_icon.svg'],
        ['member', '길드원의 방 - 데이트', 'affinity_icon.svg'],
    ];
    const buttons = destinations.map(([id, label, icon]) => `<button class="combat-action guild-room-button" type="button" data-action="guild-room" data-guild-room="${id}" ${room === id ? 'disabled aria-current="page"' : guildRooms[id].disabled ? 'disabled' : ''}><img src="/assets/icons/${icon}" class="guild-action-icon" alt="" aria-hidden="true"><span>${label}</span></button>`).join('');
    const strategyButtons = `
        <button class="combat-action guild-room-button" type="button" data-action="guild-expedition-prepare" aria-expanded="${showExpeditionMap}"${showExpeditionMap ? ' aria-controls="guild-expedition-map"' : ''}><img src="/assets/icons/flag_icon.svg" class="guild-action-icon" alt="" aria-hidden="true"><span>파견 원정 준비</span></button>
        <button class="combat-action guild-room-button" type="button" data-action="guild-research" aria-pressed="${showResearch}"><img src="/assets/icons/potion_icon.svg" class="guild-action-icon" alt="" aria-hidden="true"><span>연구</span></button>
        <button class="combat-action guild-room-button" type="button" disabled title="길드원 관리 콘텐츠 준비 중"><img src="/assets/icons/scroll_icon.svg" class="guild-action-icon" alt="" aria-hidden="true"><span>길드원 관리</span></button>
        <button class="combat-action guild-room-button" type="button" data-action="guild-room" data-guild-room="lobby"><img src="/assets/icons/shoe_footprints_icon.svg" class="guild-action-icon" alt="" aria-hidden="true"><span>아지트 로비로 이동</span></button>`;
    return `<main class="guild-page"><section class="scene guild-scene"><div class="scene-heading location-heading"><h1>${regularExpedition ? '원정지 선택' : foundingResearch ? '길드 설립 - 첫 아지트' : `아지트 - ${currentRoom.title}`}</h1><div class="plaza-current-info guild-current-info"><span>${week}주차 -</span><strong>${goldMarkup}</strong><strong class="current-fame">${fameMarkup}</strong></div></div><div class="dungeon-art guild-layout-main${showResearch ? ' is-research' : ''}${foundingResearch ? ' is-founding' : ''}" aria-label="${currentRoom.title}" style="--guild-background:url('${backgroundSrc}')">${showResearch ? guildResearchMarkup(gold, foundingResearch) : isLobby ? lobbyMarkup : showMembers ? membersMarkup : expeditionMap}${isLobby || isStrategy ? '' : `<div class="guild-room-intro"><h2>${currentRoom.title}</h2><p>${currentRoom.description}</p><span>${currentRoom.content}</span></div>`}</div></section><section class="lower-grid guild-lower-grid">${isStrategy && expeditionPreparation ? dispatchPartyMarkup : `<section class="party-panel guild-summary-panel"><div class="panel-heading"><h2>${currentRoom.title}</h2></div><div class="guild-summary"><p>${isLobby ? currentRoom.content : currentRoom.description}</p><span>길드원 ${memberCount}명 · ${week}주차</span>${isLobby || isStrategy ? '' : '<button class="guild-lobby-return" type="button" data-action="guild-room" data-guild-room="lobby"><img src="/assets/icons/back_icon.svg" alt="" aria-hidden="true">아지트 로비로 돌아가기</button>'}</div></section>`}<aside class="action-panel guild-action-panel">${regularExpedition ? `<div class="panel-heading"><h2>원정지 선택</h2></div><nav class="action-buttons guild-room-actions" aria-label="일반 원정지 선택"><button class="combat-action guild-room-button" type="button" data-action="regular-destination-close"><img src="/assets/icons/back_icon.svg" class="guild-action-icon" alt="" aria-hidden="true"><span>원정 준비로 돌아가기</span></button></nav>` : isStrategy && expeditionPreparation ? guildExpeditionActionsMarkup({ step: expeditionStep, selectedDestination, selectedMemberCount, canDispatch, dispatches }) : `<div class="panel-heading${isStrategy ? ' guild-work-heading' : ''}"><h2>${isStrategy ? '업무 선택' : '이동'}</h2></div><nav class="action-buttons guild-room-actions" aria-label="${isStrategy ? '작전실 업무 선택' : '아지트 이동'}">${isStrategy ? strategyButtons : `${buttons}<button class="combat-action guild-room-button" type="button" data-action="guild-exit"><img src="/assets/icons/shoe_footprints_icon.svg" class="guild-action-icon" alt="" aria-hidden="true"><span>광장으로 나가기</span></button>`}</nav>`}</aside></section></main>`;
}
