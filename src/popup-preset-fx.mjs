// Glow, counter-rotating light rays and seeded particles from Popup_Animation_Presets.html.
// Only the preview canvas sizing and placement are adapted to the existing popup.
export function drawPopupPresetFX(canvas, { phase: state, kind, elapsed, fxElapsed, endStartFX = 0, geometry, pixelRatio = 1 }) {
const g=canvas.getContext('2d');
if (!g) return;
function particle(index){
 let seed=(Math.imul(index+1,0x9e3779b1)^0x6a09e667)>>>0;
 const rand=()=>{seed=(seed+0x6D2B79F5)>>>0;let z=seed;z=Math.imul(z^(z>>>15),z|1);z^=z+Math.imul(z^(z>>>7),z|61);return ((z^(z>>>14))>>>0)/4294967296;};
 const angle=rand()*Math.PI*2,speed=95+rand()*65,life=2+rand()*.6,radius=1.1+rand()*1.2;
 return {angle,speed,life,radius};
}
function drawFX(){g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,canvas.width,canvas.height);const unit=Math.max(geometry.width/418,geometry.height/270,1)*pixelRatio;g.setTransform(unit,0,0,unit,canvas.width/2-360*unit,canvas.height/2-260*unit);if(state==='idle'||kind==='negative')return;const time=fxElapsed;g.globalAlpha=state==='start'?Math.min(1,elapsed):state==='end'?Math.max(0,1-elapsed/.5):1;

const scale=1+.15*(1-Math.cos(Math.PI*time))/2,radius=225*scale;const glow=g.createRadialGradient(360,260,0,360,260,radius);glow.addColorStop(0,'rgba(255,246,192,.95)');glow.addColorStop(.22,'rgba(255,222,125,.88)');glow.addColorStop(.44,'rgba(255,193,67,.68)');glow.addColorStop(.65,'rgba(255,169,37,.36)');glow.addColorStop(.82,'rgba(255,157,28,.12)');glow.addColorStop(1,'rgba(255,157,28,0)');g.fillStyle=glow;g.fillRect(360-radius,260-radius,2*radius,2*radius);
for(const direction of [1,-1]){
g.save();g.translate(360,260);g.rotate(direction*time*Math.PI/30);
for(let i=0;i<18;i++){
 const angle=i*Math.PI*2/18+.065*Math.sin(i*4.7),length=205+45*(.5+.5*Math.sin(i*7.13)),lengthScale=1+.05*Math.sin(time*Math.PI*2/3+i*2.399+(direction===-1?Math.PI/2:0)),width=9+15*(.5+.5*Math.cos(i*3.71)),pulse=.72+.28*(.5+.5*Math.sin(time*Math.PI+i*1.7));
 let leftWidth=width,rightWidth=width;
 if(direction===-1){
  const ray=j=>{const n=(j+18)%18;return {angle:n*Math.PI*2/18+.065*Math.sin(n*4.7),half:Math.atan((9+15*(.5+.5*Math.cos(n*3.71)))/(205+45*(.5+.5*Math.sin(n*7.13))))};};
  const prev=ray(i-1),next=ray(i+1),half=Math.atan(width/length),tau=Math.PI*2;
  const leftGap=Math.max(0,(angle-prev.angle+tau)%tau-half-prev.half),rightGap=Math.max(0,(next.angle-angle+tau)%tau-half-next.half);
  leftWidth=length*Math.tan(half+leftGap/4);rightWidth=length*Math.tan(half+rightGap/4);
 }
 g.save();g.rotate(angle);g.scale(lengthScale,1);
 for(const [spread,opacity] of [[2.1,.09],[1.45,.16],[1,.37],[.45,.22]]){
  const grad=g.createLinearGradient(0,0,length,0);grad.addColorStop(0,'rgba(255,250,218,'+opacity*pulse+')');grad.addColorStop(.2,'rgba(255,229,154,'+opacity*pulse+')');grad.addColorStop(.58,'rgba(255,198,83,'+opacity*pulse*.65+')');grad.addColorStop(1,'rgba(255,176,48,0)');
  g.fillStyle=grad;g.beginPath();g.moveTo(3,-1);g.lineTo(length,-leftWidth*spread);g.quadraticCurveTo(length+5,0,length,rightWidth*spread);g.lineTo(3,1);g.closePath();g.fill();
 }
 g.restore();
}
const core=g.createRadialGradient(0,0,0,0,0,27);core.addColorStop(0,'rgba(255,255,237,1)');core.addColorStop(.15,'rgba(255,243,188,.95)');core.addColorStop(.45,'rgba(255,209,104,.4)');core.addColorStop(1,'rgba(255,186,61,0)');g.fillStyle=core;g.fillRect(-27,-27,54,54);g.restore();
}
const clock=time+3;
for(let i=Math.max(0,Math.floor((clock-2.6)*40));i<=Math.floor((state==='end'?endStartFX+3:clock)*40);i++){
 const p=particle(i),age=clock-i/40;if(age<0||age>=p.life)continue;
 const progress=age/p.life,distance=p.speed*age,x=360+Math.cos(p.angle)*distance,y=260+Math.sin(p.angle)*distance;
 const alpha=Math.min(1,age/.12)*Math.pow(1-progress, .65),size=p.radius*(1-.25*progress),halo=size*5;
 g.save();g.globalAlpha*=alpha;
 const glow=g.createRadialGradient(x,y,0,x,y,halo);glow.addColorStop(0,'rgba(255,247,213,.95)');glow.addColorStop(.18,'rgba(255,224,135,.8)');glow.addColorStop(.45,'rgba(255,184,55,.25)');glow.addColorStop(1,'rgba(255,174,38,0)');g.fillStyle=glow;g.fillRect(x-halo,y-halo,halo*2,halo*2);
 g.beginPath();g.arc(x,y,size,0,Math.PI*2);g.fillStyle='#fff0bd';g.fill();g.restore();
}
g.globalAlpha=1;}

drawFX();
}
