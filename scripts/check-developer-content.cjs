const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert/strict');
(async () => {
    // Save through the real writer into an isolated fixture, never change live game content.
    const { createProjectContentWriter } = await import('./developer-content.mjs');
    const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'guild-editor-ui-'));
    fs.mkdirSync(path.join(fixture, 'data/developer'), { recursive: true });
    for (const kind of ['characters', 'monsters', 'skills']) fs.copyFileSync(`data/developer/${kind}.json`, path.join(fixture, `data/developer/${kind}.json`));
    const write = createProjectContentWriter(fixture);
    const copyImage = url => {
        if (!url?.startsWith('/assets/')) return;
        const relative = `public${decodeURIComponent(url.split('?')[0])}`;
        const target = path.join(fixture, relative);
        fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(relative, target);
    };
    const tabs = await (await fetch('http://127.0.0.1:9225/json')).json();
    const ws = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
    await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
    let id = 0, paused, rejectNext = true;
    const pending = new Map(), errors = [], saved = [];
    const send = (method, params = {}) => new Promise(resolve => { const next = ++id; pending.set(next, resolve); ws.send(JSON.stringify({ id: next, method, params })); });
    ws.onmessage = async event => {
        const message = JSON.parse(event.data);
        if (message.id) { pending.get(message.id)?.(message); pending.delete(message.id); }
        if (message.method === 'Debugger.paused') paused = message.params;
        if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
        if (message.method === 'Fetch.requestPaused') {
            const { requestId, request } = message.params;
            let status = 200, result;
            try {
                if (rejectNext) { rejectNext = false; throw Error('Review disk write failure'); }
                const edit = JSON.parse(request.postData);
                copyImage(edit.patch.portraitSrc); copyImage(edit.patch.thumbnailSrc); copyImage(edit.patch.values?.thumbnailSrc);
                result = { settings: await write(edit) }; saved.push(edit.kind);
            } catch (error) { status = 400; result = { error: error.message }; }
            await send('Fetch.fulfillRequest', { requestId, responseCode: status, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body: Buffer.from(JSON.stringify(result)).toString('base64') });
        }
    };
    const evaluate = async expression => {
        const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true });
        if (result.result?.exceptionDetails) throw Error(JSON.stringify(result.result.exceptionDetails));
        return result.result.result.value;
    };
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
    await send('Runtime.enable'); await send('Page.enable'); await send('Debugger.enable');
    await send('Fetch.enable', { patterns: [{ urlPattern: '*/__developer-content', requestStage: 'Request' }] });
    const line = fs.readFileSync('src/main.js', 'utf8').split('\n').findIndex(text => text.startsWith('function renderScene()')) + 1;
    const breakpoint = await send('Debugger.setBreakpointByUrl', { urlRegex: 'src/main.js', lineNumber: line });
    await send('Page.navigate', { url: 'http://localhost:5173/' });
    for (let i = 0; i < 180 && !paused; i++) await delay(250);
    assert.ok(paused, 'Development game initialized');
    await send('Debugger.evaluateOnCallFrame', { callFrameId: paused.callFrames[0].callFrameId, expression: 'window.review={state,catalogData,render,openDeveloperCharacterEditor,developerCharacter,developerMonster,effectiveSkill,openSkill(id){developerEditingSkillId=id;state.view="skillEditor";render()}}' });
    await send('Debugger.removeBreakpoint', { breakpointId: breakpoint.result.breakpointId }); await send('Debugger.resume'); await send('Debugger.disable'); await delay(400);
    await evaluate('Object.assign(review.state,{view:"catalog",catalogTab:"characters",tutorial:null});review.render();review.openDeveloperCharacterEditor("CHAR-208")');
    assert.equal(await evaluate('document.querySelector("dialog[open] form").elements.job.value'), '정령사');
    await evaluate('document.querySelector("dialog[open] form").elements.name.value="Review Aileen";document.querySelector("dialog[open] form").requestSubmit()');
    await delay(300);
    assert.match(await evaluate('document.querySelector(".developer-editor-error").textContent'), /Review disk write failure/);
    assert.equal(await evaluate('review.developerCharacter(review.catalogData.characters.find(actor=>actor.id==="CHAR-208")).name'), '아일린');
    await evaluate('document.querySelector("dialog[open] form").requestSubmit()'); await delay(900);
    assert.equal(JSON.parse(fs.readFileSync(path.join(fixture, 'data/developer/characters.json')))["CHAR-208"].name, 'Review Aileen');
    assert.equal(await evaluate('Boolean(document.querySelector("dialog[open]"))'), false);
    await evaluate('review.openSkill("SKILL_0008")');
    await evaluate('document.querySelector(".developer-skill-editor-page form").elements.name.value="Review Skill";document.querySelector(".developer-skill-editor-page form").requestSubmit()'); await delay(600);
    assert.equal(JSON.parse(fs.readFileSync(path.join(fixture, 'data/developer/skills.json'))).SKILL_0008.values.name, 'Review Skill');
    await evaluate('review.state.catalogTab="monsters";review.render();review.openDeveloperCharacterEditor(review.catalogData.monsters[0].id,true)'); await delay(800);
    await evaluate('document.querySelector("dialog[open] form").elements.name.value="Review Monster";document.querySelector("dialog[open] form").requestSubmit()'); await delay(800);
    const monsters = JSON.parse(fs.readFileSync(path.join(fixture, 'data/developer/monsters.json')));
    assert.equal(Object.values(monsters)[0].name, 'Review Monster');
    assert.deepEqual(saved, ['characters', 'skills', 'monsters']);
    assert.equal(errors.length, 0, JSON.stringify(errors));
    console.log(JSON.stringify({ saved, failedSavePreservedEditorAndProfile: true, diskFilesVerified: true, errors: 0 }));
    await send('Fetch.disable'); ws.close(); fs.rmSync(fixture, { recursive: true, force: true });
})().catch(error => { console.error(error); process.exit(1); });
