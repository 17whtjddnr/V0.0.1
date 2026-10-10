import { logicalRect } from './game-viewport.mjs';
﻿import { battleEffectVisuals, approvedEffectDurations, containedImageBounds } from './battle-effect-visuals.mjs';

export function createBattleEffects({ findImage, isActive, volume, audioContext, isAlly = () => false }) {
    const host = document.querySelector('#stage-canvas') || document.body;
    let loading, renderer, factories, PIXI, overlay, destroyed = false;
    const running = new Set();
    const pending = [];
    const iconCounts = new Map();
    function bounds(target) {
        const image = findImage(target);
        if (!image?.isConnected) return null;
        const screenBox = logicalRect(image), origin = logicalRect(host);
        const scale = origin.width / host.offsetWidth || 1;
        const box = { left: (screenBox.left - origin.left) / scale, top: (screenBox.top - origin.top) / scale, width: screenBox.width / scale, height: screenBox.height / scale };
        if (!box.width || !box.height) return null;
        return image.tagName === 'IMG' ? containedImageBounds(box, image.naturalWidth, image.naturalHeight, image.classList.contains('enemy-art')) : box;
    }
    function remove(entry) {
        running.delete(entry);
        entry.icon?.remove();
        entry.instance.stopSound();
        entry.container.destroy({ children: true, texture: true, textureSource: true });
        if (![...running].some(other => other.target === entry.target)) iconCounts.delete(entry.target);
    }
    async function preload() {
        if (loading) return loading;
        loading = (async () => {
            const [pixi, originals] = await Promise.all([import('pixi.js'), import('./approved-battle-effects.mjs')]);
            if (destroyed) return;
            PIXI = pixi; factories = originals.approvedEffectFactories;
            renderer = new PIXI.Application();
            await renderer.init({ width: host.clientWidth, height: host.clientHeight, backgroundAlpha: 0, antialias: true, resolution: Math.min(devicePixelRatio || 1, 2), autoDensity: true, preference: 'webgl' });
            overlay = document.createElement('div');
            overlay.className = 'battle-effects-overlay';
            overlay.setAttribute('aria-hidden', 'true');
            overlay.append(renderer.canvas);
            host.append(overlay);
            renderer.ticker.add(ticker => {
                if (!isActive()) { clear(); return; }
                if (renderer.screen.width !== host.clientWidth || renderer.screen.height !== host.clientHeight) renderer.renderer.resize(host.clientWidth, host.clientHeight);
                for (const entry of running) {
                    const rect = bounds(entry.target);
                    if (!rect) { remove(entry); continue; }
                    const scale = Math.max(100, Math.min(400, Math.max(rect.width, rect.height) * 1.25)) / 400 * (isAlly(entry.target) ? 2 : 1);
                    entry.container.scale.set(scale);
                    entry.container.position.set(rect.left + rect.width/2 - 200*scale, rect.top + rect.height/2 - 200*scale);
                    if (entry.icon) {
                        entry.icon.style.left = `${rect.left + rect.width/2 + entry.lane * 66}px`;
                        entry.icon.style.top = `${rect.top + Math.min(12, rect.height*.1)}px`;
                    }
                    entry.elapsed += Math.min(ticker.deltaMS/1000, .05);
                    entry.callbacks.forEach(callback => callback(ticker));
                    if (entry.elapsed > approvedEffectDurations[entry.animation] + .12) remove(entry);
                }
                if (!running.size) renderer.stop();
            });
            renderer.stop();
        })().catch(error => { console.warn('Battle effects could not initialize.', error); pending.length = 0; });
        return loading;
    }
    function start(target, animation, visual) {
        if (!renderer || !overlay || !isActive() || !bounds(target)) return;
        const container = new PIXI.Container();
        const callbacks = [];
        renderer.stage.addChild(container);
        const controls = { sound: { get checked() { return volume() > 0; }, set checked(_) {} }, speed: { value: 1 }, loop: { checked: false } };
        const instance = factories[animation]({ stage: container, ticker: { add: callback => callbacks.push(callback) } }, id => controls[id], audioContext, volume);
        const laneIndex = iconCounts.get(target) || 0;
        iconCounts.set(target, laneIndex + 1);
        const entry = { target, animation, container, callbacks, instance, elapsed: 0, lane: laneIndex ? Math.ceil(laneIndex/2)*(laneIndex%2 ? 1 : -1) : 0 };
        if (visual?.icon) {
            const icon = document.createElement('img');
            icon.src = visual.icon; icon.className = 'battle-effect-icon'; icon.alt = '';
            overlay.append(icon); entry.icon = icon;
            const upward = visual.direction === 'up';
            icon.animate([
                { opacity: 0, transform: `translate(-50%, ${upward ? 0 : -38}px) scale(.8)` },
                { opacity: 1, offset: .22, transform: `translate(-50%, ${upward ? -12 : -26}px) scale(1)` },
                { opacity: 1, offset: .55 },
                { opacity: 0, transform: `translate(-50%, ${upward ? -48 : 10}px) scale(1)` },
            ], { duration: 1100, fill: 'forwards', easing: 'ease-out' });
        }
        running.add(entry);
        instance.play();
        renderer.start();
    }
    // Engine callbacks run before the battle DOM is refreshed. Flush after the refresh.
    function enqueue(target, animation, visual) {
        if (!isActive()) return;
        pending.push({ target, animation, visual });
        void preload().then(() => requestAnimationFrame(() => {
            if (!isActive()) { pending.length = 0; return; }
            for (const event of pending.splice(0)) start(event.target, event.animation, event.visual);
        }));
    }
    function clear() {
        pending.length = 0;
        for (const entry of [...running]) remove(entry);
        iconCounts.clear();
        renderer?.stop();
        if (overlay && renderer?.renderer) renderer.render();
    }
    return {
        preload,
        hasPending: () => pending.length > 0 || running.size > 0,
        effect(target, effect) { const visual = battleEffectVisuals[effect.code]; if (visual) enqueue(target, visual.animation, visual); },
        impact(target, kind, code) { const visual = code ? battleEffectVisuals[code] : null; enqueue(target, visual?.animation || kind, visual); },
        clear,
        destroy() { destroyed = true; clear(); renderer?.destroy(true, { children: true }); overlay?.remove(); },
    };
}
