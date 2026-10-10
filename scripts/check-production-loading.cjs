const assert = require('node:assert/strict');
(async () => {
    const base = process.env.GAME_REVIEW_URL || 'http://127.0.0.1:4173';
    const tabs = await (await fetch('http://127.0.0.1:9225/json')).json();
    const ws = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
    await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
    let id = 0;
    const pending = new Map(), requests = [], errors = [];
    ws.onmessage = event => {
        const message = JSON.parse(event.data);
        if (message.id) { pending.get(message.id)?.(message); pending.delete(message.id); }
        if (message.method === 'Network.requestWillBeSent') requests.push(message.params.request.url);
        if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
    };
    const send = (method, params = {}) => new Promise(resolve => {
        const next = ++id; pending.set(next, resolve); ws.send(JSON.stringify({ id: next, method, params }));
    });
    const evaluate = async expression => {
        const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true });
        if (result.result?.exceptionDetails) throw Error(JSON.stringify(result.result.exceptionDetails));
        return result.result.result.value;
    };
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
    await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 450, height: 1000, deviceScaleFactor: 1, mobile: true });
    await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await send('Page.navigate', { url: base });
    for (let i = 0; i < 200; i++) {
        if (await evaluate('Boolean(document.querySelector(".tutorial-prologue-page"))')) break;
        await delay(100);
    }
    assert.equal(await evaluate('Boolean(document.querySelector(".tutorial-prologue-page"))'), true);
    const renderedAt = await evaluate('performance.now()');
    assert.equal(requests.some(url => /\.xlsx(?:\?|$)/.test(url)), false, 'Production never downloads spreadsheets');
    assert.equal(requests.filter(url => /game-data-.*\.json/.test(url)).length, 1, 'Data preload and fetch share one request');
    await evaluate('(async()=>{const image = new Image();image.src="/assets/backgrounds/tutorial-land.webp";await image.decode();return image.naturalWidth > 0})()');
    for (let i = 0; i < 40; i++) {
        if (await evaluate('Boolean(document.querySelector(".title-screen"))')) break;
        await evaluate(`document.querySelector('[data-action="tutorial-prologue-next"]')?.click()`);
        await delay(160);
    }
    assert.equal(await evaluate('Boolean(document.querySelector(".title-screen"))'), true, 'Prologue advances to lobby');
    assert.equal(requests.some(url => /Loby\.web\.mp3/.test(url)), true);
    assert.equal(requests.some(url => /\/(Loby|Town|Dungeon)\.mp3/.test(url)), false);
    assert.equal(errors.length, 0, JSON.stringify(errors));
    console.log(JSON.stringify({ base, mobileCpuThrottle: 4, firstScreenMs: Math.round(renderedAt), spreadsheetRequests: 0, gameDataRequests: 1, lobbyMusic: 'optimized MP3', errors: 0 }));
    await send('Emulation.setCPUThrottlingRate', { rate: 1 });
    ws.close();
})().catch(error => { console.error(error); process.exit(1); });
