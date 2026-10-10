import test from 'node:test';
import assert from 'node:assert/strict';
import { createImageWarmup } from '../src/image-warmup.mjs';

test('next-scene warming limits concurrent downloads and replaces stale pending scenes', () => {
    const images = [], tasks = [];
    const warm = createImageWarmup({ createImage: () => { const image = {}; images.push(image); return image; }, schedule: task => tasks.push(task) });
    warm(['/assets/a.webp', '/assets/a.webp', '/assets/b.webp', '/assets/old.webp', 'https://example.com/unrelated.webp']);
    tasks.shift()();
    assert.deepEqual(images.map(image => image.src), ['/assets/a.webp', '/assets/b.webp']);
    assert.ok(images.every(image => image.fetchPriority === 'low'));
    warm(['/assets/a.webp', '/assets/new.webp']);
    tasks.shift()();
    assert.equal(images.length, 2);
    images[0].onload();
    assert.equal(images[2].src, '/assets/new.webp');
    assert.equal(images.some(image => image.src === '/assets/old.webp'), false);
    images[1].onerror();
    images[2].onload();
    warm(['/assets/new.webp']);
    tasks.shift()();
    assert.equal(images.length, 3);
});
