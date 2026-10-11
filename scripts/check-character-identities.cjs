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
    try {
        await send('Runtime.enable'); await send('Debugger.enable'); await send('Page.enable');
        await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
        const lineNumber = fs.readFileSync('src/main.js', 'utf8').split('\n').findIndex(line => line.startsWith('function renderScene()')) + 1;
        const breakpoint = await send('Debugger.setBreakpointByUrl', { urlRegex: 'src/main.js', lineNumber });
        await send('Page.navigate', { url: 'http://127.0.0.1:5173/' });
        for (let i = 0; i < 100 && !paused; i++) await new Promise(resolve => setTimeout(resolve, 200));
        assert.ok(paused);
        await send('Debugger.evaluateOnCallFrame', { callFrameId: paused.callFrames[0].callFrameId,
            expression: 'window.identityReview={state,initialState,catalogData,render,developerCharacter,applyRosterProfile,characterImageSource,mainStoryCharacter,saveGame,continueGame,getParty(){return party},setParty(value){party=value}}', returnByValue: true });
        await send('Debugger.removeBreakpoint', { breakpointId: breakpoint.result.breakpointId });
        await send('Debugger.resume');
        const duplicateAudit = await evaluate(`{
            const entries=identityReview.catalogData.characters.map(identityReview.developerCharacter);
            const duplicates=key=>Object.values(Object.groupBy(entries,key)).filter(group=>group.length>1).map(group=>group.map(c=>c.id));
            ({count:entries.length,names:duplicates(c=>c.name),imageNames:duplicates(c=>c.name+'|'+identityReview.characterImageSource(c).split('?')[0])});
        }`);
        assert.deepEqual(duplicateAudit, { count: 265, names: [], imageNames: [] });
        assert.deepEqual(await evaluate(`identityReview.catalogData.characters.filter(c=>Number(c.id.slice(5))>261).map(c=>({id:c.id,name:c.name,job:c.job,skills:c.skills.length}))`), [
            { id: 'CHAR-262', name: '라하브', job: '마도사', skills: 4 },
            { id: 'CHAR-263', name: '테오발드', job: '마도사', skills: 4 },
            { id: 'CHAR-264', name: '베르너', job: '전사', skills: 4 },
            { id: 'CHAR-265', name: '아르켄', job: '기사', skills: 4 },
        ]);
        assert.deepEqual(await evaluate(`(async()=>{
            const {characterPortraitAsset,characterThumbnailAsset}=await import('/src/character-assets.mjs');
            const files=['DesertKing.webp','king.webp','0087_F_H.webp','0069_F_M.webp','0005_F_W.webp','139_M_W.webp','NorthKing.webp'];
            return (await Promise.all(files.map(async file=>{
                const portrait=new Image(), thumbnail=new Image();
                portrait.src=characterPortraitAsset(file); thumbnail.src=characterThumbnailAsset(file);
                await Promise.all([portrait.decode(),thumbnail.decode()]);
                return portrait.naturalHeight===900 && thumbnail.naturalWidth===120 && thumbnail.naturalHeight===120 ? null : file;
            }))).filter(Boolean);
        })()`), []);
        assert.deepEqual(await evaluate(`(async()=>{
            const r=identityReview, {characterImageMetadata}=await import('/src/character-identity.mjs');
            return r.catalogData.characters.map(r.developerCharacter).filter(c=>!['CHAR-208','CHAR-246'].includes(c.id)).filter(c=>{
                const metadata=characterImageMetadata(r.characterImageSource(c));
                return !metadata || /\\s/.test(c.name) || c.gender!==metadata.gender || metadata.job && c.job!==metadata.job;
            }).map(c=>c.id);
        })()`), []);
        const exemptions = await evaluate(`JSON.stringify(['CHAR-208','CHAR-246'].map(id=>identityReview.developerCharacter(identityReview.catalogData.characters.find(c=>c.id===id))))`);
        await evaluate(`{
            const r=identityReview, base=r.catalogData.characters.find(c=>!['CHAR-208','CHAR-246'].includes(c.id));
            window.expectedIdentity={name:base.name,job:base.job};
            const member=r.applyRosterProfile(base,{name:'Old Family Name',job:base.job==='기사'?'전사':'기사',level:1},r.catalogData.growthRows,r.catalogData.skills);
            Object.assign(member,{hp:0,maxHp:member.stats.maxHp,experience:42,weeklyWage:123,contractWeeklyWage:123,isGuildMember:true});
            Object.assign(r.state,structuredClone(r.initialState),{view:'characterCodex',characterCodexTab:'characters',tutorial:{stage:'done'},userLevel:3,guildRosterResetVersion:1,guildMembers:[member],recruits:[structuredClone(member)]});
            r.setParty([]); r.render();
        }`);
        for (const list of ['guildMembers', 'recruits']) {
            assert.equal(await evaluate(`identityReview.state.${list}[0].name===expectedIdentity.name && identityReview.state.${list}[0].job===expectedIdentity.job`), true);
            assert.deepEqual(await evaluate(`(({experience,weeklyWage,contractWeeklyWage,hp})=>({experience,weeklyWage,contractWeeklyWage,hp}))(identityReview.state.${list}[0])`),
                { experience: 42, weeklyWage: 123, contractWeeklyWage: 123, hp: 0 });
        }
        assert.equal(await evaluate(`JSON.stringify(['CHAR-208','CHAR-246'].map(id=>identityReview.developerCharacter(identityReview.catalogData.characters.find(c=>c.id===id))))`), exemptions);
        assert.deepEqual(await evaluate(`(async()=>{
            const {storyCast}=await import('/src/main-story-data.mjs'), {characterImageMetadata}=await import('/src/character-identity.mjs');
            return Object.entries(storyCast).filter(([key,cast])=>cast.job).filter(([key,cast])=>{
                const actor=identityReview.mainStoryCharacter(key), metadata=characterImageMetadata(actor?.portraitSrc);
                return !actor || metadata?.job!==cast.job || metadata?.gender!==(key==='rival'||cast.gender==='male'?'M':'F');
            }).map(([key])=>key);
        })()`), []);
        await evaluate(`{
            const r=identityReview, willow=structuredClone(r.catalogData.characters.find(c=>c.id==='CHAR-112')),
                viola=structuredClone(r.catalogData.characters.find(c=>c.id==='CHAR-111'));
            const oldWillow={...structuredClone(willow),id:'CHAR-STORY-LORA',storyCompanion:true,wageExempt:true,weeklyWage:0,contractWeeklyWage:0,experience:22},
                oldViola={...structuredClone(viola),id:'CHAR-STORY-LYSIA',storyCompanion:true,weeklyWage:85,contractWeeklyWage:85};
            Object.assign(r.state,{view:'characterCodex',characterCodexTab:'stories',guildMembers:[willow,oldWillow,viola,oldViola],
                recruits:[structuredClone(willow),structuredClone(oldWillow)]});
            r.setParty([structuredClone(willow),structuredClone(oldWillow)]); r.render();
        }`);
        assert.deepEqual(await evaluate('identityReview.state.guildMembers.map(c=>c.id)'), ['CHAR-112', 'CHAR-111']);
        assert.equal(await evaluate('identityReview.state.guildMembers.find(c=>c.id==="CHAR-112").contractWeeklyWage'), 0);
        assert.equal(await evaluate('identityReview.state.guildMembers.find(c=>c.id==="CHAR-112").experience'), 22);
        assert.equal(await evaluate('identityReview.state.recruits.length'), 1);
        assert.equal(await evaluate('identityReview.getParty().length'), 1);
        await evaluate(`identityReview.saveGame(); identityReview.continueGame(); Object.assign(identityReview.state,{view:'characterCodex',characterCodexTab:'stories'}); identityReview.render(); document.querySelector('[data-story-category=characters]').click()`);
        assert.equal(await evaluate('document.querySelectorAll("[data-story-character]").length'), 265);
        assert.equal(await evaluate('new Set([...document.querySelectorAll("[data-story-character]")].map(card=>card.getAttribute("aria-label"))).size'), 265);
        assert.equal(await evaluate('document.querySelectorAll("[data-story-character=CHAR-112]").length'), 1);
        assert.equal(await evaluate('document.querySelectorAll("[data-story-character=CHAR-111]").length'), 1);
        assert.equal(errors.length, 0, JSON.stringify(errors));
        console.log('Browser checks passed: 265 unique catalog names/images, old story duplicate migration, save/reload and unique story cards, protected characters and story cast artwork.');
    } finally { await send('Browser.close'); ws.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
