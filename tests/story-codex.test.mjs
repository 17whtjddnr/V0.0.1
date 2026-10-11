import test from 'node:test';
import assert from 'node:assert/strict';
import { mainStoryScenes } from '../src/main-story-data.mjs';
import { visibleStoryScenes, nextStoryScene, createStoryReplay, currentStoryReplay, advanceStoryReplay } from '../src/story-codex.mjs';

test('only completed scenes are visible and test mode exposes all without changing discovery', () => {
    const state = { mainStory: { seen: ['storm.01.start'], active: { id: 'eldermere.01.end', line: 1 } } };
    assert.deepEqual(visibleStoryScenes(state).map(scene => scene.id), ['storm.01.start']);
    const before = structuredClone(state);
    assert.equal(visibleStoryScenes(state, true).length, mainStoryScenes.length);
    assert.deepEqual(state, before);
    assert.equal(visibleStoryScenes({}).length, 0);
    assert.equal(createStoryReplay(state, 'eldermere.01.end'), null);
    assert.ok(createStoryReplay(state, 'eldermere.01.end', true));
    assert.equal(createStoryReplay(state, 'unknown', true), null);
});

test('replaying a recruitment scene returns only local progress and never grants rewards or completes the real scene', () => {
    const state = { gold: 50, guildMembers: [], mainStory: { seen: ['eldermere.01.end'], active: { id: 'storm.01.start', line: 1 } } };
    const before = structuredClone(state);
    let replay = createStoryReplay(state, 'eldermere.01.end');
    const initial = structuredClone(replay);
    let lines = 0;
    while (currentStoryReplay(replay)) {
        assert.equal(currentStoryReplay(replay).index, lines++);
        replay = advanceStoryReplay(replay);
    }
    assert.equal(lines, mainStoryScenes.find(scene => scene.id === 'eldermere.01.end').lines.length);
    assert.deepEqual(state, before);
    assert.equal(initial.line, 0);
    assert.equal(replay, null);
});

test('replay resolves the original encountered boss name and falls back for older saves', () => {
    const state = { mainStory: { seen: ['storm.01.boss'], records: { 'storm.01.boss': { bossName: '기록된 보스' } } } };
    const replay = createStoryReplay(state, 'storm.01.boss', false, '대체 보스');
    assert.ok(currentStoryReplay(replay).line.text.includes('기록된 보스'));
    delete state.mainStory.records;
    assert.ok(currentStoryReplay(createStoryReplay(state, 'storm.01.boss', false, '대체 보스')).line.text.includes('대체 보스'));
});

test('next story follows the narrative order and stops at unseen scenes or the ending', () => {
    const state = { mainStory: { seen: ['storm.01.start', 'storm.01.end'] } };
    assert.equal(nextStoryScene(state, 'storm.01.start'), null);
    state.mainStory.seen.push('storm.01.boss');
    assert.equal(nextStoryScene(state, 'storm.01.start').id, 'storm.01.boss');
    assert.equal(nextStoryScene(state, 'storm.01.boss').id, 'storm.01.end');
    assert.equal(nextStoryScene(state, 'storm.01.end'), null);
    assert.equal(nextStoryScene(state, 'storm.01.end', true).id, mainStoryScenes[3].id);
    assert.equal(nextStoryScene(state, mainStoryScenes.at(-1).id, true), null);
    assert.equal(nextStoryScene(state, 'unknown', true), null);
});
