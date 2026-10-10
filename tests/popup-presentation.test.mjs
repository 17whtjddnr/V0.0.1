import test from 'node:test';
import assert from 'node:assert/strict';
import { popupPresetPose, popupPresetKind } from '../src/popup-presentation.mjs';

test('preset opens from zero, overshoots to 110%, then settles at one second', () => {
    assert.equal(popupPresetPose('start', 0).scale, 0);
    assert.equal(popupPresetPose('start', .9).scale, 1.1);
    assert.equal(popupPresetPose('start', 1).scale, 1);
});

test('loop holds scale and floats three pixels with a two-second period', () => {
    assert.deepEqual(popupPresetPose('loop', .5), { scale: 1, y: -3 });
    assert.deepEqual(popupPresetPose('loop', 1.5), { scale: 1, y: 3 });
    assert.ok(Math.abs(popupPresetPose('loop', 2).y) < 1e-10);
});

test('exit starts at the current pose and shrinks completely within half a second', () => {
    assert.deepEqual(popupPresetPose('end', 0, -3, .8), { scale: .8, y: -3 });
    const middle = popupPresetPose('end', .25, -3, .8);
    assert.ok(Math.abs(middle.scale - .4) < 1e-10);
    assert.ok(Math.abs(middle.y + 1.5) < 1e-10);
    assert.equal(popupPresetPose('end', .5, -3, .8).scale, 0);
});

test('only explicit positive outcomes receive celebration effects', () => {
    assert.equal(popupPresetKind({ dataset: { popupKind: 'positive' } }), 'positive');
    assert.equal(popupPresetKind({ dataset: { popupKind: 'negative' } }), 'negative');
    assert.equal(popupPresetKind({ dataset: {} }), 'negative');
});
