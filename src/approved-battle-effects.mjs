// Generated from OriginalData/Reference/approved-effects-all.html.
// Original drawing, particle timing and synthesized sound are preserved.
import * as PIXI from 'pixi.js';
export const approvedEffectFactories = {
"punch"(app, q, getAudioContext, volume) {

 const target=new PIXI.Container();app.stage.addChild(target);
 const fx=new PIXI.Container();fx.position.set(200,200);app.stage.addChild(fx);
 const shapes=new PIXI.Graphics();fx.addChild(shapes);
 const cv=document.createElement('canvas');cv.width=cv.height=128;const ctx=cv.getContext('2d'),gr=ctx.createRadialGradient(64,64,0,64,64,64);gr.addColorStop(0,'#fff9df');gr.addColorStop(.12,'#ffe6a9');gr.addColorStop(.35,'#ff9d334f');gr.addColorStop(1,'#ff880000');ctx.fillStyle=gr;ctx.fillRect(0,0,128,128);
 const tx=PIXI.Texture.from(cv),flash=new PIXI.Sprite(tx);flash.anchor.set(.5);flash.blendMode='add';fx.addChild(flash);
 const particles=[];for(let i=0;i<36;i++){const s=new PIXI.Sprite(tx);s.anchor.set(.5);s.blendMode='add';fx.addChild(s);particles.push({s});}
 let t=2,active=false,spawned=false,waiting=0,ac;
 const sr=44100,audio=new Float32Array(sr*.5);let seed=13,low=0;for(let i=0;i<audio.length;i++){const s=i/sr;seed=seed*16807%2147483647;const n=seed/2147483647*2-1;low=low*.86+n*.14;const lead=(n-low)*Math.exp(-Math.pow((s-.025)/.015,2))*.11,h=s-.045;let v=lead;if(h>=0){v+=Math.sin(2*Math.PI*(105*h-65*h*h))*Math.exp(-h*26)*.7+low*Math.exp(-h*32)*1.4+(n-low)*Math.exp(-h*95)*.28;}audio[i]=Math.tanh(v)*.75;}
 async function sound(){if(!q('sound').checked)return;try{ac??=getAudioContext();await ac.resume();const b=ac.createBuffer(1,audio.length,sr);b.copyToChannel(audio,0);const s=ac.createBufferSource(),g=ac.createGain();s.buffer=b;s.playbackRate.value=+q('speed').value;g.gain.value=.65 * volume();s.connect(g).connect(ac.destination);s.start();}catch(e){q('sound').checked=false;}}
 function play(audible=true){t=0;active=true;spawned=false;waiting=0;particles.forEach(p=>p.s.alpha=0);if(audible)sound();}
 function burst(){spawned=true;for(let i=0;i<particles.length;i++){const p=particles[i],a=Math.random()*Math.PI*2;p.vx=Math.cos(a)*(90+Math.random()*210);p.vy=Math.sin(a)*(90+Math.random()*210);p.life=.16+Math.random()*.28;p.size=2+Math.random()*3;}}
 const rays=Array.from({length:13},(_,i)=>({a:i*Math.PI*2/13+(Math.random()-.5)*.22,len:45+Math.random()*38}));
 app.ticker.add(ticker=>{t+=Math.min(ticker.deltaMS/1000,.05)*+q('speed').value;const hit=.045,h=t-hit;shapes.clear();flash.alpha=0;if(active&&h>=0&&!spawned)burst();
 if(active&&t<hit){const p=t/hit;shapes.moveTo(-135+p*115,25-p*20).lineTo(-65+p*60,10-p*10).stroke({color:0xffbb78,width:3,alpha:Math.sin(p*Math.PI)*.5});}
 if(active&&h>=0&&h<.48){const e=Math.exp(-h*14),r=14+115*(1-Math.exp(-h*7));
 shapes.circle(0,0,r).stroke({color:0xffc477,width:Math.max(.6,5*(1-h/.48)),alpha:Math.pow(1-h/.48,2)*.9});
 shapes.circle(0,0,r*.82).stroke({color:0xff7733,width:2,alpha:Math.pow(1-h/.48,3)*.6});
 const points=[];for(let i=0;i<26;i++){const a=i*Math.PI/13,rad=i%2?10+16*Math.exp(-h*17):30+54*Math.exp(-h*15);points.push(Math.cos(a)*rad,Math.sin(a)*rad);}shapes.poly(points).fill({color:0xffe8bd,alpha:Math.exp(-h*25)});
 for(const ray of rays){const a=ray.a,inner=17+h*85,outer=inner+ray.len*e;shapes.moveTo(Math.cos(a)*inner,Math.sin(a)*inner).lineTo(Math.cos(a)*outer,Math.sin(a)*outer).stroke({color:0xffae57,width:2.5*e+.5,alpha:e});}
 flash.width=flash.height=160+h*100;flash.alpha=Math.exp(-h*30)*.85;
 }
 for(const p of particles){if(!spawned||h<0||h>p.life){p.s.alpha=0;continue;}p.s.position.set(p.vx*h,p.vy*h+60*h*h);p.s.width=p.size*4;p.s.height=p.size;p.s.rotation=Math.atan2(p.vy,p.vx);p.s.alpha=(1-h/p.life)**1.6;}
 if(active&&t>.85){active=false;shapes.clear();}if(!active&&q('loop').checked){waiting+=Math.min(ticker.deltaMS/1000,.05);if(waiting>.6)play();}
 });
 
return { play, stopSound() {  } };
},
"critical-punch"(app, q, getAudioContext, volume) {

 const target=new PIXI.Container();app.stage.addChild(target);
 const fx=new PIXI.Container();fx.position.set(200,200);app.stage.addChild(fx);
 const shapes=new PIXI.Graphics();fx.addChild(shapes);
 const cv=document.createElement('canvas');cv.width=cv.height=128;const ctx=cv.getContext('2d'),gr=ctx.createRadialGradient(64,64,0,64,64,64);gr.addColorStop(0,'#fff9df');gr.addColorStop(.12,'#ffe6a9');gr.addColorStop(.35,'#ff9d334f');gr.addColorStop(1,'#ff880000');ctx.fillStyle=gr;ctx.fillRect(0,0,128,128);
 const tx=PIXI.Texture.from(cv),flash=new PIXI.Sprite(tx);flash.anchor.set(.5);flash.blendMode='add';fx.addChild(flash);
 const particles=[];for(let i=0;i<64;i++){const s=new PIXI.Sprite(tx);s.anchor.set(.5);s.blendMode='add';fx.addChild(s);particles.push({s});}
 let t=2,active=false,spawned=false,waiting=0,ac;
 const sr=44100,audio=new Float32Array(sr*.8);let seed=13,low=0;for(let i=0;i<audio.length;i++){const s=i/sr;seed=seed*16807%2147483647;const n=seed/2147483647*2-1;low=low*.86+n*.14;const lead=(n-low)*Math.exp(-Math.pow((s-.025)/.015,2))*.11,h=s-.045;let v=lead;if(h>=0){v+=Math.sin(2*Math.PI*(85*h-37*h*h))*Math.exp(-h*16)*.85+low*Math.exp(-h*20)*1.7+(n-low)*Math.exp(-h*75)*.36;}if(h>=0){v+=Math.sin(2*Math.PI*48*h)*Math.exp(-h*12)*.24;const echo=h-.075;if(echo>=0)v+=low*Math.exp(-echo*28)*.45;}audio[i]=Math.tanh(v)*.78;}
 async function sound(){if(!q('sound').checked)return;try{ac??=getAudioContext();await ac.resume();const b=ac.createBuffer(1,audio.length,sr);b.copyToChannel(audio,0);const s=ac.createBufferSource(),g=ac.createGain();s.buffer=b;s.playbackRate.value=+q('speed').value;g.gain.value=.75 * volume();s.connect(g).connect(ac.destination);s.start();}catch(e){q('sound').checked=false;}}
 function play(audible=true){t=0;active=true;spawned=false;waiting=0;particles.forEach(p=>p.s.alpha=0);if(audible)sound();}
 function burst(){spawned=true;for(let i=0;i<particles.length;i++){const p=particles[i],a=Math.random()*Math.PI*2;p.vx=Math.cos(a)*(150+Math.random()*330);p.vy=Math.sin(a)*(150+Math.random()*330);p.life=.24+Math.random()*.4;p.size=2+Math.random()*4;}}
 const rays=Array.from({length:18},(_,i)=>({a:i*Math.PI*2/18+(Math.random()-.5)*.22,len:70+Math.random()*55}));
 app.ticker.add(ticker=>{t+=Math.min(ticker.deltaMS/1000,.05)*+q('speed').value;const hit=.045,h=t-hit;shapes.clear();flash.alpha=0;if(active&&h>=0&&!spawned)burst();
 if(active&&t<hit){const p=t/hit;shapes.moveTo(-135+p*115,25-p*20).lineTo(-65+p*60,10-p*10).stroke({color:0xffbb78,width:3,alpha:Math.sin(p*Math.PI)*.5});}
 if(active&&h>=0&&h<.65){const e=Math.exp(-h*10),r=12+164*(1-Math.exp(-h*7));
 shapes.circle(0,0,r).stroke({color:0xffd19a,width:Math.max(.6,8*(1-h/.65)),alpha:Math.pow(1-h/.65,2)*.9});
 shapes.circle(0,0,r*.82).stroke({color:0xff3923,width:3,alpha:Math.pow(1-h/.65,3)*.6});
 const points=[];for(let i=0;i<36;i++){const a=i*Math.PI/18,rad=i%2?13+18*Math.exp(-h*12):45+67*Math.exp(-h*12);points.push(Math.cos(a)*rad,Math.sin(a)*rad);}shapes.poly(points).fill({color:0xfff4db,alpha:Math.exp(-h*22)});
 for(const ray of rays){const a=ray.a,inner=23+h*120,outer=inner+ray.len*e;shapes.moveTo(Math.cos(a)*inner,Math.sin(a)*inner).lineTo(Math.cos(a)*outer,Math.sin(a)*outer).stroke({color:0xff773b,width:4*e+.5,alpha:e});}
 const delayed=h-.075;if(delayed>=0){const rr=8+148*(1-Math.exp(-delayed*8));shapes.circle(0,0,rr).stroke({color:0xff5533,width:Math.max(1,4*(1-delayed/.6)),alpha:Math.exp(-delayed*8)*.65});}for(let i=0;i<6;i++){const a=i*Math.PI/3+.2,rad=30+Math.min(h*210,65),x=Math.cos(a)*rad,y=Math.sin(a)*rad;shapes.moveTo(x,y).lineTo(x+Math.cos(a+.12)*26,y+Math.sin(a+.12)*26).lineTo(x+Math.cos(a)*46,y+Math.sin(a)*46).stroke({color:0xffd28b,width:2,alpha:Math.exp(-h*12)});}flash.width=flash.height=230+h*150;flash.alpha=Math.exp(-h*23)*.95;
 }
 for(const p of particles){if(!spawned||h<0||h>p.life){p.s.alpha=0;continue;}p.s.position.set(p.vx*h,p.vy*h+60*h*h);p.s.width=p.size*4;p.s.height=p.size;p.s.rotation=Math.atan2(p.vy,p.vx);p.s.alpha=(1-h/p.life)**1.6;}
 if(active&&t>1.1){active=false;shapes.clear();}if(!active&&q('loop').checked){waiting+=Math.min(ticker.deltaMS/1000,.05);if(waiting>.6)play();}
 });
 
return { play, stopSound() {  } };
},
"heal"(app, q, getAudioContext, volume) {
const rear=new PIXI.Graphics(),target=new PIXI.Container(),fx=new PIXI.Graphics();app.stage.addChild(rear,target,fx);
const cv=document.createElement('canvas');cv.width=cv.height=128;const c=cv.getContext('2d'),gr=c.createRadialGradient(64,64,0,64,64,64);gr.addColorStop(0,'#ddffe8');gr.addColorStop(.14,'#80ffb1');gr.addColorStop(.4,'#20ec7740');gr.addColorStop(1,'#00ff6600');c.fillStyle=gr;c.fillRect(0,0,128,128);const tx=PIXI.Texture.from(cv);
const particles=[];for(let i=0;i<32;i++){const s=new PIXI.Sprite(tx);s.anchor.set(.5);s.blendMode='add';app.stage.addChild(s);particles.push({s,delay:Math.random()*.65,x:200+(Math.random()-.5)*190,y:260+Math.random()*30,speed:70+Math.random()*80,size:3+Math.random()*5,phase:Math.random()*6.28});}
let t=3,active=false,wait=0,ac;const sr=44100,audio=new Float32Array(sr*1.7),notes=[523.25,659.25,783.99,1046.5];for(let i=0;i<audio.length;i++){const s=i/sr;let v=0;notes.forEach((f,j)=>{const h=s-j*.115;if(h>=0){const env=(1-Math.exp(-h*95))*Math.exp(-h*(j===3?3.3:4.5));v+=(Math.sin(2*Math.PI*f*h)+.21*Math.sin(2*Math.PI*f*2*h)+.09*Math.sin(2*Math.PI*f*3*h))*env*.115;const e=h-.17;if(e>=0)v+=Math.sin(2*Math.PI*f*e)*Math.exp(-e*5)*.025;}});audio[i]=v*.8;}
async function sound(){if(!q('sound').checked)return;try{ac??=getAudioContext();await ac.resume();const b=ac.createBuffer(1,audio.length,sr);b.copyToChannel(audio,0);const s=ac.createBufferSource(),gain=ac.createGain();s.buffer=b;s.playbackRate.value=+q('speed').value;gain.gain.value=.65 * volume();s.connect(gain).connect(ac.destination);s.start();}catch(e){q('sound').checked=false;}}
function play(audible=true){t=0;active=true;wait=0;if(audible)sound();}
function cross(x,y,size,alpha){const w=size*.27;fx.rect(x-w/2,y-size/2,w,size).rect(x-size/2,y-w/2,size,w).fill({color:0xa3ffca,alpha});}
app.ticker.add(ticker=>{const dt=Math.min(ticker.deltaMS/1000,.05);t+=dt*+q('speed').value;rear.clear();fx.clear();particles.forEach(p=>p.s.alpha=0);if(active){const env=Math.min(1,t/.18)*Math.min(1,Math.max(0,(1.65-t)/.4));
for(let k=0;k<3;k++){rear.ellipse(200,274,88+k*8,18+k*3).stroke({color:0x39ef8c,width:2-k*.4,alpha:env*(.45-k*.1)});}
for(let k=0;k<2;k++){const h=(t*.72+k*.5)%1,r=82+h*21;rear.circle(200,200,r).stroke({color:0x39ef8c,width:2,alpha:env*(1-h)*.32});}
for(let k=0;k<2;k++){const y=270-((t*92+k*70)%170);fx.ellipse(200,y,72,10).stroke({color:0x78ffb0,width:1.7,alpha:env*.38});}
for(const p of particles){const age=t-p.delay;if(age<0||age>1.1)continue;const a=Math.sin(Math.PI*age/1.1)*env,x=p.x+Math.sin(age*4+p.phase)*8,y=p.y-age*p.speed;p.s.position.set(x,y);p.s.width=p.s.height=p.size*3;p.s.alpha=a*.65;if(p.size>6){fx.moveTo(x-4,y).lineTo(x+4,y).moveTo(x,y-5).lineTo(x,y+5).stroke({color:0xd5ffe6,width:1.2,alpha:a*.8});}}
for(let k=0;k<4;k++){const age=t-k*.18;if(age>0&&age<1.05){const x=200+[-45,45,-16,22][k],y=250-age*110+Math.sin(k)*8,a=Math.sin(Math.PI*age/1.05)*env;cross(x,y,11+k%2*4,a*.85);}}
if(t>1.7){active=false;rear.clear();fx.clear();}}
if(!active&&q('loop').checked){wait+=dt;if(wait>.6)play();}});

return { play, stopSound() {  } };
},
"buff"(app, q, getAudioContext, volume) {
const rear=new PIXI.Graphics(),target=new PIXI.Container(),fx=new PIXI.Graphics();app.stage.addChild(rear,target,fx);
const cv=document.createElement('canvas');cv.width=cv.height=128;const c=cv.getContext('2d'),gr=c.createRadialGradient(64,64,0,64,64,64);gr.addColorStop(0,'#e4f5ff');gr.addColorStop(.12,'#79bfff');gr.addColorStop(.4,'#167aff50');gr.addColorStop(1,'#0055ff00');c.fillStyle=gr;c.fillRect(0,0,128,128);const tx=PIXI.Texture.from(cv),particles=[];
for(let i=0;i<28;i++){const s=new PIXI.Sprite(tx);s.anchor.set(.5);s.blendMode='add';app.stage.addChild(s);particles.push({s,x:200+(Math.random()-.5)*175,y:280+Math.random()*15,delay:Math.random()*.6,speed:115+Math.random()*60,size:2+Math.random()*3});}
let t=3,active=false,wait=0,ac;const sr=44100,audio=new Float32Array(Math.floor(sr*1.6));for(let i=0;i<audio.length;i++){const s=i/sr,env=(1-Math.exp(-s*25))*Math.exp(-s*4);let v=Math.sin(2*Math.PI*(260*s+390*s*s))*env*.08;[392,587.33,783.99].forEach((f,k)=>{const h=s-.10-k*.13;if(h>=0){const e=(1-Math.exp(-h*80))*Math.exp(-h*4.8);v+=(Math.sin(2*Math.PI*f*h)+.16*Math.sin(2*Math.PI*2*f*h))*e*.115;}});const h=s-.48;if(h>=0)v+=(Math.sin(2*Math.PI*1046.5*h)+.18*Math.sin(2*Math.PI*1568*h))*Math.exp(-h*5)*(1-Math.exp(-h*100))*.11;audio[i]=v*.8;}
async function sound(){if(!q('sound').checked)return;try{ac??=getAudioContext();await ac.resume();const b=ac.createBuffer(1,audio.length,sr);b.copyToChannel(audio,0);const s=ac.createBufferSource(),gain=ac.createGain();s.buffer=b;s.playbackRate.value=+q('speed').value;gain.gain.value=.65 * volume();s.connect(gain).connect(ac.destination);s.start();}catch(e){q('sound').checked=false;}}
function play(audible=true){t=0;active=true;wait=0;if(audible)sound();}
function chevron(x,y,w,a){fx.moveTo(x-w,y+8).lineTo(x,y-5).lineTo(x+w,y+8).stroke({color:0xa1d4ff,width:4,alpha:a});}
app.ticker.add(ticker=>{const dt=Math.min(ticker.deltaMS/1000,.05);t+=dt*+q('speed').value;rear.clear();fx.clear();particles.forEach(p=>p.s.alpha=0);if(active){const env=Math.min(1,t/.18)*Math.min(1,Math.max(0,(1.6-t)/.4));
rear.ellipse(200,278,99,22).stroke({color:0x287cff,width:3,alpha:env*.8});rear.ellipse(200,278,85,17).stroke({color:0x72c0ff,width:1.4,alpha:env*.5});
for(let k=0;k<12;k++){const a=k*Math.PI/6+t*.7,x=200+99*Math.cos(a),y=278+22*Math.sin(a);rear.moveTo(x,y).lineTo(200+107*Math.cos(a),278+25*Math.sin(a)).stroke({color:0x87caff,width:2,alpha:env*.7});}
for(let side of [-1,1]){for(let k=0;k<3;k++){const x=200+side*(88+k*8),top=270-Math.min(180,t*340);rear.moveTo(x,276).lineTo(x,top).stroke({color:0x2077ff,width:8-k*2,alpha:env*(.17-k*.04)});}fx.moveTo(200+side*85,265).lineTo(200+side*85,155).stroke({color:0x52a2ff,width:2,alpha:env*.38});}
for(let k=0;k<3;k++){const age=t-k*.16;if(age>0&&age<1.05){const e=Math.sin(Math.PI*age/1.05)*env,y=250-age*125;chevron(200,y,18,e*.9);chevron(200,y+12,18,e*.42);}}
for(let side of [-1,1]){for(let k=0;k<2;k++){const age=t-.12-k*.23;if(age>0&&age<.9){const y=262-age*128;chevron(200+side*58,y,9,Math.sin(Math.PI*age/.9)*env*.7);}}}
const pulse=t-.45;if(pulse>=0){rear.circle(200,200,83+pulse*25).stroke({color:0x408fff,width:2.5,alpha:Math.exp(-pulse*5)*env*.65});}
for(const p of particles){const age=t-p.delay;if(age<0||age>.95)continue;p.s.position.set(p.x,p.y-age*p.speed);p.s.width=p.size*1.8;p.s.height=p.size*4;p.s.alpha=Math.sin(Math.PI*age/.95)*env*.65;}
if(t>1.65){active=false;rear.clear();fx.clear();}}if(!active&&q('loop').checked){wait+=dt;if(wait>.6)play();}});

return { play, stopSound() {  } };
},
"revive"(app, q, getAudioContext, volume) {
const rear=new PIXI.Graphics(),target=new PIXI.Container(),fx=new PIXI.Graphics();app.stage.addChild(rear,target,fx);
function tex(beam){const cv=document.createElement('canvas');cv.width=cv.height=128;const c=cv.getContext('2d');let gr;if(beam){gr=c.createLinearGradient(0,0,128,0);gr.addColorStop(0,'#ffbb0000');gr.addColorStop(.3,'#ffd45c16');gr.addColorStop(.5,'#fff0ba88');gr.addColorStop(.7,'#ffd45c16');gr.addColorStop(1,'#ffbb0000');}else{gr=c.createRadialGradient(64,64,0,64,64,64);gr.addColorStop(0,'#fff8dd');gr.addColorStop(.14,'#ffe3a0');gr.addColorStop(.4,'#ffbc3340');gr.addColorStop(1,'#ffaa0000');}c.fillStyle=gr;c.fillRect(0,0,128,128);return PIXI.Texture.from(cv);}
const tx=tex(false),beam=new PIXI.Sprite(tex(true));beam.anchor.set(.5,1);beam.position.set(200,282);beam.width=155;beam.height=255;beam.blendMode='add';app.stage.addChild(beam);const flare=new PIXI.Sprite(tx);flare.anchor.set(.5);flare.position.set(200,200);flare.blendMode='add';app.stage.addChild(flare);
const particles=[];for(let i=0;i<44;i++){const s=new PIXI.Sprite(tx);s.anchor.set(.5);s.blendMode='add';app.stage.addChild(s);particles.push({s,x:200+(Math.random()-.5)*185,y:278+Math.random()*12,delay:.15+Math.random()*.8,speed:85+Math.random()*115,size:2+Math.random()*4,phase:Math.random()*6.28});}
let t=4,active=false,wait=0,ac;const sr=44100,audio=new Float32Array(Math.floor(sr*2.4)),chord=[523.25,659.25,783.99];for(let i=0;i<audio.length;i++){const s=i/sr;let v=0;chord.forEach((f,k)=>{const h=s-.1-k*.08;if(h>=0){const e=(1-Math.exp(-h*8))*Math.exp(-h*2.2);v+=(Math.sin(2*Math.PI*f*h)+.13*Math.sin(2*Math.PI*f*2*h))*e*.085;}});[1046.5,1318.51,1567.98].forEach((f,k)=>{const h=s-.48-k*.095;if(h>=0){const e=(1-Math.exp(-h*110))*Math.exp(-h*3.5);v+=(Math.sin(2*Math.PI*f*h)+.22*Math.sin(2*Math.PI*f*2.76*h))*e*.09;const d=h-.18;if(d>=0)v+=Math.sin(2*Math.PI*f*d)*Math.exp(-d*4)*.018;}});audio[i]=v*.8;}
async function sound(){if(!q('sound').checked)return;try{ac??=getAudioContext();await ac.resume();const b=ac.createBuffer(1,audio.length,sr);b.copyToChannel(audio,0);const s=ac.createBufferSource(),gain=ac.createGain();s.buffer=b;s.playbackRate.value=+q('speed').value;gain.gain.value=.65 * volume();s.connect(gain).connect(ac.destination);s.start();}catch(e){q('sound').checked=false;}}
function play(audible=true){t=0;active=true;wait=0;if(audible)sound();}
app.ticker.add(ticker=>{const dt=Math.min(ticker.deltaMS/1000,.05);t+=dt*+q('speed').value;rear.clear();fx.clear();beam.alpha=flare.alpha=0;particles.forEach(p=>p.s.alpha=0);if(active){const env=Math.min(1,t/.25)*Math.min(1,Math.max(0,(2.15-t)/.55)),rise=Math.min(1,t/.5);
rear.ellipse(200,280,96,22).stroke({color:0xffd66b,width:2.8,alpha:env*.85});rear.ellipse(200,280,81,16).stroke({color:0xffefb2,width:1.2,alpha:env*.6});
for(let k=0;k<16;k++){const a=k*Math.PI/8+t*.32;rear.moveTo(200+99*Math.cos(a),280+23*Math.sin(a)).lineTo(200+107*Math.cos(a),280+27*Math.sin(a)).stroke({color:0xffdc88,width:1.8,alpha:env*.65});}
beam.height=255*rise;beam.width=130+22*Math.sin(t*2);beam.alpha=env*.7;
const h=t-.48;if(h>=0){fx.ellipse(200,102,34,8).stroke({color:0xffeab2,width:3,alpha:env*Math.min(1,h/.2)});flare.width=flare.height=170+h*95;flare.alpha=Math.exp(-h*12)*.68;
}
for(const p of particles){const age=t-p.delay;if(age<0||age>1.25)continue;const x=p.x+Math.sin(age*3+p.phase)*9,y=p.y-age*p.speed,a=Math.sin(Math.PI*age/1.25)*env;p.s.position.set(x,y);p.s.width=p.s.height=p.size*3;p.s.alpha=a*.7;if(p.size>4.7){fx.moveTo(x-4,y).lineTo(x+4,y).moveTo(x,y-6).lineTo(x,y+6).stroke({color:0xfff2c9,width:1.2,alpha:a});}}
if(t>2.2){active=false;rear.clear();fx.clear();}}if(!active&&q('loop').checked){wait+=dt;if(wait>.65)play();}});

return { play, stopSound() {  } };
},
"debuff"(app, q, getAudioContext, volume) {
const rear=new PIXI.Graphics(),target=new PIXI.Container(),fx=new PIXI.Graphics();app.stage.addChild(rear,target,fx);
const cv=document.createElement('canvas');cv.width=cv.height=128;const c=cv.getContext('2d'),gr=c.createRadialGradient(64,64,0,64,64,64);gr.addColorStop(0,'#ffe4e4');gr.addColorStop(.12,'#ff7979');gr.addColorStop(.4,'#ff163350');gr.addColorStop(1,'#ff002200');c.fillStyle=gr;c.fillRect(0,0,128,128);const tx=PIXI.Texture.from(cv),particles=[];
for(let i=0;i<28;i++){const s=new PIXI.Sprite(tx);s.anchor.set(.5);s.blendMode='add';app.stage.addChild(s);particles.push({s,x:200+(Math.random()-.5)*175,y:100+Math.random()*15,delay:Math.random()*.6,speed:115+Math.random()*60,size:2+Math.random()*3});}
let t=3,active=false,wait=0,ac;const sr=44100,audio=new Float32Array(Math.floor(sr*1.6));for(let i=0;i<audio.length;i++){const s=i/sr,env=(1-Math.exp(-s*25))*Math.exp(-s*4);let v=Math.sin(2*Math.PI*(520*s-160*s*s))*env*.08;[392,311.13,233.08].forEach((f,k)=>{const h=s-.10-k*.13;if(h>=0){const e=(1-Math.exp(-h*80))*Math.exp(-h*4.8);v+=(Math.sin(2*Math.PI*f*h)+.16*Math.sin(2*Math.PI*2*f*h))*e*.115;}});const h=s-.48;if(h>=0)v+=(Math.sin(2*Math.PI*174.61*h)+.18*Math.sin(2*Math.PI*349.23*h))*Math.exp(-h*5)*(1-Math.exp(-h*100))*.11;audio[i]=v*.8;}
async function sound(){if(!q('sound').checked)return;try{ac??=getAudioContext();await ac.resume();const b=ac.createBuffer(1,audio.length,sr);b.copyToChannel(audio,0);const s=ac.createBufferSource(),gain=ac.createGain();s.buffer=b;s.playbackRate.value=+q('speed').value;gain.gain.value=.65 * volume();s.connect(gain).connect(ac.destination);s.start();}catch(e){q('sound').checked=false;}}
function play(audible=true){t=0;active=true;wait=0;if(audible)sound();}
function chevron(x,y,w,a){fx.moveTo(x-w,y-8).lineTo(x,y+5).lineTo(x+w,y-8).stroke({color:0xffa1aa,width:4,alpha:a});}
app.ticker.add(ticker=>{const dt=Math.min(ticker.deltaMS/1000,.05);t+=dt*+q('speed').value;rear.clear();fx.clear();particles.forEach(p=>p.s.alpha=0);if(active){const env=Math.min(1,t/.18)*Math.min(1,Math.max(0,(1.6-t)/.4));
rear.ellipse(200,278,99,22).stroke({color:0xef2944,width:3,alpha:env*.8});rear.ellipse(200,278,85,17).stroke({color:0xff7288,width:1.4,alpha:env*.5});
for(let k=0;k<12;k++){const a=k*Math.PI/6+t*.7,x=200+99*Math.cos(a),y=278+22*Math.sin(a);rear.moveTo(x,y).lineTo(200+107*Math.cos(a),278+25*Math.sin(a)).stroke({color:0xff879a,width:2,alpha:env*.7});}
for(let side of [-1,1]){for(let k=0;k<3;k++){const x=200+side*(88+k*8),bottom=115+Math.min(180,t*340);rear.moveTo(x,110).lineTo(x,bottom).stroke({color:0xef203a,width:8-k*2,alpha:env*(.17-k*.04)});}fx.moveTo(200+side*85,265).lineTo(200+side*85,155).stroke({color:0xff5269,width:2,alpha:env*.38});}
for(let k=0;k<3;k++){const age=t-k*.16;if(age>0&&age<1.05){const e=Math.sin(Math.PI*age/1.05)*env,y=140+age*125;chevron(200,y,18,e*.9);chevron(200,y-12,18,e*.42);}}
for(let side of [-1,1]){for(let k=0;k<2;k++){const age=t-.12-k*.23;if(age>0&&age<.9){const y=137+age*128;chevron(200+side*58,y,9,Math.sin(Math.PI*age/.9)*env*.7);}}}
const pulse=t-.45;if(pulse>=0){rear.circle(200,200,83+pulse*25).stroke({color:0xff4058,width:2.5,alpha:Math.exp(-pulse*5)*env*.65});}
for(const p of particles){const age=t-p.delay;if(age<0||age>.95)continue;p.s.position.set(p.x,p.y+age*p.speed);p.s.width=p.size*1.8;p.s.height=p.size*4;p.s.alpha=Math.sin(Math.PI*age/.95)*env*.65;}
if(t>1.65){active=false;rear.clear();fx.clear();}}if(!active&&q('loop').checked){wait+=dt;if(wait>.6)play();}});

return { play, stopSound() {  } };
},
"stun"(app, q, getAudioContext, volume) {
const back=new PIXI.Graphics(),target=new PIXI.Container(),front=new PIXI.Graphics();app.stage.addChild(back,target,front);
function star(g,x,y,r,rot,alpha){const p=[];for(let i=0;i<10;i++){const a=rot-Math.PI/2+i*Math.PI/5,d=i%2?r*.44:r;p.push(x+Math.cos(a)*d,y+Math.sin(a)*d);}g.poly(p).fill({color:0xffd34d,alpha}).stroke({color:0xffedb0,width:1.2,alpha});}
let t=4,active=false,wait=0,ac;const sr=44100,audio=new Float32Array(Math.floor(sr*1.8));for(let i=0;i<audio.length;i++){const s=i/sr;let v=0;[880,1174.66,987.77,1318.51].forEach((f,k)=>{const h=s-k*.115;if(h>=0){const e=(1-Math.exp(-h*140))*Math.exp(-h*6),phase=2*Math.PI*(f*h+7*(1-Math.cos(h*27)));v+=(Math.sin(phase)+.22*Math.sin(phase*2.41))*e*.135;const d=h-.15;if(d>=0)v+=Math.sin(2*Math.PI*f*d)*Math.exp(-d*7)*.02;}});audio[i]=v*.8;}
async function sound(){if(!q('sound').checked)return;try{ac??=getAudioContext();await ac.resume();const b=ac.createBuffer(1,audio.length,sr);b.copyToChannel(audio,0);const s=ac.createBufferSource(),gain=ac.createGain();s.buffer=b;s.playbackRate.value=+q('speed').value;gain.gain.value=.65 * volume();s.connect(gain).connect(ac.destination);s.start();}catch(e){q('sound').checked=false;}}
function play(audible=true){t=0;active=true;wait=0;if(audible)sound();}
app.ticker.add(ticker=>{const dt=Math.min(ticker.deltaMS/1000,.05);t+=dt*+q('speed').value;back.clear();front.clear();if(active){const env=Math.min(1,t/.16)*Math.min(1,Math.max(0,(2.15-t)/.35));
for(let j=0;j<2;j++){const g=j?front:back,start=j?0:Math.PI;for(let k=0;k<3;k++){const a=start+k*Math.PI/3+.14,b=a+.6;g.moveTo(200+68*Math.cos(a),112+14*Math.sin(a));for(let n=1;n<=12;n++){const z=a+(b-a)*n/12;g.lineTo(200+68*Math.cos(z),112+14*Math.sin(z));}g.stroke({color:0xecc258,width:1.5,alpha:env*.25});}}
for(let k=0;k<3;k++){const a=t*3.6+k*Math.PI*2/3,x=200+68*Math.cos(a),y=112+14*Math.sin(a),depth=(Math.sin(a)+1)/2,g=Math.sin(a)<0?back:front,r=(11+depth*4)*Math.min(1,t/.15);for(let trail=4;trail>=1;trail--){const z=a-trail*.10;star(g,200+68*Math.cos(z),112+14*Math.sin(z),r*.65,t*.9+k,env*(.035+(4-trail)*.018));}star(g,x,y,r,t*.9+k*.5,env*(.65+depth*.35));}
for(let k=0;k<4;k++){const age=t-.07-k*.04;if(age>0&&age<.38){const a=k*Math.PI/2+.3,r=28+age*85;star(front,200+Math.cos(a)*r,110+Math.sin(a)*r*.5,4,age*3,(1-age/.38)*.7);}}
if(t>2.2){active=false;back.clear();front.clear();}}if(!active&&q('loop').checked){wait+=dt;if(wait>.6)play();}});

return { play, stopSound() {  } };
},
"poison"(app, q, getAudioContext, volume) {
const rear=new PIXI.Container(),target=new PIXI.Container(),fx=new PIXI.Graphics();app.stage.addChild(rear,target);
const cv=document.createElement('canvas');cv.width=cv.height=128;const c=cv.getContext('2d'),gr=c.createRadialGradient(64,64,0,64,64,64);gr.addColorStop(0,'#79b51a80');gr.addColorStop(.35,'#437f1960');gr.addColorStop(.7,'#2c650a22');gr.addColorStop(1,'#19440000');c.fillStyle=gr;c.fillRect(0,0,128,128);const tx=PIXI.Texture.from(cv),clouds=[];
for(let i=0;i<16;i++){const s=new PIXI.Sprite(tx);s.anchor.set(.5);(i<10?rear:app.stage).addChild(s);clouds.push({s,x:200+(Math.random()-.5)*145,y:273+Math.random()*15,delay:Math.random()*.6,speed:30+Math.random()*42,size:48+Math.random()*36,phase:Math.random()*6.28});}app.stage.addChild(fx);
const bubbles=Array.from({length:14},()=>({x:200+(Math.random()-.5)*185,y:280,delay:Math.random()*.85,speed:65+Math.random()*80,r:3+Math.random()*6,phase:Math.random()*6.28}));
let t=4,active=false,wait=0,ac;const sr=44100,audio=new Float32Array(Math.floor(sr*1.9));let seed=71,low=0;for(let i=0;i<audio.length;i++){const s=i/sr;seed=seed*16807%2147483647;const n=seed/2147483647*2-1;low=low*.93+n*.07;const env=Math.min(1,s/.12)*Math.exp(-s*2.8);let v=low*env*.65;[.04,.23,.42,.67,.91].forEach((start,k)=>{const h=s-start;if(h>=0&&h<.2){const f=150+k*21,phase=2*Math.PI*(f*h+f*.028*(1-Math.exp(-h*35)));v+=Math.sin(phase)*Math.sin(Math.min(1,h/.012)*Math.PI/2)*Math.exp(-h*24)*.17;}});audio[i]=Math.tanh(v)*.8;}
async function sound(){if(!q('sound').checked)return;try{ac??=getAudioContext();await ac.resume();const b=ac.createBuffer(1,audio.length,sr);b.copyToChannel(audio,0);const s=ac.createBufferSource(),gain=ac.createGain();s.buffer=b;s.playbackRate.value=+q('speed').value;gain.gain.value=.75 * volume();s.connect(gain).connect(ac.destination);s.start();}catch(e){q('sound').checked=false;}}
function play(audible=true){t=0;active=true;wait=0;if(audible)sound();}
app.ticker.add(ticker=>{const dt=Math.min(ticker.deltaMS/1000,.05);t+=dt*+q('speed').value;fx.clear();clouds.forEach(p=>p.s.alpha=0);if(active){const env=Math.min(1,t/.18)*Math.min(1,Math.max(0,(2.15-t)/.5));
for(const p of clouds){const age=t-p.delay;if(age<0||age>1.65)continue;p.s.position.set(p.x+Math.sin(age*2+p.phase)*14,p.y-age*p.speed);p.s.width=p.size+age*28;p.s.height=p.size*.75+age*35;p.s.alpha=Math.sin(Math.PI*age/1.65)*env*.55;}
for(const p of bubbles){const age=t-p.delay;if(age<0||age>1.12)continue;const a=Math.sin(Math.PI*age/1.12)*env,x=p.x+Math.sin(age*4+p.phase)*6,y=p.y-age*p.speed,r=p.r*(.65+age*.5);fx.circle(x,y,r).fill({color:0x487d13,alpha:a*.3}).stroke({color:0x95cb37,width:1.4,alpha:a*.75});fx.circle(x-r*.28,y-r*.32,r*.18).fill({color:0xc0e66a,alpha:a*.7});}
for(let k=0;k<3;k++){const age=t-.18-k*.24;if(age>0&&age<.8){const x=200+[-64,69,12][k],y=145+age*92,a=Math.sin(Math.PI*age/.8)*env;fx.moveTo(x,y-9).bezierCurveTo(x+8,y+1,x+6,y+9,x,y+9).bezierCurveTo(x-6,y+9,x-8,y+1,x,y-9).fill({color:0x95c52f,alpha:a*.8});}}
if(t>2.2){active=false;fx.clear();}}if(!active&&q('loop').checked){wait+=dt;if(wait>.6)play();}});

return { play, stopSound() {  } };
},
"bleed"(app, q, getAudioContext, volume) {
const target=new PIXI.Container(),fx=new PIXI.Graphics();app.stage.addChild(target,fx);
const drops=Array.from({length:12},(_,i)=>({x:200+(Math.random()-.5)*115,y:173+Math.random()*44,delay:.06+i*.075,r:3+Math.random()*3.5,vx:(Math.random()-.5)*22}));
const splashes=Array.from({length:19},()=>({a:Math.random()*Math.PI*2,speed:30+Math.random()*110,r:1.5+Math.random()*2.2,delay:Math.random()*.09}));
let t=3,active=false,wait=0,ac;const sr=44100,audio=new Float32Array(Math.floor(sr*1.5));let seed=89,low=0;for(let i=0;i<audio.length;i++){const time=i/sr;seed=seed*16807%2147483647;const noise=seed/2147483647*2-1;low=low*.8+noise*.2;let v=0;const h=time-.015;if(h>=0){const env=(1-Math.exp(-h*170))*Math.exp(-h*28);v+=(low*.44+Math.sin(2*Math.PI*(130*h-90*h*h))*.26)*env+(noise-low)*Math.exp(-h*95)*.085;}[.22,.48,.75].forEach((start,k)=>{const d=time-start;if(d>=0&&d<.18){const env=(1-Math.exp(-d*250))*Math.exp(-d*40);v+=(low*.22+Math.sin(2*Math.PI*((105-k*8)*d-65*d*d))*.19)*env;}});audio[i]=Math.tanh(v)*.85;}
async function sound(){if(!q('sound').checked)return;try{ac??=getAudioContext();await ac.resume();const b=ac.createBuffer(1,audio.length,sr);b.copyToChannel(audio,0);const s=ac.createBufferSource(),gain=ac.createGain();s.buffer=b;s.playbackRate.value=+q('speed').value;gain.gain.value=.7 * volume();s.connect(gain).connect(ac.destination);s.start();}catch(e){q('sound').checked=false;}}
function play(audible=true){t=0;active=true;wait=0;if(audible)sound();}
function drop(x,y,r,a,stretch){fx.moveTo(x,y-r*stretch).bezierCurveTo(x+r*.3,y-r*.5,x+r,y,x+r,y+r*.35).bezierCurveTo(x+r,y+r*1.5,x-r,y+r*1.5,x-r,y+r*.35).bezierCurveTo(x-r,y,x-r*.3,y-r*.5,x,y-r*stretch).fill({color:0xd72a40,alpha:a});fx.ellipse(x-r*.28,y+r*.12,r*.17,r*.35).fill({color:0xff7281,alpha:a*.6});}
app.ticker.add(ticker=>{const dt=Math.min(ticker.deltaMS/1000,.05);t+=dt*+q('speed').value;fx.clear();if(active){const env=Math.min(1,t/.06)*Math.min(1,Math.max(0,(1.85-t)/.35));
for(const p of splashes){const h=t-p.delay;if(h<0||h>.48)continue;const x=200+Math.cos(p.a)*p.speed*h,y=191+Math.sin(p.a)*p.speed*h+125*h*h,a=(1-h/.48)*env;fx.ellipse(x,y,p.r,p.r*(1+h)).fill({color:0xed3447,alpha:a});}
for(const p of drops){const h=t-p.delay;if(h<0||h>.9)continue;const x=p.x+p.vx*h,y=p.y+22*h+170*h*h,a=Math.min(1,h/.06)*Math.min(1,(.9-h)/.22)*env;drop(x,y,p.r,a,1.6+Math.min(h*2,1));if(h>.08){fx.moveTo(x,y-15).lineTo(x-p.vx*.06,y-24).stroke({color:0xb71931,width:p.r*.45,alpha:a*.24});}}
for(let k=0;k<3;k++){const h=t-.08-k*.2;if(h>0&&h<.5){const x=200+[-28,32,3][k],y=190+[-9,8,17][k];fx.ellipse(x,y,11+5*h,3).fill({color:0xc71f36,alpha:Math.sin(Math.PI*h/.5)*.25});}}
if(t>1.9){active=false;fx.clear();}}if(!active&&q('loop').checked){wait+=dt;if(wait>.6)play();}});

return { play, stopSound() {  } };
},
"shield"(app, q, getAudioContext, volume) {
const back=new PIXI.Graphics(),target=new PIXI.Container(),fx=new PIXI.Graphics();app.stage.addChild(back,target);
const outerGlow=new PIXI.Graphics();outerGlow.blendMode='add';outerGlow.filters=[new PIXI.BlurFilter({strength:6,quality:4})];app.stage.addChild(outerGlow,fx);
let t=4,active=false,wait=0,ac;const sr=44100,audio=new Float32Array(Math.floor(sr*1.8));for(let i=0;i<audio.length;i++){const time=i/sr,env=(1-Math.exp(-time*18))*Math.exp(-time*4);let v=(Math.sin(2*Math.PI*(180*time+240*time*time))*.10+Math.sin(2*Math.PI*220*time)*.045)*env;const h=time-.27;if(h>=0){const e=(1-Math.exp(-h*120))*Math.exp(-h*5);v+=(Math.sin(2*Math.PI*783.99*h)+.25*Math.sin(2*Math.PI*1174.66*h)+.12*Math.sin(2*Math.PI*1567.98*h))*e*.12;}audio[i]=v*.85;}
async function sound(){if(!q('sound').checked)return;try{ac??=getAudioContext();await ac.resume();const b=ac.createBuffer(1,audio.length,sr);b.copyToChannel(audio,0);const s=ac.createBufferSource(),gain=ac.createGain();s.buffer=b;s.playbackRate.value=+q('speed').value;gain.gain.value=.65 * volume();s.connect(gain).connect(ac.destination);s.start();}catch(e){q('sound').checked=false;}}
function play(audible=true){t=0;active=true;wait=0;if(audible)sound();}
function arc(g,r,start,end,width,color,alpha){g.moveTo(200+Math.cos(start)*r,200+Math.sin(start)*r);for(let i=1;i<=50;i++){const a=start+(end-start)*i/50;g.lineTo(200+Math.cos(a)*r,200+Math.sin(a)*r);}g.stroke({color,width,alpha});}
const cells=[];const size=12;for(let col=-5;col<=5;col++){for(let row=-5;row<=5;row++){const x=col*size*1.5,y=(row+(Math.abs(col)%2)*.5)*size*Math.sqrt(3);if(Math.hypot(x,y)+size<90)cells.push({x,y});}}
app.ticker.add(ticker=>{const dt=Math.min(ticker.deltaMS/1000,.05);t+=dt*+q('speed').value;back.clear();fx.clear();outerGlow.clear();if(active){const env=Math.min(1,t/.20)*Math.min(1,Math.max(0,(2.15-t)/.4)),build=Math.min(1,t/.32),r=85+12*(1-Math.pow(1-build,3));
outerGlow.circle(200,200,r+3).stroke({color:0x38c9e8,width:11,alpha:env*.24});
outerGlow.circle(200,200,r+8).stroke({color:0x209fc9,width:8,alpha:env*.12});back.circle(200,200,r).fill({color:0x20788b,alpha:env*.075});
arc(fx,r,-Math.PI/2,-Math.PI/2+Math.PI*2*build,2,0x67d9ef,env*.35);arc(fx,r+5,-Math.PI/2,-Math.PI/2+Math.PI*2*build,1,0x31a9c9,env*.16);
if(build>=1){const a=-Math.PI/2+(t-.32)*2.4;arc(fx,r,a,a+.65,3,0xc6faff,env*.48);arc(fx,r,a+Math.PI,a+Math.PI+.3,2,0x8ce8f5,env*.28);}
const h=t-.32;if(h>=0){const sweep=-92+h*150;for(const cell of cells){const band=Math.max(0,1-Math.abs(cell.y-sweep)/48);const a=env*(.28+band*.42)*Math.min(1,h/.16);if(a<=0)continue;const pts=[];for(let k=0;k<6;k++){const z=k*Math.PI/3;pts.push(200+cell.x+Math.cos(z)*size,200+cell.y+Math.sin(z)*size);}fx.poly(pts).fill({color:0x289ab0,alpha:a*.09}).stroke({color:0x8ce6ef,width:1.35,alpha:a});}arc(fx,83+Math.min(h*65,35),0,Math.PI*2,1.5,0x9cf2fa,Math.exp(-h*9)*.24);}
if(t>2.2){active=false;back.clear();fx.clear();outerGlow.clear();}}if(!active&&q('loop').checked){wait+=dt;if(wait>.6)play();}});

return { play, stopSound() {  } };
},
"invincible"(app, q, getAudioContext, volume) {
const back=new PIXI.Graphics(),target=new PIXI.Container(),fx=new PIXI.Graphics();app.stage.addChild(back,target);
const outerGlow=new PIXI.Graphics();outerGlow.blendMode='add';outerGlow.filters=[new PIXI.BlurFilter({strength:6,quality:4})];app.stage.addChild(outerGlow,fx);
let t=4,active=false,wait=0,ac;const sr=44100,audio=new Float32Array(Math.floor(sr*1.8));for(let i=0;i<audio.length;i++){const time=i/sr,env=(1-Math.exp(-time*18))*Math.exp(-time*4);let v=(Math.sin(2*Math.PI*(261.63*time+320*time*time))*.10+Math.sin(2*Math.PI*261.63*time)*.045)*env;const h=time-.27;if(h>=0){const e=(1-Math.exp(-h*120))*Math.exp(-h*5);v+=(Math.sin(2*Math.PI*1046.5*h)+.25*Math.sin(2*Math.PI*1318.51*h)+.12*Math.sin(2*Math.PI*1567.98*h))*e*.12;}audio[i]=v*.85;}
async function sound(){if(!q('sound').checked)return;try{ac??=getAudioContext();await ac.resume();const b=ac.createBuffer(1,audio.length,sr);b.copyToChannel(audio,0);const s=ac.createBufferSource(),gain=ac.createGain();s.buffer=b;s.playbackRate.value=+q('speed').value;gain.gain.value=.65 * volume();s.connect(gain).connect(ac.destination);s.start();}catch(e){q('sound').checked=false;}}
function play(audible=true){t=0;active=true;wait=0;if(audible)sound();}
function arc(g,r,start,end,width,color,alpha){g.moveTo(200+Math.cos(start)*r,200+Math.sin(start)*r);for(let i=1;i<=50;i++){const a=start+(end-start)*i/50;g.lineTo(200+Math.cos(a)*r,200+Math.sin(a)*r);}g.stroke({color,width,alpha});}

app.ticker.add(ticker=>{const dt=Math.min(ticker.deltaMS/1000,.05);t+=dt*+q('speed').value;back.clear();fx.clear();outerGlow.clear();if(active){const env=Math.min(1,t/.20)*Math.min(1,Math.max(0,(2.15-t)/.4)),build=Math.min(1,t/.32),r=85+12*(1-Math.pow(1-build,3));
outerGlow.circle(200,200,r+3).stroke({color:0xffcd4e,width:11,alpha:env*.3});
outerGlow.circle(200,200,r+8).stroke({color:0xffa822,width:8,alpha:env*.16});back.circle(200,200,r).fill({color:0xad781e,alpha:env*.075});
arc(fx,r,-Math.PI/2,-Math.PI/2+Math.PI*2*build,2,0xffde88,env*.35);arc(fx,r+5,-Math.PI/2,-Math.PI/2+Math.PI*2*build,1,0xffc64a,env*.16);
if(build>=1){const a=-Math.PI/2+(t-.32)*2.4;arc(fx,r,a,a+.65,3,0xfff4cb,env*.48);arc(fx,r,a+Math.PI,a+Math.PI+.3,2,0xffe89b,env*.28);}
const h=t-.32;if(h>=0){const sweep=-125+h*205;
for(let k=0;k<9;k++){const offset=(k-4)*4,brightness=1-Math.abs(k-4)/5;const pts=[];for(let i=0;i<90;i++){const yy=-90+i*2,xx=sweep+offset+yy*.38;if(xx*xx+yy*yy<88*88)pts.push([200+xx,200+yy]);}if(pts.length>1){fx.moveTo(...pts[0]);for(let i=1;i<pts.length;i++)fx.lineTo(...pts[i]);fx.stroke({color:0xfff0b2,width:4,alpha:env*brightness*.17});}}
for(let k=0;k<3;k++){const phase=(h*.65+k*.33)%1,rr=97+phase*11;outerGlow.circle(200,200,rr).stroke({color:0xffc84e,width:4,alpha:env*(1-phase)*.14});}
for(let k=0;k<4;k++){const a=h*.7+k*Math.PI/2,xx=200+98*Math.cos(a),yy=200+98*Math.sin(a),v=env*(.5+.5*Math.sin(h*7+k));fx.moveTo(xx-5,yy).lineTo(xx+5,yy).moveTo(xx,yy-8).lineTo(xx,yy+8).stroke({color:0xffecb4,width:1.5,alpha:v*.65});}
arc(fx,83+Math.min(h*65,35),0,Math.PI*2,1.5,0xffe8a6,Math.exp(-h*9)*.24);}
if(t>2.2){active=false;back.clear();fx.clear();outerGlow.clear();}}if(!active&&q('loop').checked){wait+=dt;if(wait>.6)play();}});

return { play, stopSound() {  } };
},
"immunity"(app, q, getAudioContext, volume) {
const back=new PIXI.Graphics(),target=new PIXI.Container(),fx=new PIXI.Graphics();app.stage.addChild(back,target);
const outerGlow=new PIXI.Graphics();outerGlow.blendMode='add';outerGlow.filters=[new PIXI.BlurFilter({strength:6,quality:4})];app.stage.addChild(outerGlow,fx);
let t=4,active=false,wait=0,ac;const sr=44100,audio=new Float32Array(Math.floor(sr*1.8));for(let i=0;i<audio.length;i++){const time=i/sr,env=(1-Math.exp(-time*18))*Math.exp(-time*4);let v=(Math.sin(2*Math.PI*(261.63*time+320*time*time))*.10+Math.sin(2*Math.PI*261.63*time)*.045)*env;const h=time-.27;if(h>=0){const e=(1-Math.exp(-h*120))*Math.exp(-h*5);v+=(Math.sin(2*Math.PI*987.77*h)+.25*Math.sin(2*Math.PI*1481.65*h)+.12*Math.sin(2*Math.PI*1975.53*h))*e*.12;}audio[i]=v*.85;}
async function sound(){if(!q('sound').checked)return;try{ac??=getAudioContext();await ac.resume();const b=ac.createBuffer(1,audio.length,sr);b.copyToChannel(audio,0);const s=ac.createBufferSource(),gain=ac.createGain();s.buffer=b;s.playbackRate.value=+q('speed').value;gain.gain.value=.65 * volume();s.connect(gain).connect(ac.destination);s.start();}catch(e){q('sound').checked=false;}}
function play(audible=true){t=0;active=true;wait=0;if(audible)sound();}
function arc(g,r,start,end,width,color,alpha){g.moveTo(200+Math.cos(start)*r,200+Math.sin(start)*r);for(let i=1;i<=50;i++){const a=start+(end-start)*i/50;g.lineTo(200+Math.cos(a)*r,200+Math.sin(a)*r);}g.stroke({color,width,alpha});}

app.ticker.add(ticker=>{const dt=Math.min(ticker.deltaMS/1000,.05);t+=dt*+q('speed').value;back.clear();fx.clear();outerGlow.clear();if(active){const env=Math.min(1,t/.20)*Math.min(1,Math.max(0,(2.15-t)/.4)),build=Math.min(1,t/.32),r=85+12*(1-Math.pow(1-build,3));
outerGlow.circle(200,200,r+3).stroke({color:0x579df5,width:11,alpha:env*.3});
outerGlow.circle(200,200,r+8).stroke({color:0x2459bb,width:8,alpha:env*.16});back.circle(200,200,r).fill({color:0x264e87,alpha:env*.075});
arc(fx,r,-Math.PI/2,-Math.PI/2+Math.PI*2*build,2,0xadd4ff,env*.35);arc(fx,r+5,-Math.PI/2,-Math.PI/2+Math.PI*2*build,1,0x529bea,env*.16);
if(build>=1){const a=-Math.PI/2+(t-.32)*2.4;arc(fx,r,a,a+.65,3,0xe0f1ff,env*.48);arc(fx,r,a+Math.PI,a+Math.PI+.3,2,0xb4daff,env*.28);}
const h=t-.32;if(h>=0){const crossAlpha=env*Math.min(1,h/.18),crossShape=[186,162,214,162,214,186,238,186,238,214,214,214,214,238,186,238,186,214,162,214,162,186,186,186];
outerGlow.poly(crossShape).fill({color:0x4b9aff,alpha:crossAlpha*.3});
fx.poly(crossShape).fill({color:0xa7d4ff,alpha:crossAlpha*.86}).stroke({color:0xe0f1ff,width:1.5,alpha:crossAlpha*.75});
// Incoming status particles stop at the boundary and rebound.
for(let k=0;k<5;k++){const age=t-.10-k*.20;if(age<0||age>.66)continue;const angle=-Math.PI/2+k*Math.PI*2/5+.24,contact=.22;let dist,opacity;if(age<contact){dist=160-(160-99)*age/contact;opacity=Math.min(1,age/.05);}else{const elapsed=age-contact;dist=99+elapsed*115;opacity=Math.max(0,1-elapsed/.44);}const x=200+Math.cos(angle)*dist,y=200+Math.sin(angle)*dist;
fx.circle(x,y,3.2).fill({color:0x7bbaff,alpha:opacity*env*.8});fx.moveTo(x+Math.cos(angle)*5,y+Math.sin(angle)*5).lineTo(x+Math.cos(angle)*13,y+Math.sin(angle)*13).stroke({color:0x427db6,width:2,alpha:opacity*env*.35});
if(age>=contact){const elapsed=age-contact,a=Math.exp(-elapsed*12)*env;arc(fx,97,angle-.18-elapsed*.3,angle+.18+elapsed*.3,3,0xe0f1ff,a*.9);for(let j of [-1,1]){const cx=200+Math.cos(angle)*99,cy=200+Math.sin(angle)*99,z=angle+j*.75,l=elapsed*64;fx.circle(cx+Math.cos(z)*l,cy+Math.sin(z)*l,1.5).fill({color:0xbadfff,alpha:a});}}
}
arc(fx,83+Math.min(h*65,35),0,Math.PI*2,1.5,0xc2e5ff,Math.exp(-h*9)*.24);}
if(t>2.2){active=false;back.clear();fx.clear();outerGlow.clear();}}if(!active&&q('loop').checked){wait+=dt;if(wait>.6)play();}});

return { play, stopSound() {  } };
},
"wound"(app, q, getAudioContext, volume) {
const target=new PIXI.Container(),glow=new PIXI.Graphics(),marks=new PIXI.Graphics();glow.blendMode='add';glow.filters=[new PIXI.BlurFilter({strength:4,quality:3})];app.stage.addChild(target,glow,marks);
let t=3,active=false,wait=0,ac;const sr=44100,audio=new Float32Array(Math.floor(sr*.9));let seed=47,low=0;for(let i=0;i<audio.length;i++){const time=i/sr;seed=seed*16807%2147483647;const n=seed/2147483647*2-1;low=low*.68+n*.32;let v=0;for(let k=0;k<3;k++){const h=time-.035-k*.025;if(h>=0&&h<.2){const env=(1-Math.exp(-h*230))*Math.exp(-h*29);v+=((n-low)*.22+low*.26+Math.sin(2*Math.PI*(190*h-130*h*h))*.07)*env;}}audio[i]=Math.tanh(v)*.7;}
async function sound(){if(!q('sound').checked)return;try{ac??=getAudioContext();await ac.resume();const b=ac.createBuffer(1,audio.length,sr);b.copyToChannel(audio,0);const s=ac.createBufferSource(),gain=ac.createGain();s.buffer=b;s.playbackRate.value=+q('speed').value;gain.gain.value=.65 * volume();s.connect(gain).connect(ac.destination);s.start();}catch(e){q('sound').checked=false;}}
function play(audible=true){t=0;active=true;wait=0;if(audible)sound();}
function slash(g,x,y,len,width,progress,color,alpha){const ux=.64,uy=.768,nx=-uy,ny=ux,pts=[];const n=32;for(let i=0;i<=n;i++){const u=progress*i/n,dist=(u-.5)*len,w=Math.pow(Math.sin(Math.PI*u),.8)*width,bend=Math.sin(Math.PI*u)*2;pts.push(x+ux*dist+nx*(w+bend),y+uy*dist+ny*(w+bend));}for(let i=n;i>=0;i--){const u=progress*i/n,dist=(u-.5)*len,w=Math.pow(Math.sin(Math.PI*u),.8)*width,bend=Math.sin(Math.PI*u)*2;pts.push(x+ux*dist+nx*(-w+bend),y+uy*dist+ny*(-w+bend));}g.poly(pts).fill({color,alpha});}
app.ticker.add(ticker=>{const dt=Math.min(ticker.deltaMS/1000,.05);t+=dt*+q('speed').value;glow.clear();marks.clear();if(active){const fade=Math.min(1,Math.max(0,(1.7-t)/.45));for(let k=0;k<3;k++){const h=t-.025-k*.025;if(h<0)continue;const p=Math.min(1,h/.13),offset=(k-1)*25,x=200-offset*.768,y=200+offset*.64,len=k===1?132:119,flash=Math.exp(-Math.max(0,h-.13)*16);
slash(glow,x,y,len,7,p,0xff153b,fade*(.14+flash*.4));slash(marks,x,y,len,3.8,p,0xb91e37,fade*.85);slash(marks,x,y,len,1.7,p,0xf4485c,fade*(.6+flash*.3));if(h<.32)slash(marks,x,y,len,.65,p,0xffcfcb,fade*flash*.85);}
if(t>1.75){active=false;glow.clear();marks.clear();}}if(!active&&q('loop').checked){wait+=dt;if(wait>.6)play();}});

return { play, stopSound() {  } };
},
"sleep"(app, q, getAudioContext, volume) {
const target=new PIXI.Container(),glow=new PIXI.Graphics(),fx=new PIXI.Graphics();glow.blendMode='add';glow.filters=[new PIXI.BlurFilter({strength:4,quality:3})];app.stage.addChild(target,glow,fx);
let t=4,active=false,wait=0,ac;const sr=44100,audio=new Float32Array(Math.floor(sr*2.2));for(let i=0;i<audio.length;i++){const time=i/sr;let v=0;[659.25,523.25,392].forEach((f,k)=>{const h=time-k*.22;if(h>=0){const env=(1-Math.exp(-h*22))*Math.exp(-h*3);v+=(Math.sin(2*Math.PI*f*h)+.09*Math.sin(2*Math.PI*f*2*h))*env*.12;const d=h-.2;if(d>=0)v+=Math.sin(2*Math.PI*f*d)*Math.exp(-d*4)*.018;}});audio[i]=v*.7;}
async function sound(){if(!q('sound').checked)return;try{ac??=getAudioContext();await ac.resume();const b=ac.createBuffer(1,audio.length,sr);b.copyToChannel(audio,0);const s=ac.createBufferSource(),gain=ac.createGain();s.buffer=b;s.playbackRate.value=+q('speed').value;gain.gain.value=.65 * volume();s.connect(gain).connect(ac.destination);s.start();}catch(e){q('sound').checked=false;}}
function play(audible=true){t=0;active=true;wait=0;if(audible)sound();}
function z(g,x,y,size,alpha,width,color){g.moveTo(x-size*.38,y-size*.4).lineTo(x+size*.38,y-size*.4).lineTo(x-size*.38,y+size*.4).lineTo(x+size*.38,y+size*.4).stroke({color,width,alpha});}
app.ticker.add(ticker=>{const dt=Math.min(ticker.deltaMS/1000,.05);t+=dt*+q('speed').value;glow.clear();fx.clear();if(active){const env=Math.min(1,t/.15)*Math.min(1,Math.max(0,(2.35-t)/.4));
for(let k=0;k<3;k++){const age=t-k*.28;if(age<0||age>1.65)continue;const a=Math.sin(Math.PI*age/1.65)*env,x=218+k*10+age*21+Math.sin(age*2+k)*4,y=126-age*43-k*6,size=15+k*6;z(glow,x,y,size,a*.4,7,0x9461d7);z(fx,x,y,size,a*.92,3,0xc5a1f2);}
for(let k=0;k<7;k++){const age=t-k*.14;if(age<0||age>1.4)continue;const x=172+Math.sin(k*2.8)*34+Math.sin(age*2+k)*7,y=148-age*40,a=Math.sin(Math.PI*age/1.4)*env;glow.circle(x,y,5).fill({color:0x9e70db,alpha:a*.3});fx.circle(x,y,1.6).fill({color:0xd0b5f4,alpha:a*.6});}
if(t>2.4){active=false;glow.clear();fx.clear();}}if(!active&&q('loop').checked){wait+=dt;if(wait>.6)play();}});

return { play, stopSound() {  } };
},
"cleanse"(app, q, getAudioContext, volume) {

const target=new PIXI.Container(),glow=new PIXI.Graphics(),fx=new PIXI.Graphics();
glow.blendMode='add';fx.blendMode='add';glow.filters=[new PIXI.BlurFilter({strength:7,quality:4})];app.stage.addChild(target,glow,fx);
let t=3,active=false,wait=0,ac,source;
const sr=44100,audio=new Float32Array(sr*2);
let seed=7919;function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
let smooth=0;for(let i=0;i<audio.length;i++){const h=i/sr;smooth=smooth*.92+(random()*2-1)*.08;let v=smooth*.36*Math.sin(Math.PI*Math.min(1,h/.95))*Math.exp(-h*2.5);for(let k=0;k<4;k++){const a=h-.28-k*.15;if(a>=0){const f=[659.25,880,1174.66,1760][k],env=(1-Math.exp(-a*110))*Math.exp(-a*5);v+=(Math.sin(2*Math.PI*f*a)+Math.sin(2*Math.PI*f*2.003*a)*.24)*env*.085;}}audio[i]=v;}
async function sound(){if(!q('sound').checked)return;try{ac??=getAudioContext();await ac.resume();if(!q('sound').checked)return;source?.stop();const b=ac.createBuffer(1,audio.length,sr);b.copyToChannel(audio,0);source=ac.createBufferSource();const g=ac.createGain();g.gain.value=.65 * volume();source.buffer=b;source.playbackRate.value=+q('speed').value;source.connect(g).connect(ac.destination);source.start();}catch(e){q('error').textContent='사운드를 재생할 수 없습니다.';}}
const motes=Array.from({length:48},()=>({x:128+random()*144,y:190+random()*100,delay:random()*.7,v:38+random()*50,size:1+random()*2.1,phase:random()*6.28}));
const fragments=Array.from({length:12},(_,k)=>({angle:k/12*Math.PI*2,r:35+random()*27,delay:random()*.3,spin:random()*3}));
function play(audible=true){t=0;active=true;wait=0;if(audible)sound();}
function sweep(g,y,width,alpha){g.moveTo(118,y);g.bezierCurveTo(155,y+13,245,y+13,282,y);g.stroke({color:0x90ffe3,width,alpha});}
app.ticker.add(ticker=>{const dt=Math.min(ticker.deltaMS/1000,.05);t+=dt*+q('speed').value;glow.clear();fx.clear();if(active){
const envelope=Math.min(1,t/.16)*Math.max(0,Math.min(1,(2.15-t)/.45));
// A cleansing sweep rises across the target; the target itself never moves or changes.
const p=Math.max(0,Math.min(1,(t-.08)/.85));if(p<1){const y=283-p*166,a=Math.sin(Math.PI*p)*envelope;sweep(glow,y,19,a*.43);sweep(fx,y,2,a*.85);for(let j=1;j<6;j++)sweep(glow,y+j*5,3,a*(1-j/6)*.10);}
// Small broken status traces lift off and dissolve into turquoise sparks.
for(const f of fragments){const age=t-f.delay;if(age<0||age>1.05)continue;const a=Math.min(1,age/.12)*Math.pow(1-age/1.05,2),x=200+Math.cos(f.angle)*(f.r+age*35),y=200+Math.sin(f.angle)*f.r-age*58;const rotation=f.angle+age*f.spin;fx.moveTo(x-Math.cos(rotation)*5,y-Math.sin(rotation)*5).lineTo(x,y).lineTo(x+Math.cos(rotation+.7)*5,y+Math.sin(rotation+.7)*5).stroke({color:age<.22?0x71bdb4:0x9bffe5,width:2,alpha:a*.68});glow.circle(x,y,4).fill({color:0x4af5cf,alpha:a*.28});}
for(const m of motes){const age=t-m.delay;if(age<0||age>1.25)continue;const a=Math.sin(Math.PI*age/1.25)*envelope,x=m.x+Math.sin(age*3+m.phase)*9,y=m.y-age*m.v;glow.circle(x,y,m.size*2.8).fill({color:0x4ce8c4,alpha:a*.3});fx.circle(x,y,m.size).fill({color:0xc3fff2,alpha:a*.85});if(m.size>2){fx.moveTo(x,y+4).lineTo(x,y+10).stroke({color:0x6ae8ce,width:1,alpha:a*.28});}}
// A brief soft confirmation gleam, without a cross, shield, or persistent barrier.
const h=t-.78;if(h>=0&&h<.65){const a=Math.sin(Math.PI*h/.65);glow.ellipse(200,177-h*26,36,9).fill({color:0x8bffe0,alpha:a*.18});}
if(t>2.2){active=false;glow.clear();fx.clear();}}
if(!active&&q('loop').checked){wait+=dt;if(wait>.65)play();}});

return { play, stopSound() { source?.stop(); } };
},
"bind"(app, q, getAudioContext, volume) {

const target=new PIXI.Container(),glow=new PIXI.Graphics(),fx=new PIXI.Graphics();
glow.blendMode='add';glow.filters=[new PIXI.BlurFilter({strength:5,quality:4})];app.stage.addChild(target,glow,fx);
let t=4,active=false,wait=0,ac,source;
const sr=44100,audio=new Float32Array(Math.floor(sr*2.3));let seed=9541;function rand(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
let noise=0;for(let i=0;i<audio.length;i++){const h=i/sr,n=rand()*2-1;noise=.86*noise+.14*n;let v=noise*.16*Math.sin(Math.PI*Math.min(h/.45,1))*Math.exp(-h*3);
for(const hit of [.34,.49]){const a=h-hit;if(a>=0){v+=(Math.sin(2*Math.PI*1720*a)*.075+Math.sin(2*Math.PI*2387*a)*.045+n*.08)*Math.exp(-a*30);v+=Math.sin(2*Math.PI*(82*a+22*(1-Math.exp(-a*12))/12))*.16*Math.exp(-a*13);}}
const hold=h-.49;if(hold>=0)v+=(Math.sin(2*Math.PI*63*hold)+.25*Math.sin(2*Math.PI*126*hold))*.035*Math.min(1,hold/.08)*Math.max(0,1-hold/1.55);audio[i]=v;}
async function sound(){if(!q('sound').checked)return;try{ac??=getAudioContext();await ac.resume();if(!q('sound').checked)return;source?.stop();const b=ac.createBuffer(1,audio.length,sr);b.copyToChannel(audio,0);source=ac.createBufferSource();const g=ac.createGain();g.gain.value=.7 * volume();source.buffer=b;source.playbackRate.value=+q('speed').value;source.connect(g).connect(ac.destination);source.start();}catch(e){q('error').textContent='사운드를 재생할 수 없습니다.';}}
function play(audible=true){t=0;active=true;wait=0;if(audible)sound();}
function link(g,x,y,angle,rx,ry,width,color,alpha){const c=Math.cos(angle),s=Math.sin(angle);for(let i=0;i<=20;i++){const a=i/20*Math.PI*2,lx=Math.cos(a)*rx,ly=Math.sin(a)*ry,px=x+lx*c-ly*s,py=y+lx*s+ly*c;if(i===0)g.moveTo(px,py);else g.lineTo(px,py);}g.stroke({color,width,alpha});}
function chain(angle,delay,env){const age=t-delay;if(age<0)return;const p=Math.min(1,age/.34),ease=1-Math.pow(1-p,3),shift=(1-ease)*95;
for(let k=-6;k<=6;k++){const d=k*14.5,side=k<0?-1:1,v=d+side*shift,x=200+Math.cos(angle)*v,y=200+Math.sin(angle)*v;const a=env*Math.min(1,age/.09);link(glow,x,y,angle,8.5,4.5,7,0x9a4bff,a*.35);link(fx,x,y,angle,8.5,k%2===0?4.5:2.2,2.4,0xb68bf5,a*.85);link(fx,x,y-1,angle,7.5,k%2===0?3.5:1.6,.8,0xe3cbff,a*.5);}}
app.ticker.add(ticker=>{const dt=Math.min(ticker.deltaMS/1000,.05);t+=dt*+q('speed').value;glow.clear();fx.clear();if(active){const env=Math.min(1,t/.12)*Math.max(0,Math.min(1,(2.6-t)/.45));chain(Math.PI/4,0,env);chain(-Math.PI/4,.15,env);
const h=t-.49;if(h>=0){const pulse=.65+.15*Math.sin(h*5);glow.circle(200,200,15).fill({color:0x9d50ff,alpha:env*pulse*.5});fx.poly([200,189,211,200,200,211,189,200]).fill({color:0x59318c,alpha:env*.94}).stroke({color:0xd8b9ff,width:1.6,alpha:env*.9});
// Four inward-facing braces tighten and remain still, suggesting movement is blocked.
const r=89+17*Math.exp(-h*14);for(let k=0;k<4;k++){const a=k*Math.PI/2,c=Math.cos(a),s=Math.sin(a),x=200+c*r,y=200+s*r;for(const g of [glow,fx]){g.moveTo(x-s*11+c*6,y+c*11+s*6).lineTo(x-s*11,y+c*11).lineTo(x+s*11,y-c*11).lineTo(x+s*11+c*6,y-c*11+s*6).stroke({color:g===glow?0xa356ff:0xd8b7ff,width:g===glow?8:2,alpha:env*(g===glow?.32:.7)});}}
const flash=Math.exp(-h*20);for(let k=0;k<12;k++){const a=k/12*Math.PI*2,d=12+h*76;fx.circle(200+Math.cos(a)*d,200+Math.sin(a)*d,1.5).fill({color:0xe5d1ff,alpha:flash*.85});}}
if(t>2.65){active=false;glow.clear();fx.clear();}}if(!active&&q('loop').checked){wait+=dt;if(wait>.65)play();}});

return { play, stopSound() { source?.stop(); } };
},
"dispel"(app, q, getAudioContext, volume) {
const rear=new PIXI.Graphics(),target=new PIXI.Container(),fx=new PIXI.Graphics();app.stage.addChild(rear,target,fx);
const cv=document.createElement('canvas');cv.width=cv.height=128;const c=cv.getContext('2d'),gr=c.createRadialGradient(64,64,0,64,64,64);gr.addColorStop(0,'#efe4ff');gr.addColorStop(.12,'#b979ff');gr.addColorStop(.4,'#9016ff50');gr.addColorStop(1,'#8800ff00');c.fillStyle=gr;c.fillRect(0,0,128,128);const tx=PIXI.Texture.from(cv),particles=[];
for(let i=0;i<28;i++){const s=new PIXI.Sprite(tx);s.anchor.set(.5);s.blendMode='add';app.stage.addChild(s);particles.push({s,x:200+(Math.random()-.5)*175,y:100+Math.random()*15,delay:Math.random()*.6,speed:115+Math.random()*60,size:2+Math.random()*3});}
let t=3,active=false,wait=0,ac;const sr=44100,audio=new Float32Array(Math.floor(sr*1.6));let seed=8713,softNoise=0;for(let i=0;i<audio.length;i++){const h=i/sr;seed=(Math.imul(seed,1664525)+1013904223)>>>0;softNoise=softNoise*.9+(seed/4294967296*2-1)*.1;const env=(1-Math.exp(-h*35))*Math.exp(-h*4.4),phase=2*Math.PI*(780*.38*(1-Math.exp(-h/.38))+115*h);let v=(Math.sin(phase)*.10+Math.sin(phase*1.503)*.034+softNoise*.20)*env;for(let k=0;k<3;k++){const age=h-.12-k*.14;if(age>=0){const f=[1046.5,698.46,349.23][k],e=(1-Math.exp(-age*100))*Math.exp(-age*14);v+=(Math.sin(2*Math.PI*f*age)+.25*Math.sin(2*Math.PI*f*2.17*age))*e*.065;}}audio[i]=v*.85;}
async function sound(){if(!q('sound').checked)return;try{ac??=getAudioContext();await ac.resume();const b=ac.createBuffer(1,audio.length,sr);b.copyToChannel(audio,0);const s=ac.createBufferSource(),gain=ac.createGain();s.buffer=b;s.playbackRate.value=+q('speed').value;gain.gain.value=.65 * volume();s.connect(gain).connect(ac.destination);s.start();}catch(e){q('sound').checked=false;}}
function play(audible=true){t=0;active=true;wait=0;if(audible)sound();}
function chevron(x,y,w,a){fx.moveTo(x-w,y-8).lineTo(x,y+5).lineTo(x+w,y-8).stroke({color:0xc7a1ff,width:4,alpha:a});}
app.ticker.add(ticker=>{const dt=Math.min(ticker.deltaMS/1000,.05);t+=dt*+q('speed').value;rear.clear();fx.clear();particles.forEach(p=>p.s.alpha=0);if(active){const env=Math.min(1,t/.18)*Math.min(1,Math.max(0,(1.6-t)/.4));
rear.ellipse(200,278,99,22).stroke({color:0x9629ef,width:3,alpha:env*.8});rear.ellipse(200,278,85,17).stroke({color:0xb872ff,width:1.4,alpha:env*.5});
for(let k=0;k<12;k++){const a=k*Math.PI/6+t*.7,x=200+99*Math.cos(a),y=278+22*Math.sin(a);rear.moveTo(x,y).lineTo(200+107*Math.cos(a),278+25*Math.sin(a)).stroke({color:0xc187ff,width:2,alpha:env*.7});}
for(let side of [-1,1]){for(let k=0;k<3;k++){const x=200+side*(88+k*8),bottom=115+Math.min(180,t*340);rear.moveTo(x,110).lineTo(x,bottom).stroke({color:0x9520ef,width:8-k*2,alpha:env*(.17-k*.04)});}fx.moveTo(200+side*85,265).lineTo(200+side*85,155).stroke({color:0xac52ff,width:2,alpha:env*.38});}
for(let k=0;k<3;k++){const age=t-k*.16;if(age>0&&age<1.05){const e=Math.sin(Math.PI*age/1.05)*env,y=140+age*125;chevron(200,y,18,e*.9);chevron(200,y-12,18,e*.42);}}
for(let side of [-1,1]){for(let k=0;k<2;k++){const age=t-.12-k*.23;if(age>0&&age<.9){const y=137+age*128;chevron(200+side*58,y,9,Math.sin(Math.PI*age/.9)*env*.7);}}}
const pulse=t-.45;if(pulse>=0){rear.circle(200,200,83+pulse*25).stroke({color:0xa440ff,width:2.5,alpha:Math.exp(-pulse*5)*env*.65});}
for(const p of particles){const age=t-p.delay;if(age<0||age>.95)continue;p.s.position.set(p.x,p.y+age*p.speed);p.s.width=p.size*1.8;p.s.height=p.size*4;p.s.alpha=Math.sin(Math.PI*age/.95)*env*.65;}
if(t>1.65){active=false;rear.clear();fx.clear();}}if(!active&&q('loop').checked){wait+=dt;if(wait>.6)play();}});

return { play, stopSound() {  } };
},
};
