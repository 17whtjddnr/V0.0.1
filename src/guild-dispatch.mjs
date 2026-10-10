import { combatTeamPower, resolveCombatProfiles, estimateExpeditionClearRate } from './combat-power.mjs';
export const MAX_ACTIVE_GUILD_DISPATCHES = 4;

export function guildDestinationDispatchActive(dispatches, location) {
    return (dispatches || []).some((dispatch) => dispatch.status === 'active' && dispatch.destination.location === location);
}

export const guildDispatchPower = combatTeamPower;

export function powerRatioSuccessChance(power, recommendedPower) {
    if (!(power > 0) || !(recommendedPower > 0)) return 0;
    const ratio = power / recommendedPower;
    return Math.min(100, 100 / (1 + 0.25 / ratio ** 4));
}

export function activeGuildDispatch(state, memberId) {
    return (state.guildDispatches || []).find((dispatch) => dispatch.status === 'active' && dispatch.memberIds.includes(memberId));
}

export function guildDispatchTerms(location, subregion = location.subregions?.[0]?.[0]) {
    const powers = location.powerBySubregion;
    const recommendedPower = powers ? Math.max(0, Number(powers[subregion]) || 0) : Math.max(1, Number(location.power) || 1);
    const weeks = Math.min(5, Math.max(1, Math.ceil(Number(location.dispatchWeeks) || recommendedPower / 1200)));
    return {
        recommendedPower, weeks,
        gold: Math.max(0, Math.round(Number(location.dispatchGold ?? recommendedPower * .2 * weeks))),
        fame: Math.max(0, Math.round(Number(location.dispatchFame ?? recommendedPower / 600 * weeks))),
        bonus: location.dispatchBonus || {},
    };
}

export function guildDispatchBonus(members, bonus = {}) {
    return members.reduce((total, member) => total
        + (bonus.element && member.element === bonus.element ? 5 : 0)
        + (bonus.job && member.job === bonus.job ? 5 : 0), 0);
}

export function guildDispatchPlan(state, destinations, maxMembers = 4) {
    if ((state.guildDispatches || []).filter((dispatch) => dispatch.status === 'active').length >= MAX_ACTIVE_GUILD_DISPATCHES) return null;
    const selected = state.guildSelectedDestination;
    if (selected && guildDestinationDispatchActive(state.guildDispatches, selected.location)) return null;
    const location = destinations[selected?.location];
    const subregion = location?.subregions.find(([id]) => id === selected?.subregion);
    const ids = state.guildDispatchMemberIds || [];
    if (!location || !subregion || !ids.length || ids.length > maxMembers || new Set(ids).size !== ids.length) return null;
    const members = ids.map((id) => (state.guildMembers || []).find((member) => member.id === id));
    if (members.some((member) => !member || activeGuildDispatch(state, member.id) || (state.recruits || []).some((recruit) => recruit.id === member.id))) return null;
    const terms = guildDispatchTerms(location, selected.subregion);
    if (terms.recommendedPower <= 0) return null;
    const power = guildDispatchPower(members);
    const stageMonsters = location.monstersForSubregion?.(selected.subregion);
    const baseSuccessChance = stageMonsters
        ? estimateExpeditionClearRate(resolveCombatProfiles(members), stageMonsters) * 100
        : powerRatioSuccessChance(power, terms.recommendedPower);
    const bonusChance = guildDispatchBonus(members, terms.bonus);
    return {
        destination: { ...selected, name: `${location.name} ${subregion[1]}` }, location, members,
        ...terms, power, baseSuccessChance, bonusChance,
        successChance: Math.min(100, baseSuccessChance + bonusChance),
    };
}

export function approveGuildDispatch(state, destinations, maxMembers = 4) {
    const plan = guildDispatchPlan(state, destinations, maxMembers);
    if (!plan) return null;
    state.guildDispatches ||= [];
    const dispatch = {
        id: `dispatch-${state.week}-${state.guildDispatches.length + 1}`,
        status: 'active', memberIds: plan.members.map((member) => member.id),
        memberSnapshots: plan.members.map(({ id, name, job, element, level, grade }) => ({ id, name, job, element, level, grade })),
        destination: plan.destination, startedWeek: Number(state.week) || 1,
        returnWeek: (Number(state.week) || 1) + plan.weeks, weeks: plan.weeks,
        power: plan.power, recommendedPower: plan.recommendedPower,
        gold: plan.gold, fame: plan.fame, successChance: plan.successChance,
        baseSuccessChance: plan.baseSuccessChance, bonusChance: plan.bonusChance, bonus: plan.bonus,
    };
    state.guildDispatches.push(dispatch);
    state.guildDispatchMemberIds = [];
    state.guildSelectedDestination = null;
    state.guildDestinationDetail = '';
    state.guildDestinationSubregion = '';
    state.guildMapFocusedRegion = '';
    state.guildExpeditionStep = 'destination';
    return dispatch;
}

export function completeGuildDispatches(state, random = Math.random) {
    const completed = [];
    for (const dispatch of state.guildDispatches || []) {
        if (dispatch.status !== 'active' || dispatch.returnWeek > state.week) continue;
        dispatch.status = random() * 100 < dispatch.successChance ? 'success' : 'failed';
        dispatch.completedWeek = Number(state.week);
        dispatch.resultAcknowledged = false;
        if (dispatch.status === 'success') {
            state.gold = (Number(state.gold) || 0) + dispatch.gold;
            state.fame = (Number(state.fame) || 0) + dispatch.fame;
        }
        completed.push(dispatch);
    }
    return completed;
}


export function pendingGuildDispatchResults(state) {
    return (state.guildDispatches || []).filter((dispatch) =>
        (dispatch.status === 'success' || dispatch.status === 'failed') && dispatch.resultAcknowledged === false
    ).sort((a, b) => a.returnWeek - b.returnWeek || a.startedWeek - b.startedWeek);
}

export function acknowledgeGuildDispatchResults(state, ids) {
    const shownIds = new Set(ids);
    for (const dispatch of pendingGuildDispatchResults(state)) {
        if (shownIds.has(dispatch.id)) dispatch.resultAcknowledged = true;
    }
}
