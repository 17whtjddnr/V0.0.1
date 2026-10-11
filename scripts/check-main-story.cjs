const fs = require('node:fs');
const assert = require('node:assert/strict');

(async () => {
    const tabs = await (await fetch('http://127.0.0.1:9225/json')).json();
    const ws = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
    await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
    let serial = 0, paused;
    const pending = new Map(), errors = [];
    ws.onmessage = event => {
        const message = JSON.parse(event.data);
        if (message.id) { pending.get(message.id)?.(message); pending.delete(message.id); }
        if (message.method === 'Debugger.paused') paused = message.params;
        if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
    };
    const send = (method, params = {}) => new Promise(resolve => {
        const id = ++serial; pending.set(id, resolve); ws.send(JSON.stringify({id, method, params}));
    });
    const evaluate = async expression => {
        const response = await send('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true});
        if (response.result?.exceptionDetails) throw Error(JSON.stringify(response.result.exceptionDetails));
        return response.result?.result?.value;
    };
    try {
        await send('Runtime.enable'); await send('Debugger.enable'); await send('Page.enable');
        await send('Emulation.setDeviceMetricsOverride', {width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false});
        const lineNumber = fs.readFileSync('src/main.js', 'utf8').split('\n').findIndex(line => line.startsWith('function renderScene()')) + 1;
        const breakpoint = await send('Debugger.setBreakpointByUrl', {urlRegex: 'src/main.js', lineNumber});
        await send('Page.navigate', {url: 'http://127.0.0.1:5173/'});
        for (let i = 0; i < 100 && !paused; i++) await new Promise(resolve => setTimeout(resolve, 200));
        assert.ok(paused, 'Main module loaded');
        const captured = await send('Debugger.evaluateOnCallFrame', {
            callFrameId: paused.callFrames[0].callFrameId,
            expression: 'window.storyReview={state,initialState,catalogData,guildDestinations,render,startExpedition,showExpeditionResult,confirmExpeditionResult,monstersForEncounter,mainStoryCharacter,advance,saveGame,continueGame,currentMainStory,createMasterCharacter,developerCharacter,continueMainStory,getParty(){return party},setParty(value){party=value}}', returnByValue: true,
        });
        assert.equal(captured.result?.exceptionDetails, undefined);
        await send('Debugger.removeBreakpoint', {breakpointId: breakpoint.result.breakpointId});
        await send('Debugger.resume');
        await evaluate(`window.resetStoryReview=(location)=>{
            const r=storyReview;
            const master=r.createMasterCharacter(r.developerCharacter(r.catalogData.characters.find(c=>c.id==='CHAR-246')), r.catalogData.characters.find(c=>c.id==='CHAR-246').zodiac, r.catalogData.growthRows, 1);
            Object.assign(r.state,structuredClone(r.initialState),{view:'plaza',tutorial:{stage:'done'},guildRosterResetVersion:1,userLevel:3,playerName:'Test',playerZodiac:master.zodiac,gold:10000,guildFounded:true,guildClearedDestinations:Object.keys(r.guildDestinations),guildMembers:[master],recruits:[structuredClone(master)],regularSelectedDestination:{location,subregion:r.guildDestinations[location].subregions[0][0]}});
            r.setParty([]); r.startExpedition();
        }; window.finishStoryReview=()=>{let guard=100; while(storyReview.currentMainStory(storyReview.state)&&guard--) document.querySelector('[data-action=plaza-dialogue-advance]').click(); if(guard<=0)throw Error('Story did not finish');}`);
        const locations = (await evaluate('Object.keys(storyReview.guildDestinations)'))
            .filter(location => !process.env.STORY_REVIEW_LOCATION || location === process.env.STORY_REVIEW_LOCATION);
        for (const location of locations) {
            await evaluate(`resetStoryReview('${location}')`);
            if (location === 'skeldrath-7') {
                assert.equal(await evaluate('storyReview.monstersForEncounter(true)[0].name'), '백야의 서리룡');
            }
            const roomScene = {mistwood: 2, ashabyss: 4, 'veyrholt-2': 2, 'veyrholt-4': 4}[location] || (/^(eldermere|thornvale|aurelmark|valdoren|skeldrath)-[246]$/.test(location) ? 2 : 0);
            if (roomScene) await evaluate(`Object.assign(storyReview.state,{mode:'explore',room:${roomScene - 1}}); storyReview.advance()`);
            assert.equal(await evaluate('Boolean(document.querySelector(".main-story-page"))'), true, location);
            assert.equal(await evaluate('Boolean(document.querySelector(".topbar .player-profile"))'), true, `${location} keeps player header`);
            assert.equal(await evaluate('Boolean(document.querySelector(".main-story-page.plaza-page .plaza-scene .plaza-encounter-stage"))'), true, `${location} uses original main stage`);
            assert.equal(await evaluate('Boolean(document.querySelector(".main-story-page > .plaza-lower-grid .plaza-monologue-dialogue"))'), true, `${location} uses original dialogue panel`);
            assert.equal(await evaluate('Boolean(document.querySelector(".expedition-result-overlay:not([data-popup-ghost])"))'), false);
            const brokenImages = await evaluate(`Promise.all([...document.querySelectorAll('.main-story-page img')].map(img=>new Promise(resolve=>{if(img.complete)resolve(!img.naturalWidth);else {img.onload=()=>resolve(false);img.onerror=()=>resolve(true)}}))).then(items=>items.filter(Boolean).length)`);
            assert.equal(brokenImages, 0, `${location} art loads`);
            if (location === 'veyrholt-1') {
                await evaluate('storyReview.continueMainStory(); storyReview.saveGame(); storyReview.continueGame()');
                assert.equal(await evaluate('storyReview.state.mainStory.active.line'), 1);
                assert.equal(await evaluate('storyReview.state.view'), 'expedition');
                const image = await send('Page.captureScreenshot', {format: 'png'});
                fs.writeFileSync('data/reference-preview/main-story-veyrlholt.png', Buffer.from(image.result.data, 'base64'));
            }
            if (location === 'eldermere-1') {
                await evaluate('storyReview.continueMainStory()');
                await evaluate(`Promise.all([...document.querySelectorAll('.main-story-page img')].map(img=>img.decode().catch(()=>{})))`);
                await new Promise(resolve => setTimeout(resolve, 2000));
                const screenshot = await send('Page.captureScreenshot', {format: 'png'});
                fs.writeFileSync('data/reference-preview/main-story-eldermere.png', Buffer.from(screenshot.result.data, 'base64'));
            }
            await evaluate('finishStoryReview()');
            if (location === 'meadow') {
                await evaluate("Object.assign(storyReview.state,{mode:'explore',room:5}); storyReview.advance()");
                assert.equal(await evaluate('storyReview.state.mainStory.active.id'), 'storm.01.boss');
                const bossName = await evaluate('storyReview.state.pendingStoryBoss.enemies[0].name');
                assert.equal(await evaluate('storyReview.currentMainStory(storyReview.state).line.text.includes(storyReview.state.mainStory.active.bossName)'), true);
                await evaluate('storyReview.saveGame(); storyReview.continueGame()');
                assert.equal(await evaluate('storyReview.state.pendingStoryBoss.enemies[0].name'), bossName);
                await evaluate('finishStoryReview(); storyReview.advance()');
                assert.equal(await evaluate('storyReview.state.enemies[0].name'), bossName);
                assert.equal(await evaluate('storyReview.state.pendingStoryBoss'), null);
            }
            if (location === 'veyrholt-1') {
                assert.equal(await evaluate('storyReview.state.guildMembers.filter(m=>m.id==="CHAR-112").length'), 1);
                assert.equal(await evaluate('storyReview.state.guildMembers.find(m=>m.id==="CHAR-112").weeklyWage'), 0);
            }
            await evaluate('storyReview.showExpeditionResult(true)');
            assert.equal(await evaluate('Boolean(document.querySelector(".main-story-page"))'), true, `${location} ending precedes reward popup`);
            assert.equal(await evaluate('Boolean(document.querySelector(".expedition-result-overlay:not([data-popup-ghost])"))'), false);
            await evaluate('finishStoryReview()');
            if (location === 'eldermere-1') {
                const companion = await evaluate('storyReview.state.guildMembers.find(m=>m.id==="CHAR-111")');
                assert.equal(companion.grade, 5);
                assert.equal(companion.job, '전사');
                assert.equal(companion.weapon, '양손 전투망치');
                assert.equal(companion.level, 3);
                assert.equal(companion.weeklyWage, 255);
                assert.equal(companion.skills.length, 4);
            }
            assert.equal(await evaluate('Boolean(document.querySelector(".expedition-result-overlay:not([data-popup-ghost])"))'), true);
            if (location === 'skeldrath-7') {
                assert.equal(await evaluate('storyReview.state.mainStory.partOneComplete'), true);
                assert.equal(await evaluate('storyReview.state.mainStory.seen.filter(id=>id.startsWith("part1.")).length'), 5);
                await evaluate('storyReview.saveGame(); storyReview.continueGame()');
                assert.equal(await evaluate('Boolean(storyReview.state.expeditionResult)'), true);
                await evaluate('storyReview.confirmExpeditionResult()');
                assert.equal(await evaluate('storyReview.state.view'), 'partOneEnd');
                assert.equal(await evaluate('Boolean(document.querySelector(".part-one-ending-controls"))'), true);
                const image = await send('Page.captureScreenshot', { format: 'png' });
                fs.writeFileSync('data/reference-preview/main-story-carewyn-ending.png', Buffer.from(image.result.data, 'base64'));
                const gold = await evaluate('storyReview.state.gold');
                await evaluate('storyReview.saveGame(); storyReview.continueGame()');
                assert.equal(await evaluate('storyReview.state.view'), 'partOneEnd');
                assert.equal(await evaluate('storyReview.state.gold'), gold);
                await evaluate('document.querySelector(".part-one-ending-controls [data-action=catalog]").click()');
                assert.equal(await evaluate('Boolean(document.querySelector(".story-codex-page"))'), true);
                await evaluate('document.querySelector("[data-action=view-expedition]").click()');
                assert.equal(await evaluate('storyReview.state.view'), 'partOneEnd');
            }
        }
        assert.equal(errors.length, 0, JSON.stringify(errors));
        console.log(`Browser checks passed for ${locations.length} destinations: scene continuation, images, recruitment and result timing.`);
    } finally {
        await send('Browser.close'); ws.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
