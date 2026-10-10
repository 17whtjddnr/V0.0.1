import test from 'node:test';
import assert from 'node:assert/strict';
import { gameViewportLayout } from '../src/game-viewport.mjs';

test('16:9 preserves the design and 20:9 extends only the background', () => {
    assert.deepEqual(gameViewportLayout(1920,1080), { rotated:false, width:1920, height:1080, scale:1, backgroundWidth:1920 });
    const wide = gameViewportLayout(2400,1080);
    assert.equal(wide.scale,1); assert.equal(wide.backgroundWidth,2400);
    const phone = gameViewportLayout(1000,450,true);
    assert.equal(phone.scale,450/1080); assert.equal(phone.backgroundWidth,2400);
});

test('portrait touch displays the same landscape layout while extra-wide displays are capped', () => {
    assert.deepEqual(gameViewportLayout(450,1000,true), { ...gameViewportLayout(1000,450,true),rotated:true });
    assert.equal(gameViewportLayout(3200,1080).backgroundWidth,2400);
    assert.equal(gameViewportLayout(450,1000,false).rotated,false);
});
