const triggerSelector = 'button, a, label, [title], [data-tooltip], .hero, .plaza-skill-tooltip-trigger, .developer-skill-trigger, .combat-status, .guild-research-node, .guild-destination-subregion, .guild-map-location-marker, .roster-skill-icon, .plaza-skill-icon, .catalog-table tr';

export function createPressHover(root, { show = () => {}, hide = () => {} } = {}) {
    let press, timer, suppressed;
    const html = document.documentElement;
    html.toggleAttribute('data-mouse-input', matchMedia('(hover: hover)').matches);
    function clear() {
        clearTimeout(timer);
        if (press?.active) {
            press.nodes.forEach(node => node.classList.remove('is-press-hover'));
            hide(press.target, press.touch);
        }
        press = null;
    }
    function down(event) {
        if (event.button !== 0 || !event.isPrimary) return;
        const touch = event.pointerType !== 'mouse';
        html.toggleAttribute('data-mouse-input', !touch);
        clear();
        if (!event.target.closest(triggerSelector) || event.target.closest('input,textarea,select,[contenteditable="true"]')) return;
        const nodes = [];
        for (let node = event.target; node && node !== root; node = node.parentElement) nodes.push(node);
        press = { target: event.target, pointerId: event.pointerId, x: event.clientX, y: event.clientY, nodes, touch, active: false };
        timer = setTimeout(() => {
            if (!press?.target.isConnected) { clear(); return; }
            press.active = true;
            press.nodes.forEach(node => node.classList.add('is-press-hover'));
            suppressed = { target: press.target, until: performance.now() + 1000 };
            show(press.target, press.touch);
        }, 450);
    }
    function move(event) {
        if (event.pointerType === 'mouse') html.setAttribute('data-mouse-input', '');
        if (press && event.pointerId === press.pointerId && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 12) clear();
    }
    function up(event) {
        if (press && event.pointerId !== press.pointerId) return;
        if (press?.active) suppressed = { target: press.target, until: performance.now() + 800 };
        clear();
    }
    function click(event) {
        if (!suppressed || performance.now() > suppressed.until) return;
        if (suppressed.target === event.target || suppressed.target.contains(event.target) || event.target.contains(suppressed.target)) {
            event.preventDefault(); event.stopImmediatePropagation(); suppressed = null;
        }
    }
    function context(event) { if (press) event.preventDefault(); }
    function keyboard(event) { if (event.key === 'Tab') { html.setAttribute('data-mouse-input', ''); clear(); } }
    root.addEventListener('pointerdown', down, true);
    document.addEventListener('pointermove', move, { passive: true });
    document.addEventListener('pointerup', up, true);
    document.addEventListener('pointercancel', up, true);
    root.addEventListener('click', click, true);
    root.addEventListener('contextmenu', context);
    root.addEventListener('scroll', clear, true);
    document.addEventListener('keydown', keyboard);
    window.addEventListener('blur', clear);
    const observer = new MutationObserver(() => { if (press && !press.target.isConnected) clear(); });
    observer.observe(root, { childList: true, subtree: true });
    return { clear };
}
