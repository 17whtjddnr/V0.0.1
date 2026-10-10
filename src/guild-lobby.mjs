import { MAX_GUILD_MEMBERS } from './guild-roster.mjs';
const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const number = (value) => (Number(value) || 0).toLocaleString('ko-KR');

export function guildLobbyOverview(state) {
    const members = state.guildMembers || [];
    const dispatches = (state.guildDispatches || []).filter((dispatch) => dispatch.status === 'active')
        .sort((a, b) => a.returnWeek - b.returnWeek || a.startedWeek - b.startedWeek);
    return {
        memberCount: members.length, memberCapacity: MAX_GUILD_MEMBERS,
        weeklyWages: members.reduce((total, member) => total + Math.max(0, Number(member.weeklyWage) || 0), 0),
        dispatchCount: dispatches.length, dispatches: dispatches.slice(0, 4),
        secretary: members.find((member) => member.id === state.guildSecretaryId),
    };
}

export function guildLobbyMarkup(state, portraitSrc) {
    const overview = guildLobbyOverview(state);
    const secretary = overview.secretary;
    const secretaryMarkup = secretary ? `<div class="codex-character-art-mask plaza-encounter-character-mask guild-lobby-secretary"><img src="${escape(portraitSrc)}" alt="비서 ${escape(secretary.name)}" draggable="false"><img class="plaza-encounter-additive" src="${escape(portraitSrc)}" alt="" aria-hidden="true" draggable="false"></div>` : '';
    const cards = overview.dispatches.map((dispatch) => {
        const remaining = Math.max(0, dispatch.returnWeek - state.week);
        const progress = Math.min(100, Math.max(0, (state.week - dispatch.startedWeek) / Math.max(1, dispatch.weeks) * 100));
        return `<article class="guild-lobby-dispatch"><div class="guild-lobby-dispatch-main"><h3><img src="/assets/icons/flag_icon.svg" alt="" aria-hidden="true">${escape(dispatch.destination.name)}</h3><p>파견 대원 ${dispatch.memberIds.length}명 · ${number(dispatch.startedWeek)}주차 출발</p><div class="guild-lobby-dispatch-progress" role="progressbar" aria-label="${escape(dispatch.destination.name)} 파견 진행" aria-valuenow="${Math.round(progress)}" aria-valuemin="0" aria-valuemax="100"><span style="width:${progress}%"></span></div></div><div class="guild-lobby-dispatch-return"><strong>${remaining}주 남음</strong><span>${number(dispatch.returnWeek)}주차 복귀</span></div><button type="button" data-action="guild-dispatch-detail" data-dispatch-id="${escape(dispatch.id)}" aria-label="${escape(dispatch.destination.name)} 파견 상세 보기" title="파견 상세 보기"><img src="/assets/icons/search_icon.svg" alt="" aria-hidden="true"></button></article>`;
    }).join('');
    return `<div class="guild-lobby-dashboard">${secretaryMarkup}<section class="guild-lobby-overview" aria-label="길드 현황"><div class="guild-lobby-stats"><article><span>길드원 총원</span><strong><img src="/assets/icons/party_icon.svg" alt="" aria-hidden="true">${overview.memberCount}<small>명</small><span class="guild-lobby-capacity">/ ${overview.memberCapacity}<small>명</small></span></strong></article><article><span>길드원 총 주급</span><strong class="guild-lobby-wages"><img src="/assets/icons/coin_pouch_icon.svg" alt="" aria-hidden="true">${number(overview.weeklyWages)}<small>골드 / 주</small></strong></article></div><div class="guild-lobby-dispatch-heading"><h2>진행 중인 파견 원정</h2><span>${overview.dispatchCount}건${overview.dispatchCount > 4 ? ' · 복귀가 가까운 4건 표시' : ''}</span></div><div class="guild-lobby-dispatch-grid">${cards || '<div class="guild-lobby-no-dispatch"><img src="/assets/icons/flag_icon.svg" alt="" aria-hidden="true"><strong>진행 중인 파견 원정이 없습니다.</strong><span>작전실에서 대원을 선발하고 파견 원정을 보내세요.</span></div>'}</div></section></div>`;
}
