const fs = require('fs');
const input=fs.readFileSync('OriginalData/Reference/approved-effects-all.html','utf8');
const effects=JSON.parse(input.match(/<script id="effect-data"[^>]*>([\s\S]*?)<\/script>/)[1]);
let out="// Generated from OriginalData/Reference/approved-effects-all.html.\n// Original drawing, particle timing and synthesized sound are preserved.\nimport * as PIXI from 'pixi.js';\nexport const approvedEffectFactories = {\n";
for(const effect of effects){
 let body=Buffer.from(effect.source,'base64').toString('utf8').match(/<script>\s*([\s\S]*?)<\/script>/)[1];
 const start=body.match(/(?:stage|q\('stage'\))\.prepend\(app\.canvas\);/);
 if(!start)throw Error(effect.id);
 body=body.slice(start.index+start[0].length);
 body=body.slice(0,body.lastIndexOf("q('play').onclick"));
 body=body.replace(/new PIXI\.Graphics\(\)\.circle\(200,200,78\)\.fill\(0x77777c\)/g,'new PIXI.Container()');
 body=body.replace(/new\(window\.AudioContext\|\|window\.webkitAudioContext\)\(\)/g,'getAudioContext()');
 body=body.replace(/(\w+)\.gain\.value=(\.[0-9]+);/g,'$1.gain.value=$2 * volume();');
 out+=`${JSON.stringify(effect.id)}(app, q, getAudioContext, volume) {\n${body}\nreturn { play, stopSound() { ${body.includes('ac,source')?'source?.stop();':''} } };\n},\n`;
}
out+='};\n';fs.writeFileSync('src/approved-battle-effects.mjs',out);
fs.mkdirSync('public/assets/icons/status-effects',{recursive:true});
fs.mkdirSync('public/assets/icons/status-effects-white',{recursive:true});
const iconSource = 'OriginalData/SVG_Icon/StatIcon';
const iconFiles = fs.readdirSync(iconSource).filter(file => file.endsWith('.svg')).sort();
if (iconFiles.length !== 55) throw Error('Expected 55 status icons');
for(let n=1;n<=55;n++){const file=iconFiles[n-1];if (!file.startsWith(String(n).padStart(2,'0')+'_')) throw Error('Missing icon '+n);
fs.copyFileSync(iconSource+'/'+file,'public/assets/icons/status-effects/'+file);
let svg=fs.readFileSync(iconSource+'/'+file,'utf8');svg=svg.replace(/<rect\b[^>]*\/>/,'');
 const viewBox=svg.match(/viewBox="([^"]+)"/)[1];
 const [x,y,width,height]=viewBox.split(' ');
 const glyph=svg.match(/<svg[^>]*>([\s\S]*?)<\/svg>/)[1].replace(/#087CF0|#E83D36/g,'black');
 svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="64" height="64"><defs><mask id="glyph" maskUnits="userSpaceOnUse" x="${x}" y="${y}" width="${width}" height="${height}">${glyph}</mask></defs><rect x="${x}" y="${y}" width="${width}" height="${height}" fill="white" mask="url(#glyph)"/></svg>`;
fs.writeFileSync('public/assets/icons/status-effects-white/'+file,svg);}
console.log('Extracted',effects.length,'original effects and 55 transparent icons.');
