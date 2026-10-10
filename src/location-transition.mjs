import { logicalRect } from './game-viewport.mjs';
import './location-transition.css';

export function createLocationTransition(game, onMove = () => {}) {
    let running = false;
    const stageSelector = '.plaza-encounter-stage, .guild-layout-main';

    function snapshot(stage) {
        const pane = document.createElement('div');
        pane.className = `location-transition-pane ${stage.closest('.guild-page') ? 'guild-page' : 'plaza-page'}`;
        const image = stage.cloneNode(true);
        const style = getComputedStyle(stage);
        image.style.background = style.background;
        image.style.color = style.color;
        image.style.setProperty('width', '100%', 'important');
        image.style.setProperty('height', '100%', 'important');
        image.style.setProperty('margin', '0', 'important');
        image.querySelectorAll('[id]').forEach((element) => element.removeAttribute('id'));
        image.querySelectorAll('.scene-entering, .scene-image-loading').forEach((element) => {
            element.classList.remove('scene-entering', 'scene-image-loading');
        });
        pane.append(image);
        return pane;
    }

    async function prepareImages(stage, pane) {
        const images = [...pane.querySelectorAll('img')];
        for (const match of getComputedStyle(stage).backgroundImage.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
            const image = new Image();
            image.src = match[1];
            images.push(image);
        }
        let timer;
        try {
            await Promise.race([
                Promise.allSettled(images.map((image) => image.decode())),
                new Promise((resolve) => { timer = setTimeout(resolve, 1500); }),
            ]);
        } finally {
            clearTimeout(timer);
        }
    }

    return {
        isRunning: () => running,
        async run(changeLocation) {
            if (running) return;
            const previousStage = game.querySelector(stageSelector);
            if (!previousStage || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                changeLocation();
                return;
            }
            running = true;
            let nextStage;
            let overlay;
            let previousVisibility;
            const animations = [];
            try {
                const outgoing = snapshot(previousStage);
                changeLocation();
                nextStage = game.querySelector(stageSelector);
                if (!nextStage) return;
                const incoming = snapshot(nextStage);
                const gameRect = logicalRect(game);
                const stageRect = logicalRect(nextStage);
                const scale = gameRect.width / game.offsetWidth;
                const width = stageRect.width / scale;
                const gap = 600;
                const travel = width + gap;
                overlay = document.createElement('div');
                overlay.className = 'location-transition';
                overlay.setAttribute('aria-hidden', 'true');
                overlay.inert = true;
                Object.assign(overlay.style, {
                    left: `${(stageRect.left - gameRect.left) / scale}px`,
                    top: `${(stageRect.top - gameRect.top) / scale}px`,
                    width: `${width}px`,
                    height: `${stageRect.height / scale}px`,
                });
                overlay.style.setProperty('--location-transition-gap', `${gap}px`);
                incoming.style.transform = `translateX(${travel}px)`;
                const seam = document.createElement('div');
                seam.className = 'location-transition-seam';
                overlay.append(outgoing, incoming, seam);
                game.append(overlay);
                previousVisibility = nextStage.style.visibility;
                nextStage.style.visibility = 'hidden';
                game.classList.add('is-location-transitioning');
                await prepareImages(nextStage, incoming);
                const timing = { duration: 1000, easing: 'cubic-bezier(.45,0,.2,1)', fill: 'forwards' };
                onMove(timing.duration / 1000);
                animations.push(
                    outgoing.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${-travel}px)` }], timing),
                    incoming.animate([{ transform: `translateX(${travel}px)` }, { transform: 'translateX(0)' }], timing),
                    seam.animate([
                        { offset: 0, transform: 'translateX(0)', opacity: 0 },
                        { offset: .2, transform: `translateX(${-travel * .2}px)`, opacity: .9 },
                        { offset: 1, transform: `translateX(${-travel}px)`, opacity: .9 },
                    ], timing),
                );
                await Promise.allSettled(animations.map((animation) => animation.finished));
                const fade = seam.animate([{ opacity: .9 }, { opacity: 0 }], {
                    duration: 450,
                    easing: 'ease-out',
                    fill: 'forwards',
                });
                animations.push(fade);
                await fade.finished;
            } finally {
                if (nextStage) nextStage.style.visibility = previousVisibility ?? '';
                overlay?.remove();
                animations.forEach((animation) => animation.cancel());
                game.classList.remove('is-location-transitioning');
                running = false;
            }
        },
    };
}
