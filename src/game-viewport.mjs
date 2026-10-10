export function gameViewportLayout(width, height, mobile = false) {
    const rotated = mobile && height > width;
    const logicalWidth = rotated ? height : width;
    const logicalHeight = rotated ? width : height;
    const scale = Math.min(logicalWidth / 1920, logicalHeight / 1080);
    return { rotated, width: logicalWidth, height: logicalHeight, scale, backgroundWidth: Math.min(2400, Math.max(1920, logicalWidth / scale)) };
}

export function logicalViewport() {
    return gameViewportLayout(innerWidth, innerHeight, navigator.maxTouchPoints > 0 || matchMedia('(pointer: coarse)').matches);
}

export function logicalPoint(x, y) {
    return document.documentElement.hasAttribute('data-landscape-rotated') ? { x: y, y: innerWidth - x } : { x, y };
}

// DOM rectangles are in physical screen coordinates; game calculations use landscape coordinates.
export function logicalRect(element) {
    const rect = element.getBoundingClientRect();
    if (!document.documentElement.hasAttribute('data-landscape-rotated')) return rect;
    return { x: rect.top, y: innerWidth - rect.right, left: rect.top, top: innerWidth - rect.right, right: rect.bottom, bottom: innerWidth - rect.left, width: rect.height, height: rect.width };
}

export function createGameViewport(game, stage) {
    const viewport = stage.parentElement;
    const background = document.createElement('div');
    background.id = 'scene-background'; background.setAttribute('aria-hidden', 'true');
    viewport.prepend(background);
    const fallback = 'radial-gradient(ellipse at 52% 37%, #282521 0, #1d1b18 38%, #171614 75%)';
    let source;
    function syncBackground() {
        const transition = game.style.transition;
        game.style.transition = 'none';
        source?.removeAttribute('data-viewport-background');
        game.removeAttribute('data-viewport-background-host');
        source = game.querySelector(':scope > .title-screen, :scope > .player-setup-screen, :scope > .plaza-page-background, :scope > .guild-page-background');
        const style = getComputedStyle(source || game);
        let image = style.backgroundImage;
        if (source?.classList.contains('title-screen')) {
            const shading = getComputedStyle(source, '::before').backgroundImage;
            if (shading !== 'none') image = `${shading}, ${image}`;
        }
        Object.assign(background.style, {
            backgroundImage: image === 'none' && style.backgroundColor === 'rgba(0, 0, 0, 0)' ? fallback : image,
            backgroundColor: style.backgroundColor,
            filter: style.filter,
        });
        source?.setAttribute('data-viewport-background', '');
        game.setAttribute('data-viewport-background-host', '');
        game.style.transition = transition;
    }
    function resize() {
        const layout = logicalViewport();
        document.documentElement.toggleAttribute('data-landscape-rotated', layout.rotated);
        Object.assign(document.body.style, { width: `${layout.width}px`, height: `${layout.height}px`, transform: `translate(-50%, -50%)${layout.rotated ? ' rotate(90deg)' : ''}` });
        stage.style.transform = `scale(${layout.scale})`;
        Object.assign(background.style, { width: `${layout.backgroundWidth}px`, transform: `translate(-50%, -50%) scale(${layout.scale})` });
        syncBackground();
    }
    async function lockLandscape() {
        if (!navigator.maxTouchPoints && !matchMedia('(pointer: coarse)').matches) return;
        try { await screen.orientation?.lock?.('landscape'); } catch { /* CSS rotation keeps landscape on browsers without locking. */ }
    }
    const observer = new MutationObserver(syncBackground);
    observer.observe(game, { childList: true });
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', resize);
    document.addEventListener('fullscreenchange', lockLandscape);
    document.addEventListener('pointerdown', lockLandscape, { once: true, passive: true });
    resize(); void lockLandscape();
    return { resize, syncBackground };
}
