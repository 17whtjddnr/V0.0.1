import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer } from 'node:http';
import { createProjectContentWriter, developerContentPlugin } from '../scripts/developer-content.mjs';
import { createDeveloperContentStore } from '../src/developer-content-store.mjs';
import characters from '../data/developer/characters.json' with { type: 'json' };
import skills from '../data/developer/skills.json' with { type: 'json' };

const fixture = async t => {
    const root = await mkdtemp(path.join(tmpdir(), 'guild-editor-test-'));
    t.after(() => rm(root, { recursive: true, force: true }));
    return root;
};

test('recovered Aileen profile and her four edited skills are shipped as project defaults', () => {
    const actor = characters['CHAR-208'];
    assert.equal(actor.name, '아일린');
    assert.equal(actor.job, '정령사');
    assert.equal(actor.element, '물');
    assert.equal(actor.grade, 4);
    assert.match(actor.portraitSrc, /0138_F_H\.webp/);
    assert.deepEqual(actor.skillIds.map(id => skills[id].values.name), ['서릿달 일격', '서릿달빛', '서릿달빛 반전', '서릿달 가호']);
    assert.equal(skills.SKILL_0289.values.healingCoefficients[1], 1.1);
    assert.equal(skills.SKILL_1368.values.effects.length, 2);
});

test('production uses project defaults even when the browser contains stale developer overrides', () => {
    const store = createDeveloperContentStore('characters', {
        development: false,
        storage: { getItem() { throw Error('Production must never read browser overrides'); } },
    });
    assert.deepEqual(store.settings['CHAR-208'], characters['CHAR-208']);
    assert.throws(() => store.save('CHAR-208', { name: 'Browser override' }));
});

test('a failed project save preserves the last committed profile; successful saves accept normalized image paths', async () => {
    let fail = true;
    const values = new Map();
    const store = createDeveloperContentStore('characters', { defaults: { 'CHAR-001': { name: 'Before' } }, development: true,
        storage: { getItem: () => null, setItem: (key, value) => values.set(key, value) },
        persist: async () => { if (fail) throw Error('Disk write failed'); return { 'CHAR-001': { name: 'After', portraitSrc: '/assets/art/edited/hash.webp' } }; },
    });
    await assert.rejects(store.save('CHAR-001', { name: 'After' }), /Disk write failed/);
    assert.equal(store.settings['CHAR-001'].name, 'Before');
    assert.equal(values.size, 0);
    fail = false;
    await store.save('CHAR-001', { name: 'After' });
    assert.equal(store.settings['CHAR-001'].portraitSrc, '/assets/art/edited/hash.webp');
    assert.equal(values.size, 1);
});

test('uploads become public image files and concurrent edits preserve other actors and fields', async t => {
    const root = await fixture(t);
    const save = createProjectContentWriter(root);
    const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
    const first = await save({ kind: 'characters', id: 'CHAR-001', patch: { name: 'Saved', portraitSrc: image } });
    assert.match(first['CHAR-001'].portraitSrc, /^\/assets\/art\/edited\/[a-f0-9]+\.png$/);
    assert.ok((await readFile(path.join(root, 'public', first['CHAR-001'].portraitSrc))).length > 20);
    await Promise.all(Array.from({ length: 10 }, (_, i) => save({ kind: 'characters', id: `CHAR-${i + 2}`, patch: { name: `Actor ${i}` } })));
    await save({ kind: 'characters', id: 'CHAR-001', patch: { enabled: false } });
    const reloaded = JSON.parse(await readFile(path.join(root, 'data/developer/characters.json'), 'utf8'));
    assert.equal(Object.keys(reloaded).length, 11);
    assert.equal(reloaded['CHAR-001'].name, 'Saved');
    assert.equal(reloaded['CHAR-001'].enabled, false);
    await save({ kind: 'skills', id: 'SKILL_0008', patch: skills.SKILL_0008 });
    await save({ kind: 'monsters', id: 'MON-EXP-0001', patch: { name: 'Monster', thumbnailSrc: image } });
    assert.deepEqual(JSON.parse(await readFile(path.join(root, 'data/developer/skills.json'), 'utf8')).SKILL_0008, skills.SKILL_0008);
});

test('invalid edits and image traversal cannot corrupt the project file', async t => {
    const root = await fixture(t), save = createProjectContentWriter(root);
    await save({ kind: 'characters', id: 'CHAR-001', patch: { name: 'Kept' } });
    const before = await readFile(path.join(root, 'data/developer/characters.json'), 'utf8');
    for (const edit of [
        { kind: '../elsewhere', id: 'CHAR-001', patch: {} },
        { kind: 'characters', id: '../outside', patch: {} },
        { kind: 'characters', id: 'CHAR-001', patch: { grade: 99 } },
        { kind: 'characters', id: 'CHAR-001', patch: { skillIds: ['SKILL_0008'] } },
        { kind: 'characters', id: 'CHAR-001', patch: { portraitSrc: '/assets/../../private.json' } },
        { kind: 'characters', id: 'CHAR-001', patch: { portraitSrc: 'data:image/png;base64,bm90LWEtcG5n' } },
        JSON.parse('{"kind":"characters","id":"CHAR-001","patch":{"__proto__":{"polluted":true}}}'),
    ]) await assert.rejects(save(edit));
    assert.equal(await readFile(path.join(root, 'data/developer/characters.json'), 'utf8'), before);
    assert.equal({}.polluted, undefined);
});

test('developer endpoint accepts only local same-origin JSON POST requests', async t => {
    const root = await fixture(t);
    let middleware;
    developerContentPlugin(root).configureServer({ middlewares: { use: handler => { middleware = handler; } }, moduleGraph: { getModulesByFile: () => [] } });
    const server = createServer((request, response) => middleware(request, response, () => { response.statusCode = 404; response.end(); }));
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise(resolve => server.close(resolve)));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const request = { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'characters', id: 'CHAR-001', patch: { name: 'HTTP Saved' } }) };
    assert.equal((await fetch(`${origin}/__developer-content`, { ...request, headers: { ...request.headers, Origin: 'https://elsewhere.example' } })).status, 403);
    assert.equal((await fetch(`${origin}/__developer-content`, { headers: { Origin: origin } })).status, 405);
    const response = await fetch(`${origin}/__developer-content`, request);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).settings['CHAR-001'].name, 'HTTP Saved');
});
