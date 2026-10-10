const fs=require('fs');
(async()=>{
 const tabs=await(await fetch('http://127.0.0.1:9225/json')).json();const tab=tabs.find(t=>t.type==='page');const ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));let id=0;const pending=new Map(),errors=[];ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){pending.get(m.id)?.(m);pending.delete(m.id);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);};
 const send=(method,params={})=>new Promise(resolve=>{const n=++id;pending.set(n,resolve);ws.send(JSON.stringify({id:n,method,params}));});
 const evaluate=async(expression)=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.result?.exceptionDetails)throw Error(JSON.stringify(r.result.exceptionDetails));return r.result?.result?.value;};
 await send('Runtime.enable');await send('Page.enable');await send('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});await send('Page.navigate',{url:'http://127.0.0.1:5173/data/reference-preview/battle-effects-review.html'});
 for(let i=0;i<80;i++){await new Promise(r=>setTimeout(r,250));if(await evaluate('Boolean(window.ready)'))break;}
 console.log('Ready',await evaluate('({ready:window.ready,targets:document.images.length,canvas:document.querySelectorAll("canvas").length})'));
 await evaluate('window.run()');await new Promise(r=>setTimeout(r,500));const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync('data/reference-preview/approved-effects-in-game.png',Buffer.from(shot.result.data,'base64'));
 console.log('Playing',await evaluate('({icons:document.querySelectorAll(".battle-effect-icon").length,animations:document.getAnimations().length})'));
 await new Promise(r=>setTimeout(r,3500));console.log('Cleanup',await evaluate('document.querySelectorAll(".battle-effect-icon").length'));
 console.log('Errors',JSON.stringify(errors));await evaluate('fx.destroy()');ws.close();
})().catch(e=>{console.error(e);process.exitCode=1;});
