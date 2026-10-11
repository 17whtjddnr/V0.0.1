import { mainStoryScenes } from './main-story-data.mjs';

export function visibleStoryScenes(state, testUnlock = false) {
    const seen = new Set(state.mainStory?.seen || []);
    return mainStoryScenes.filter(scene => testUnlock || seen.has(scene.id));
}

export function nextStoryScene(state, id, testUnlock = false) {
    const index = mainStoryScenes.findIndex(scene => scene.id === id);
    if (index < 0) return null;
    const next = mainStoryScenes[index + 1];
    return next && visibleStoryScenes(state, testUnlock).some(scene => scene.id === next.id) ? next : null;
}

// Replay progress is separate from the expedition and never grants scene rewards.
export function createStoryReplay(state, id, testUnlock = false, bossName = '') {
    if (!visibleStoryScenes(state, testUnlock).some(scene => scene.id === id)) return null;
    return { id, line: 0, bossName: state.mainStory?.records?.[id]?.bossName || bossName || '괴물' };
}

export function currentStoryReplay(replay) {
    const scene = mainStoryScenes.find(scene => scene.id === replay?.id);
    const line = scene?.lines[replay?.line];
    return line ? { scene, index: replay.line, line: { ...line, text: line.text.replaceAll('{{bossName}}', replay.bossName) } } : null;
}

export function advanceStoryReplay(replay) {
    const current = currentStoryReplay(replay);
    return current && current.index + 1 < current.scene.lines.length ? { ...replay, line: replay.line + 1 } : null;
}
