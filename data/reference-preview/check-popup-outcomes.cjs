const fs=require('fs'),assert=require('assert/strict');
(async()=>{
const tabs=await(await fetch('http://127.0.0.1:9225/json')).json();const ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));let id=0,paused;const pending=new Map(),errors=[];ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){pending.get(m.id)?.(m);pending.delete(m.id);}if(m.method==='Debugger.paused')paused=m.params;if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);};
const send=(method,params={})=>new Promise(resolve=>{const n=++id;pending.set(n,resolve);ws.send(JSON.stringify({id:n,method,params}));});
const ev=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(r.result?.exceptionDetails)throw Error(JSON.stringify(r.result.exceptionDetails));return r.result?.result?.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
await send('Runtime.enable');await send('Debugger.enable');await send('Page.enable');await send('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
const bp=await send('Debugger.setBreakpointByUrl',{urlRegex:'src/main.js',lineNumber:fs.readFileSync('src/main.js','utf8').split('\n').findIndex(line=>line.startsWith('function renderScene()'))+1});await send('Page.navigate',{url:'http://127.0.0.1:5173/'});
for(let i=0;i<180&&!paused;i++)await wait(250);assert.ok(paused,'Game initialized');
await send('Debugger.evaluateOnCallFrame',{callFrameId:paused.callFrames[0].callFrameId,expression:'window.review={state,catalogData,render,popupPresentation,openDeveloperCharacterEditor,showPopupNotice,expeditionResultMarkup,renderGuildProgressPopup,applyTutorialGuide,guildDispatchResultsMarkup,guildDestinations,setVolume(v){soundEffectsVolume=v}}'});
await send('Debugger.removeBreakpoint',{breakpointId:bp.result.breakpointId});await send('Debugger.resume');await send('Debugger.disable');await wait(500);errors.length=0;

console.log('Actual outcome classifications',await ev(`(()=>{
 const r=review, kind=html=>new DOMParser().parseFromString(html,'text/html').querySelector('[role=dialog]').dataset.popupKind;
 const result={memberAffinities:[],rewardExperience:0,rewardGold:0,experienceBefore:0,experienceAfter:0};
 const outcomes=[kind(r.expeditionResultMarkup({...result,completed:true})),kind(r.expeditionResultMarkup({...result,completed:false}))];
 r.state.view='plaza';r.state.pendingLevelUp={previousLevel:1,level:2,maximumExperience:100};r.renderGuildProgressPopup();outcomes.push(document.querySelector('.guild-recruitment-dialog').dataset.popupKind);document.querySelector('.guild-recruitment-overlay').remove();r.state.pendingLevelUp=null;
 for(const success of [true,false]){r.state.guildRecruitmentDialog={type:'result',success,name:'Review member',wage:10};r.renderGuildProgressPopup();outcomes.push(document.querySelector('.guild-recruitment-dialog').dataset.popupKind);document.querySelector('.guild-recruitment-overlay').remove();}r.state.guildRecruitmentDialog=null;
 r.state.tutorial={stage:'final-popup'};r.applyTutorialGuide();outcomes.push(document.querySelector('.tutorial-milestone').dataset.popupKind);
 for(const status of ['success','failed']){const state={week:3,guildMembers:[],guildDispatches:[{id:'test',status,resultAcknowledged:false,memberIds:[],memberSnapshots:[],destination:{location:'meadow',name:'Review destination'},returnWeek:3,startedWeek:2,weeks:1,gold:100,fame:1}]};outcomes.push(kind(r.guildDispatchResultsMarkup(state,{meadow:{name:'Meadow',background:'guild-war-room-1'}},()=>'')));}
 if(JSON.stringify(outcomes)!==JSON.stringify(['positive','negative','positive','positive','negative','positive','positive','negative']))throw Error(JSON.stringify(outcomes));return outcomes;
})()`));
assert.equal(errors.length,0,JSON.stringify(errors));console.log('Runtime errors:',errors.length);await send('Browser.close');ws.close();
})().catch(e=>{console.error(e);process.exit(1)});

