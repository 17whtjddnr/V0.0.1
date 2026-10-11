const fs = require('node:fs');
const assert = require('node:assert/strict');

(async () => {
    const tabs = await (await fetch('http://127.0.0.1:9225/json')).json();
    const ws = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
    await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
    const pending = new Map(), errors = [];
    let serial = 0, paused;
    ws.onmessage = event => {
        const message = JSON.parse(event.data);
        if (message.id) { pending.get(message.id)?.(message); pending.delete(message.id); }
        if (message.method === 'Debugger.paused') paused = message.params;
        if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
    };
    const send = (method, params = {}) => new Promise(resolve => {
        const id = ++serial; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params }));
    });
    const evaluate = async expression => {
        const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
        if (response.result?.exceptionDetails) throw Error(JSON.stringify(response.result.exceptionDetails));
        return response.result?.result?.value;
    };
    const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
    try {
        await send('Runtime.enable'); await send('Debugger.enable'); await send('Page.enable');
        await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
        const lineNumber = fs.readFileSync('src/main.js', 'utf8').split('\n').findIndex(line => line.startsWith('function renderScene()')) + 1;
        const breakpoint = await send('Debugger.setBreakpointByUrl', { urlRegex: 'src/main.js', lineNumber });
        await send('Page.navigate', { url: 'http://127.0.0.1:5173/' });
        for (let i = 0; i < 100 && !paused; i++) await new Promise(resolve => setTimeout(resolve, 200));
        assert.ok(paused);
        await send('Debugger.evaluateOnCallFrame', { callFrameId: paused.callFrames[0].callFrameId,
            expression: 'window.codexReview={state,initialState,render,setParty(value){party=value}}', returnByValue: true });
        await send('Debugger.removeBreakpoint', { breakpointId: breakpoint.result.breakpointId });
        await send('Debugger.resume');
        await evaluate(`Object.assign(codexReview.state, structuredClone(codexReview.initialState), {view:'characterCodex', characterCodexTab:'characters', tutorial:{stage:'done'}, playerName:'Story Test', mainStory:{seen:['storm.01.start','eldermere.01.end'],active:null}}); codexReview.setParty([]); codexReview.render()`);
        await click('[data-codex-tab=stories]');
        assert.equal(await evaluate('document.querySelectorAll("[data-story-category]").length'), 2);
        assert.equal(await evaluate('Boolean(document.querySelector(".story-codex-lower"))'), false);
        const stageBounds = await evaluate('JSON.stringify(document.querySelector(".story-category-stage").getBoundingClientRect().toJSON())');
        await click('[data-story-category=main]');
        assert.equal(await evaluate('JSON.stringify(document.querySelector(".story-category-stage").getBoundingClientRect().toJSON())'), stageBounds);
        assert.equal(await evaluate('document.querySelectorAll("[data-story-scene]").length'), 2);
        const before = await evaluate('JSON.stringify({story:codexReview.state.mainStory,gold:codexReview.state.gold,members:codexReview.state.guildMembers})');
        await click('[data-story-scene="eldermere.01.end"]');
        assert.equal(await evaluate('Boolean(document.querySelector(".story-replay-controls [data-story-scene]"))'), false);
        assert.equal(await evaluate('Boolean(document.querySelector(".main-story-page .plaza-encounter-stage"))'), true);
        const pressSpace = async () => {
            await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
            await send('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
        };
        await pressSpace();
        assert.equal(await evaluate('document.querySelector(".story-replay-position").textContent'), '다시보기 · 2/5');
        for (let i = 0; i < 6; i++) await pressSpace();
        assert.equal(await evaluate('document.querySelector(".story-replay-position").textContent'), '다시보기 · 5/5');
        assert.equal(await evaluate('Boolean(document.querySelector("[data-action=story-replay-close]"))'), true);
        await evaluate(`let guard=100; while(document.querySelector('[data-action=story-replay-close]')&&guard--)document.querySelector('[data-action=plaza-dialogue-advance]').click(); if(guard<=0)throw Error('Replay did not end')`);
        assert.equal(await evaluate('JSON.stringify({story:codexReview.state.mainStory,gold:codexReview.state.gold,members:codexReview.state.guildMembers})'), before);
        await evaluate(`{const box=document.querySelector('[data-guild-test-unlock]'); box.checked=true; box.dispatchEvent(new Event('change',{bubbles:true}))}`);
        assert.equal(await evaluate('document.querySelectorAll("[data-story-scene]").length'), 96);
        await click('[data-story-scene="storm.01.boss"]');
        assert.equal(await evaluate('Boolean(document.querySelector("[data-action=story-replay-close]"))'), true);
        assert.equal(await evaluate('document.querySelector(".story-replay-controls [data-story-scene]").dataset.storyScene'), 'storm.01.end');
        assert.equal(await evaluate('document.querySelector(".story-replay-controls [data-story-scene]").getBoundingClientRect().top > document.querySelector("[data-action=story-replay-close]").getBoundingClientRect().bottom'), true);
        await click('.story-replay-controls [data-story-scene]');
        assert.equal(await evaluate('document.querySelector(".story-replay-controls [data-story-scene]").dataset.storyScene'), 'storm.02.start');
        await click('[data-action=story-replay-close]');
        await click('[data-story-scene="part1.carewyn.ship"]');
        assert.equal(await evaluate('Boolean(document.querySelector(".story-replay-controls [data-story-scene]"))'), false);
        await click('[data-action=story-replay-close]');
        await evaluate(`{const box=document.querySelector('[data-guild-test-unlock]'); box.checked=false; box.dispatchEvent(new Event('change',{bubbles:true}))}`);
        assert.equal(await evaluate('document.querySelectorAll("[data-story-scene]").length'), 2);
        const screenshot = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync('data/reference-preview/story-codex.png', Buffer.from(screenshot.result.data, 'base64'));
        await click('[data-story-category=characters]');
        assert.equal(await evaluate('JSON.stringify(document.querySelector(".story-category-stage").getBoundingClientRect().toJSON())'), stageBounds);
        assert.ok(await evaluate('document.querySelectorAll("[data-story-character]").length') >= 261);
        const html = await evaluate('document.querySelector(".story-codex-page").innerHTML');
        await click('[data-story-character]');
        assert.equal(await evaluate('document.querySelector(".story-codex-page").innerHTML'), html);
        await click('[data-codex-tab=monsters]');
        assert.equal(await evaluate('Boolean(document.querySelector(".codex-feature-panel"))'), true);
        assert.equal(errors.length, 0, JSON.stringify(errors));
        console.log('Story codex: initial panel hidden, seen-only lists, test toggle, original dialogue replay, no replay rewards, character buttons and existing codex tabs passed.');
    } finally { await send('Browser.close'); ws.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
