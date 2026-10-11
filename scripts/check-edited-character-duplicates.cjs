const fs = require('node:fs');
const assert = require('node:assert/strict');

(async () => {
    const tabs = await (await fetch('http://127.0.0.1:9225/json')).json();
    const ws = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
    await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
    const pending = new Map(), errors = [];
    let serial = 0, paused, cacheBefore;
    const send = (method, params = {}) => new Promise(resolve => {
        const id = ++serial; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params }));
    });
    ws.onmessage = event => {
        const message = JSON.parse(event.data);
        if (message.id) { pending.get(message.id)?.(message); pending.delete(message.id); }
        if (message.method === 'Debugger.paused') paused = message.params;
        if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
    };
    const evaluate = async expression => {
        const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
        if (response.result?.exceptionDetails) throw Error(JSON.stringify(response.result.exceptionDetails));
        return response.result?.result?.value;
    };
    const load = async () => {
        paused = null;
        const lineNumber = fs.readFileSync('src/main.js', 'utf8').split('\n').findIndex(line => line.startsWith('function renderScene()')) + 1;
        const breakpoint = await send('Debugger.setBreakpointByUrl', { urlRegex: 'src/main.js', lineNumber });
        await send('Page.navigate', { url: 'http://127.0.0.1:5173/' });
        for (let i = 0; i < 100 && !paused; i++) await new Promise(resolve => setTimeout(resolve, 200));
        assert.ok(paused);
        await send('Debugger.evaluateOnCallFrame', { callFrameId: paused.callFrames[0].callFrameId,
            expression: 'window.editedReview={state,initialState,catalogData,render,developerCharacter,drawPlazaOffers,saveGame,continueGame,getParty(){return party},setParty(value){party=value}}', returnByValue: true });
        await send('Debugger.removeBreakpoint', { breakpointId: breakpoint.result.breakpointId });
        await send('Debugger.resume');
    };
    try {
        await send('Runtime.enable'); await send('Debugger.enable'); await send('Page.enable');
        await load();
        cacheBefore = await evaluate('localStorage.getItem("game-developer-characters-v1")');
        await evaluate(`{
            const cached=JSON.parse(localStorage.getItem('game-developer-characters-v1')||'{}');
            cached['CHAR-001']={name:'Old Oscar Edit',portraitSrc:'/assets/art/2D/Character/0006_M_N.webp?v=old',thumbnailSrc:'/assets/art/2D/Character_thumnail/0006_M_N.webp'};
            cached['CHAR-002']={name:'오스카',portraitSrc:'/OriginalData/Character/Character_Original/139_M_W.png'};
            localStorage.setItem('game-developer-characters-v1',JSON.stringify(cached));
        }`);
        await load();
        await evaluate(`{
            const r=editedReview, first=r.developerCharacter(r.catalogData.characters.find(c=>c.id==='CHAR-001')),
                original=r.developerCharacter(r.catalogData.characters.find(c=>c.id==='CHAR-183'));
            Object.assign(first,{experience:42,weeklyWage:123,contractWeeklyWage:123});
            Object.assign(r.state,structuredClone(r.initialState),{view:'characterCodex',characterCodexTab:'characters',tutorial:{stage:'done'},userLevel:5,guildRosterResetVersion:1,guildMembers:[first,original],recruits:[structuredClone(first)]});
            r.setParty([structuredClone(first)]); r.render();
        }`);
        const names = await evaluate('[...document.querySelectorAll("[data-codex-character] .codex-character-name")].map(node=>node.textContent)');
        assert.equal(names.filter(name => name === '오스카').length, 1);
        assert.equal(names.length, 264);
        assert.equal(new Set(names).size, 264);
        assert.equal(await evaluate('document.querySelectorAll("[data-codex-character=CHAR-001]").length'), 0);
        assert.equal(await evaluate('document.querySelectorAll("[data-codex-character=CHAR-183]").length'), 1);
        assert.notEqual(await evaluate('editedReview.developerCharacter(editedReview.catalogData.characters.find(c=>c.id==="CHAR-002")).name'), '오스카');
        assert.equal(await evaluate('editedReview.state.guildMembers.length'), 1);
        assert.equal(await evaluate('editedReview.state.guildMembers[0].id'), 'CHAR-183');
        assert.equal(await evaluate('editedReview.state.guildMembers[0].experience'), 42);
        assert.equal(await evaluate('editedReview.state.guildMembers[0].contractWeeklyWage'), 123);
        assert.equal(await evaluate('editedReview.getParty()[0].id'), 'CHAR-183');
        assert.equal(await evaluate('editedReview.drawPlazaOffers().some(c=>c.id==="CHAR-001"||c.id==="CHAR-183")'), false);
        await evaluate(`editedReview.saveGame(); editedReview.continueGame(); Object.assign(editedReview.state,{view:'characterCodex',characterCodexTab:'characters'}); editedReview.render()`);
        assert.equal(await evaluate('[...document.querySelectorAll(".codex-character-name")].filter(node=>node.textContent==="오스카").length'), 1);
        assert.equal(errors.length, 0, JSON.stringify(errors));
        console.log('Browser checks passed: cached Oscar image duplicate removed, different-image names renamed, original Oscar kept, contracts and saved party references preserved.');
    } finally {
        if (cacheBefore !== undefined) await evaluate(cacheBefore === null ? 'localStorage.removeItem("game-developer-characters-v1")' : `localStorage.setItem('game-developer-characters-v1',${JSON.stringify(cacheBefore)})`);
        await send('Browser.close'); ws.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
