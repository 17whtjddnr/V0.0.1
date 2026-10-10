import { logicalRect, logicalViewport } from './game-viewport.mjs';
import { drawPopupPresetFX } from './popup-preset-fx.mjs';
import { createPopupPresetSound } from './popup-preset-sound.mjs';

const selector = '[role="dialog"], [role="alertdialog"], dialog[open], .end-overlay > .end-dialog';
const ease = value => (1 - Math.cos(Math.PI * Math.max(0, Math.min(1, value)))) / 2;

export function popupPresetPose(phase, elapsed, endY = 0, endScale = 1) {
    if (phase === 'start') return { scale: elapsed < .9 ? 1.1 * ease(elapsed / .9) : 1.1 - .1 * ease((elapsed - .9) / .1), y: 0 };
    if (phase === 'loop') return { scale: 1, y: -3 * Math.sin(Math.PI * elapsed) };
    const remaining = 1 - ease(elapsed / .5);
    return { scale: endScale * remaining, y: endY * remaining };
}

export function popupPresetKind(panel) {
    return panel.dataset.popupKind === 'positive' ? 'positive' : 'negative';
}

// All popup renderers share this lifecycle, including native developer dialogs.
// Stable keys preserve progress when the game replaces the same popup's DOM.
export function createPopupPresentation(root, { audioContext, volume }) {
    const records = new Map();
    const closing = new Set();
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    let frame, last = performance.now(), destroyed = false;

    function backdrop(panel) { return panel.tagName === 'DIALOG' ? panel : panel.parentElement; }
    function keyFor(panel) {
        const title = panel.querySelector('h1,h2,h3')?.textContent.trim() || panel.getAttribute('aria-label') || '';
        return `${panel.dataset.popupKey || panel.className.replace(/\bpopup-preset-panel\b/g, '').trim()}:${title}:${popupPresetKind(panel)}`;
    }
    function measure(record) {
        const rect = logicalRect(record.panel);
        const bounds = logicalRect(root);
        const scale = bounds.width / root.offsetWidth || 1;
        record.geometry = {
            x: (rect.left + rect.width / 2 - bounds.left) / scale,
            y: (rect.top + rect.height / 2 - bounds.top) / scale - (record.pose?.y || 0),
            width: record.panel.offsetWidth, height: record.panel.offsetHeight,
        };
    }
    function attach(record, panel) {
        record.panel = panel;
        record.backdrop = backdrop(panel);
        record.background = getComputedStyle(record.backdrop).backgroundColor;
        panel.classList.add('popup-preset-panel');
        panel.dataset.popupKind = record.kind;
        if (record.kind === 'positive') {
            const canvas = document.createElement('canvas');
            canvas.className = 'popup-preset-fx';
            canvas.setAttribute('aria-hidden', 'true');
            record.backdrop.prepend(canvas);
            record.canvas = canvas;
        }
        record.pose = { scale: 1, y: 0 };
        measure(record);
        paint(record);
    }
    function paint(record) {
        const { panel, phase, elapsed } = record;
        const waiting = record.delay > 0;
        const pose = reducedMotion.matches ? { scale: 1, y: 0 } : popupPresetPose(phase, elapsed, record.endY, record.endScale);
        const viewport = logicalViewport();
        panel.style.transform = panel.tagName === 'DIALOG'
            ? `translate(-50%, -50%) rotate(${viewport.rotated ? 90 : 0}deg) scale(${viewport.scale}) translateY(${pose.y}px) scale(${pose.scale})`
            : `translateY(${pose.y}px) scale(${pose.scale})`;
        panel.style.opacity = waiting ? '0' : reducedMotion.matches && phase === 'end' ? String(1 - Math.min(1, elapsed / .5)) : '1';
        panel.style.pointerEvents = waiting ? 'none' : '';
        record.pose = pose;
        // Fade only the existing dim background; leave all layout and colors intact.
        const fade = waiting ? 0 : phase === 'start' ? Math.min(1, elapsed) : phase === 'end' ? Math.max(0, 1 - elapsed / .5) : 1;
        if (record.backdrop !== panel) {
            const rgba = record.background.match(/[\d.]+/g)?.map(Number);
            if (rgba?.length >= 3) record.backdrop.style.backgroundColor = `rgba(${rgba[0]},${rgba[1]},${rgba[2]},${(rgba[3] ?? 1) * fade})`;
        }
        if (record.canvas) {
            const canvas = record.canvas;
            const box = logicalRect(record.backdrop);
            const bounds = logicalRect(root);
            const scale = bounds.width / root.offsetWidth || 1;
            const width = record.backdrop.clientWidth, height = record.backdrop.clientHeight;
            const ratio = Math.min(devicePixelRatio || 1, 2);
            if (canvas.width !== Math.round(width * ratio)) canvas.width = Math.round(width * ratio);
            if (canvas.height !== Math.round(height * ratio)) canvas.height = Math.round(height * ratio);
            canvas.style.left = `${record.geometry.x - (box.left - bounds.left) / scale - width / 2}px`;
            canvas.style.top = `${record.geometry.y - (box.top - bounds.top) / scale - height / 2}px`;
            drawPopupPresetFX(canvas, {
                ...record, phase: waiting ? 'idle' : phase,
                fxElapsed: reducedMotion.matches ? 1 : record.fxElapsed,
                pixelRatio: ratio,
            });
        }
    }
    function finish(record) {
        record.sound.dispose();
        record.backdrop.remove();
        closing.delete(record);
    }
    function end(record) {
        records.delete(record.key);
        if (record.delay > 0) { record.sound.dispose(); return; }
        record.phase = 'end'; record.elapsed = 0;
        record.endY = record.pose.y; record.endScale = record.pose.scale;
        record.endStartFX = record.fxElapsed;
        record.sound.cue('end');
        // Keep the removed visual for its exit, without stale actions or duplicate IDs.
        if (record.panel.tagName === 'DIALOG') {
            const oldPanel = record.panel;
            const ghost = document.createElement('div');
            ghost.className = 'popup-native-exit';
            const panel = document.createElement('div');
            panel.className = oldPanel.className;
            panel.innerHTML = oldPanel.innerHTML;
            Object.assign(panel.style, { position: 'absolute', margin: '0', width: `${record.geometry.width}px`, height: `${record.geometry.height}px`, maxHeight: 'none', left: `${record.geometry.x - record.geometry.width / 2}px`, top: `${record.geometry.y - record.geometry.height / 2}px` });
            ghost.append(panel);
            record.panel = panel; record.backdrop = ghost; record.background = 'rgba(0,0,0,.7)';
        }
        record.backdrop.dataset.popupGhost = '';
        record.backdrop.inert = true;
        record.backdrop.setAttribute('aria-hidden', 'true');
        for (const node of [record.backdrop, ...record.backdrop.querySelectorAll('*')]) {
            node.removeAttribute('id'); node.removeAttribute('data-action'); node.removeAttribute('role');
        }
        root.append(record.backdrop);
        closing.add(record);
        paint(record);
    }
    function sync() {
        if (destroyed) return;
        for (const record of closing) if (!record.backdrop.isConnected) root.append(record.backdrop);
        const panels = [...root.querySelectorAll(selector)].filter(panel => !panel.closest('[data-popup-ghost], [role="tooltip"]') && (panel.tagName !== 'DIALOG' || panel.open));
        const found = new Set(panels.map(keyFor));
        for (const record of [...records.values()]) if (!found.has(record.key)) end(record);
        for (const panel of panels) {
            const key = keyFor(panel);
            let record = records.get(key);
            if (!record) {
                const kind = popupPresetKind(panel);
                record = { key, kind, phase: 'start', elapsed: 0, fxElapsed: 0, lastLoopCue: -1, delay: closing.size ? Math.max(...[...closing].map(item => .5 - item.elapsed)) : 0, started: false, sound: createPopupPresetSound(kind, { audioContext, volume }) };
                records.set(key, record);
                attach(record, panel);
            } else if (record.panel !== panel) attach(record, panel);
        }
        wake();
    }
    function tick(now) {
        frame = null;
        const dt = Math.min((now - last) / 1000, .05); last = now;
        if (!document.hidden) {
            for (const record of [...records.values(), ...closing]) {
                record.sound.syncVolume();
                if (record.delay > 0) { record.delay = Math.max(0, record.delay - dt); paint(record); continue; }
                if (!record.started && record.phase !== 'end') { record.started = true; record.sound.cue('start'); }
                if (record.phase !== 'end') measure(record);
                record.elapsed += dt; record.fxElapsed += dt;
                if (record.phase === 'start' && record.elapsed >= 1) { record.phase = 'loop'; record.elapsed -= 1; }
                if (record.phase === 'loop') {
                    const cycle = Math.floor(record.elapsed / 4);
                    if (cycle !== record.lastLoopCue) { record.lastLoopCue = cycle; record.sound.cue('loop'); }
                }
                if (record.phase === 'end' && record.elapsed >= .5) finish(record);
                else paint(record);
            }
        }
        if (records.size || closing.size) frame = requestAnimationFrame(tick);
    }
    function wake() { if (frame == null && (records.size || closing.size)) { last = performance.now(); frame = requestAnimationFrame(tick); } }
    function visibility() { last = performance.now(); if (document.hidden) for (const record of [...records.values(), ...closing]) record.sound.stop(); }
    function blockWaiting(event) {
        const panel = event.target.closest?.('.popup-preset-panel');
        if (panel && [...records.values()].some(record => record.panel === panel && record.delay > 0)) { event.preventDefault(); event.stopImmediatePropagation(); }
    }
    const observer = new MutationObserver(sync);
    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['open'] });
    document.addEventListener('visibilitychange', visibility);
    root.addEventListener('click', blockWaiting, true);
    root.addEventListener('keydown', blockWaiting, true);
    sync();
    return {
        sync,
        destroy() {
            destroyed = true; observer.disconnect(); cancelAnimationFrame(frame);
            document.removeEventListener('visibilitychange', visibility);
            root.removeEventListener('click', blockWaiting, true); root.removeEventListener('keydown', blockWaiting, true);
            for (const record of records.values()) { record.sound.dispose(); record.canvas?.remove(); record.panel.style.transform = ''; record.panel.style.opacity = ''; record.panel.style.pointerEvents = ''; record.backdrop.style.backgroundColor = record.background; }
            for (const record of [...closing]) finish(record);
            records.clear();
        },
    };
}
