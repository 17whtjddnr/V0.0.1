export const tutorialExpeditionDestination = { location: 'meadow', subregion: 'north', name: '온바람 평야 북부' };
const defaultExpeditionDestination = { location: 'crypt', subregion: '', name: '지하 묘지' };

export function startRegularExpeditionDestination(state, destination = defaultExpeditionDestination) {
    state.expeditionDestination = { ...destination };
    return state.expeditionDestination;
}

export function finishRegularExpeditionDestination(state, completed, destinations) {
    const destination = state.expeditionDestination;
    const tutorialActive = Boolean(state.tutorial?.stage && state.tutorial.stage !== 'done');
    if (completed && !tutorialActive && destination && destinations[destination.location]?.subregions[0][0] === destination.subregion) {
        state.guildClearedDestinations = [...new Set([...(state.guildClearedDestinations || []), destination.location])];
    }
    state.expeditionDestination = null;
}

export function migrateRegularExpeditionDestination(state) {
    if (state.expeditionDestinationVersion === 1) return;
    const stage = state.tutorial?.stage;
    if (stage === 'battle' && !state.expeditionDestination) {
        state.expeditionDestination = { ...tutorialExpeditionDestination };
    }
    const selected = state.guildSelectedDestination;
    // Old tutorial code wrote this exact region-less object into dispatch selection.
    if (stage && !['meeting', 'look-first', 'hire-first', 'look-second', 'hire-second', 'depart'].includes(stage)
        && selected?.location === 'meadow' && selected.subregion === 'north'
        && selected.name === tutorialExpeditionDestination.name && !('region' in selected)) {
        state.guildSelectedDestination = null;
    }
    state.expeditionDestinationVersion = 1;
}

// Regular expedition preparation is independent from guild dispatch preparation.
export function regularExpeditionPreparation(state, destinations) {
    const requiresDestination = !state.tutorial?.stage || state.tutorial.stage === 'done';
    const selected = state.regularSelectedDestination;
    const location = destinations[selected?.location];
    const destination = location?.subregions.some(([id]) => id === selected.subregion) ? selected : null;
    const hasMembers = (state.recruits || []).length > 0;
    return {
        requiresDestination, destination,
        canDepart: hasMembers && (!requiresDestination || Boolean(destination)),
        label: requiresDestination && !destination ? '원정출발 - 원정지를 선택해주세요'
            : !hasMembers && requiresDestination ? '원정출발 - 원정대원을 선발해주세요' : '원정 출발',
    };
}
