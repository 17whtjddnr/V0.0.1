import { Application, Graphics } from 'pixi.js';

const app = new Application();

await app.init({
    width: 1280,
    height: 720,
    background: '#202020'
});

document.body.appendChild(app.canvas);

const box = new Graphics();

box.rect(100, 100, 200, 150);
box.fill(0xffffff);

app.stage.addChild(box);