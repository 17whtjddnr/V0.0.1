// Original preset synthesis and cue timing; uses the game's shared SFX volume/context.
export function createPopupPresetSound(kind, { audioContext, volume }) {
const popupMasterVolume = .72;
let audio, master;
const voices=new Set();
function tone(freq,start,duration,level,type='sine',to=null){
 if(!audio || audio.state!=='running' || document.hidden || volume()===0)return;
 const o=audio.createOscillator(),v=audio.createGain(),at=audio.currentTime+start;
 o.type=type;o.frequency.setValueAtTime(freq,at);if(to)o.frequency.exponentialRampToValueAtTime(to,at+duration);
 v.gain.setValueAtTime(.0001,at);v.gain.exponentialRampToValueAtTime(level,at+.025);v.gain.exponentialRampToValueAtTime(.0001,at+duration);
 o.connect(v);v.connect(master);const voice={o,v};voices.add(voice);
 o.onended=()=>{voices.delete(voice);o.disconnect();v.disconnect();};o.start(at);o.stop(at+duration+.02);
}
function stopSound(){if(!audio)return;const at=audio.currentTime;for(const voice of voices){try{voice.v.gain.cancelScheduledValues(at);voice.v.gain.setTargetAtTime(.0001,at,.02);voice.o.stop(at+.1);}catch{}}}
function cue(phase){const pos=kind==='positive';if(phase==='start'){if(pos){
// Rapid rising chimes, a soft rising sweep, then a bright resolving chord.
[523.25,659.25,783.99,1046.5,1318.51,1567.98].forEach((f,i)=>{const at=i*.075;tone(f,at,.34,.14);tone(f*2,at,.20,.027);tone(f/2,at,.25,.025,'triangle');});
tone(196,0,.42,.045,'triangle',783.99);
[523.25,659.25,783.99,1046.5].forEach(f=>{tone(f,.43,.52,.095);tone(f*1.003,.445,.48,.023);});
tone(261.63,.43,.48,.065,'triangle');
[2093,2637.02,3135.96,4186].forEach((f,i)=>tone(f,.52+i*.075,.23,.023));
}else{tone(392,0,.25,.14,'sine',329.63);tone(261.63,.16,.45,.09);}}else if(phase==='loop'){(pos?[261.63,329.63,392]:[146.83,220,293.66]).forEach((f,i)=>tone(f,i*.04,1.7,pos?.024:.018));}else{stopSound();if(pos){tone(783.99,0,.30,.12,'sine',523.25);tone(523.25,.12,.35,.08);}else{tone(261.63,0,.3,.10,'sine',196);tone(146.83,.1,.3,.045);}}}

return {
 cue(phase) {
  if(document.hidden || volume()===0 || !navigator.userActivation?.hasBeenActive)return;
  try {
   audio ||= audioContext();
   if(!master){master=audio.createGain();master.connect(audio.destination);}
   master.gain.value=popupMasterVolume*volume();
   if(audio.state==='suspended') { void audio.resume().catch(()=>{}); return; }
   cue(phase);
  } catch { /* Audio must never block popup controls. */ }
 },
 syncVolume(){if(master)master.gain.value=popupMasterVolume*volume();},
 stop: stopSound,
 dispose(){stopSound();if(master)setTimeout(()=>master.disconnect(),150);},
};
}
