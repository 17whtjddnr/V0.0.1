export function createScenePresentation(playSound) {
    let lastScene = '';
    let lastContent = '';
    let sceneStarted = 0;
    let contentStarted = 0;
    const idleStarted = performance.now();
    return function updateScenePresentation(game, { sceneKey, contentKey = sceneKey, images = [], information = [], sound = 'appear' }) {
        const now = performance.now();
        const newScene = sceneKey !== lastScene;
        const newContent = contentKey !== lastContent;
        if (newScene) sceneStarted = now;
        if (newContent) contentStarted = now;
        if (sceneKey && (newScene || newContent)) playSound(sound);
        lastScene = sceneKey;
        lastContent = contentKey;
        const reveal = (element, start, index) => {
            const delay = index * 60 - (performance.now() - start);
            if (delay > -650) {
                element.classList.add('scene-entering');
                element.style.setProperty('--scene-reveal-delay', `${delay}ms`);
            }
        };
        images.forEach((element, index) => {
            const image = element.querySelector('img');
            if (newScene && image && !image.complete) {
                element.classList.add('scene-image-loading');
                const finish = () => {
                    element.classList.remove('scene-image-loading');
                    reveal(element, performance.now(), index);
                };
                image.addEventListener('load', finish, { once: true });
                image.addEventListener('error', finish, { once: true });
            } else reveal(element, sceneStarted, index);
        });
        information.forEach((element, index) => reveal(element, contentStarted, index));
        game.querySelectorAll('.codex-character-art-mask img:not(.plaza-encounter-additive), .enemy-mark').forEach((image, index) => {
            if (image.closest('.is-listener, .defeated, .acting, .hit')) return;
            image.classList.add('full-body-idle');
            image.style.setProperty('--idle-delay', `${-((now - idleStarted + index * 260) % 3200)}ms`);
            const additiveImage = image.parentElement.querySelector('.plaza-encounter-additive');
            if (additiveImage) {
                additiveImage.classList.add('full-body-idle');
                additiveImage.style.setProperty('--idle-delay', image.style.getPropertyValue('--idle-delay'));
                additiveImage.style.setProperty('--encounter-glow-delay', `${-((now - idleStarted) % 6000)}ms`);
            }
        });
    };
}
