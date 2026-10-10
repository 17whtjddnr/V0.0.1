import test from 'node:test';
import assert from 'node:assert/strict';
import { typeDialogueText } from '../src/dialogue-typewriter.mjs';

test('typing callback follows visible characters and stops when the line finishes', t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const element = { isConnected: true, textContent: '' }, heard = [];
    typeDialogueText(element, 'ABC', { onCharacter: (char, index) => heard.push([char, index, element.textContent]) });
    for (let i=0;i<3;i++) t.mock.timers.tick(35);
    assert.deepEqual(heard, [['A',0,'A'],['B',1,'AB'],['C',2,'ABC']]);
    t.mock.timers.tick(1000);
    assert.equal(heard.length,3);
});
test('skipping or leaving a dialogue cancels remaining typing callbacks', t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const element = { isConnected: true, textContent: '' }, heard = [];
    const stop = typeDialogueText(element, 'ABC', { onCharacter: char => heard.push(char) });
    t.mock.timers.tick(35); stop(); t.mock.timers.tick(1000);
    assert.deepEqual(heard,['A']);
    const detached = { isConnected: false, textContent: '' };
    typeDialogueText(detached, 'ABC', { onCharacter: char => heard.push(char) });
    t.mock.timers.tick(1000);
    assert.deepEqual(heard,['A']);
});
test('immediate text presentation does not emit typing callbacks', t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const element = { isConnected: true, textContent: '' }, heard = [];
    typeDialogueText(element, 'ABC', { immediate: true, onCharacter: char => heard.push(char) });
    t.mock.timers.tick(1000);
    assert.equal(element.textContent,'ABC');
    assert.deepEqual(heard,[]);
});
