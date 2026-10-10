import guildRegions from '../data/maps/guild-regions.json';
import { guildDestinations, guildDestinationUnlocked } from './guild-destination.mjs';

let focusedMapSource;
function loadFocusedMap() {
    focusedMapSource ||= fetch('/assets/maps/fantasy_map_camera.svg?v=camera-1')
        .then((response) => {
            if (!response.ok) throw new Error('Focused map could not be loaded.');
            return response.text();
        }).catch((error) => {
            focusedMapSource = undefined;
            throw error;
        });
    return focusedMapSource;
}

const cameraFrames = new WeakMap();

function updateCamera(overlay, frame, svg) {
    const transform = getComputedStyle(frame).transform;
    const matrix = transform === 'none' ? new DOMMatrix() : new DOMMatrix(transform);
    const pixelsPerUnit = frame.offsetHeight / 1024 * matrix.a;
    const width = overlay.clientWidth / pixelsPerUnit;
    const height = overlay.clientHeight / pixelsPerUnit;
    const centerX = 768 - matrix.e / pixelsPerUnit;
    const centerY = 512 - matrix.f / pixelsPerUnit;
    svg.setAttribute('viewBox', `${centerX - width / 2} ${centerY - height / 2} ${width} ${height}`);
    const locationMarkers = [...svg.querySelectorAll('.guild-map-location-marker')];
    locationMarkers.forEach((marker) => {
        const icon = marker.querySelector('image');
        const label = marker.querySelector('text');
        icon.setAttribute('x', -20 / pixelsPerUnit);
        icon.setAttribute('y', -20 / pixelsPerUnit);
        icon.setAttribute('width', 40 / pixelsPerUnit);
        icon.setAttribute('height', 40 / pixelsPerUnit);
        label.setAttribute('x', 28 / pixelsPerUnit);
        label.setAttribute('font-size', 20 / pixelsPerUnit);
        label.setAttribute('stroke-width', 2 / pixelsPerUnit);
        const position = marker.transform.baseVal.consolidate().matrix;
        const rightNeighbors = locationMarkers.filter((other) => {
            const otherPosition = other.transform.baseVal.consolidate().matrix;
            return otherPosition.e > position.e && Math.abs(otherPosition.f - position.f) * pixelsPerUnit < 36;
        });
        if (rightNeighbors.length) {
            const available = Math.min(...rightNeighbors.map((other) => (other.transform.baseVal.consolidate().matrix.e - position.e) * pixelsPerUnit)) - 56;
            const textWidth = label.getComputedTextLength() * pixelsPerUnit;
            if (available > 40 && textWidth > available) label.setAttribute('font-size', 20 * available / textWidth / pixelsPerUnit);
        }
        const badge = marker.querySelector('.guild-map-location-lock');
        if (badge) {
            Object.entries({ x: 6, y: -24, width: 20, height: 20 }).forEach(([key, value]) => badge.setAttribute(key, value / pixelsPerUnit));
            const tooltip = marker.querySelector('.guild-map-location-tooltip');
            const rect = tooltip.querySelector('rect');
            Object.entries({ x: -20, y: 28, width: 280, height: 66, rx: 3 }).forEach(([key, value]) => rect.setAttribute(key, value / pixelsPerUnit));
            tooltip.querySelectorAll('text').forEach((text, index) => {
                text.setAttribute('x', -8 / pixelsPerUnit);
                text.setAttribute('y', (52 + index * 24) / pixelsPerUnit);
                text.setAttribute('font-size', 16 / pixelsPerUnit);
            });
        }
    });
}

function followCamera(overlay, frame, svg) {
    cancelAnimationFrame(cameraFrames.get(overlay));
    const tick = () => {
        if (!overlay.isConnected || !svg.isConnected) return;
        updateCamera(overlay, frame, svg);
        if (frame.getAnimations().some((animation) => animation.transitionProperty === 'transform' && animation.playState === 'running')) {
            cameraFrames.set(overlay, requestAnimationFrame(tick));
        } else {
            cameraFrames.delete(overlay);
        }
    };
    tick();
}

function createCameraSvg(source, region, clearedDestinations, testUnlock) {
    const svg = new DOMParser().parseFromString(source, 'image/svg+xml').documentElement;
    if (svg.localName !== 'svg') throw new Error('Map camera SVG is invalid.');
    const namespace = 'http://www.w3.org/2000/svg';
    const world = document.createElementNS(namespace, 'g');
    world.setAttribute('class', 'guild-map-camera-world');
    world.append(...svg.childNodes);
    svg.append(world);
    const focus = document.createElementNS(namespace, 'g');
    focus.setAttribute('class', 'guild-map-camera-focus');
    const path = document.createElementNS(namespace, 'path');
    Object.entries({
        d: region.path, fill: '#ffffff', 'fill-opacity': '.16', 'fill-rule': 'evenodd',
        stroke: '#ffffff', 'stroke-opacity': '.35', 'stroke-width': '1',
        'stroke-linejoin': 'round', 'vector-effect': 'non-scaling-stroke',
    }).forEach(([name, value]) => path.setAttribute(name, value));
    focus.append(path);
    const points = region.markers;
    const markers = document.createElementNS(namespace, 'g');
    markers.setAttribute('class', 'guild-map-region-markers');
    points.forEach(([x, y, destination], index) => {
        const { icon: iconName, name: locationName } = guildDestinations[destination];
        const marker = document.createElementNS(namespace, 'g');
        marker.setAttribute('class', 'guild-map-location-marker');
        marker.setAttribute('transform', `translate(${x} ${y})`);
        marker.setAttribute('data-action', 'guild-destination-open');
        marker.setAttribute('data-destination', destination);
        marker.setAttribute('role', 'button');
        marker.setAttribute('tabindex', '0');
        marker.setAttribute('aria-label', `${locationName} 원정지 상세 보기`);
        const icon = document.createElementNS(namespace, 'image');
        icon.setAttribute('href', `/assets/icons/${iconName}.svg`);
        const label = document.createElementNS(namespace, 'text');
        Object.entries({
            y: 0, fill: '#ffffff', 'font-weight': 600, 'dominant-baseline': 'central',
            'font-family': 'Noto Sans KR, Malgun Gothic, sans-serif', 'text-anchor': 'start',
            stroke: '#000000', 'stroke-opacity': '.65', 'paint-order': 'stroke',
        }).forEach(([name, value]) => label.setAttribute(name, value));
        label.textContent = locationName;
        marker.append(icon, label);
        if (!guildDestinationUnlocked(destination, clearedDestinations, testUnlock)) {
            marker.classList.add('is-locked');
            marker.setAttribute('aria-disabled', 'true');
            const tooltipId = `guild-map-lock-${destination}`;
            marker.setAttribute('aria-describedby', tooltipId);
            const badge = document.createElementNS(namespace, 'image');
            badge.setAttribute('class', 'guild-map-location-lock');
            badge.setAttribute('href', '/assets/icons/lock_icon.svg');
            const tooltip = document.createElementNS(namespace, 'g');
            tooltip.setAttribute('class', 'guild-map-location-tooltip');
            tooltip.setAttribute('id', tooltipId);
            tooltip.setAttribute('role', 'tooltip');
            const rect = document.createElementNS(namespace, 'rect');
            rect.setAttribute('fill', '#07110e');
            rect.setAttribute('fill-opacity', '.96');
            rect.setAttribute('stroke', '#ffffff');
            rect.setAttribute('stroke-opacity', '.5');
            rect.setAttribute('vector-effect', 'non-scaling-stroke');
            tooltip.append(rect);
            const previous = guildDestinations[points[index - 1][2]];
            ['잠금 해제 조건', `${previous.name} 1단계 클리어`].forEach((content, line) => {
                const text = document.createElementNS(namespace, 'text');
                text.setAttribute('fill', line ? '#ffffff' : '#fffbd6');
                text.setAttribute('font-family', 'Noto Sans KR, Malgun Gothic, sans-serif');
                text.textContent = content;
                tooltip.append(text);
            });
            marker.append(badge, tooltip);
            marker.addEventListener('pointerenter', () => {
                markers.querySelectorAll('.is-tooltip-visible').forEach((other) => other.classList.remove('is-tooltip-visible'));
                const frame = svg.closest('.guild-expedition-overlay')?.querySelector('.guild-expedition-map');
                if (frame?.getAnimations().some((animation) => animation.transitionProperty === 'transform' && animation.playState === 'running')) return;
                markers.append(marker);
                marker.classList.add('is-tooltip-visible');
            });
            marker.addEventListener('pointerleave', () => marker.classList.remove('is-tooltip-visible'));
            marker.addEventListener('focus', () => {
                marker.classList.add('is-tooltip-visible');
                if (markers.lastElementChild === marker) return;
                markers.append(marker);
                marker.focus();
            });
            marker.addEventListener('blur', () => marker.classList.remove('is-tooltip-visible'));
        }
        markers.append(marker);
    });
    focus.append(markers);
    svg.append(focus);
    svg.removeAttribute('width');
    svg.removeAttribute('height');
    svg.setAttribute('class', 'guild-map-focused-vector');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `${region.name} 확대 지도`);
    return svg;
}

export function guildExpeditionMapMarkup({ testUnlock = false } = {}) {
    void loadFocusedMap().catch((error) => console.warn('Map camera preload failed.', error));
    const hitRegions = Object.values(guildRegions).filter((region) => testUnlock || region.region === 'Stormreach').map((region) => {
        const { x, y, width, height } = region.label;
        const action = `data-action="guild-map-focus" data-map-region="${region.region}"`;
        return `<path class="guild-map-region-hit" d="${region.path}" fill-rule="evenodd" ${action} role="button" tabindex="0" aria-label="${region.name} 영역 확대"></path>
            <rect x="${x - width / 2}" y="${y - height / 2}" width="${width}" height="${height}" ${action} role="button" tabindex="0" aria-label="${region.name} 지명 확대"></rect>
            <rect x="${x - 32}" y="${y - 88}" width="64" height="80" ${action} aria-hidden="true"></rect>`;
    }).join('');
    return `<div class="guild-expedition-overlay" id="guild-expedition-map">
        <button class="guild-map-world-return" type="button" data-action="guild-map-world" aria-label="월드 맵으로 돌아가기" hidden><img src="/assets/icons/back_icon.svg" alt="" aria-hidden="true"><span>월드 맵</span></button>
        <h2 class="guild-map-focused-title" hidden>스톰리치</h2>
        <div class="guild-map-sea-spacer" aria-hidden="true"></div>
        <div class="guild-expedition-map">
            <img class="guild-expedition-map-image guild-map-overview-image" src="/assets/maps/${testUnlock ? 'fantasy_map_layers.svg?v=seven-playable-regions-1' : 'fantasy_map_stormreach_world.svg?v=stormreach-only-1'}" alt="파견 원정 준비 지도" draggable="false">
            <img class="guild-expedition-map-image guild-map-focused-image" src="/assets/maps/fantasy_map_stormreach_focused.svg?v=region-only-2" alt="스톰리치 확대 지도" draggable="false" aria-hidden="true">
            <svg class="guild-map-hit-layer" viewBox="0 0 1536 1024" aria-label="원정 지역 선택">
                ${hitRegions}
            </svg>
        </div>
        <div class="guild-map-land-extension" aria-hidden="true"></div>
    </div>`;
}

export function focusGuildMap(game, region, { animate = true, clearedDestinations = [], testUnlock = false } = {}) {
    const selectedRegion = guildRegions[region];
    if (!selectedRegion || !testUnlock && region !== 'Stormreach') return false;
    const overlay = game.querySelector('.guild-expedition-overlay');
    const frame = overlay?.querySelector('.guild-expedition-map');
    const area = frame?.querySelector(`.guild-map-region-hit[data-map-region="${region}"]`);
    if (!area) return false;

    const bounds = area.getBBox();
    const baseScale = frame.offsetHeight / 1024;
    const zoom = Math.min(
        overlay.clientWidth * .9 / (bounds.width * baseScale),
        overlay.clientHeight * .9 / (bounds.height * baseScale),
    );
    const x = (768 - bounds.x - bounds.width / 2) * baseScale * zoom;
    const y = (512 - bounds.y - bounds.height / 2) * baseScale * zoom;
    if (!animate) frame.style.transition = 'none';
    overlay.classList.add('is-focused');
    overlay.dataset.focusedRegion = region;
    overlay.querySelector('.guild-map-focused-title').hidden = false;
    overlay.querySelector('.guild-map-focused-title').textContent = selectedRegion.name;
    overlay.querySelector('.guild-map-world-return').hidden = false;
    frame.querySelector('.guild-map-overview-image').setAttribute('aria-hidden', 'true');
    frame.querySelector('.guild-map-focused-image').removeAttribute('aria-hidden');
    frame.querySelector('.guild-map-focused-image').src = region === 'Stormreach' ? '/assets/maps/fantasy_map_stormreach_focused.svg?v=region-only-2' : `/assets/maps/fantasy_map_${region.toLowerCase()}_focused.svg`;
    frame.querySelector('.guild-map-hit-layer').setAttribute('aria-hidden', 'true');
    frame.querySelectorAll('[role="button"]').forEach((button) => button.setAttribute('tabindex', '-1'));
    if (frame.contains(document.activeElement)) document.activeElement.blur();
    frame.style.transform = `translate(${x}px, ${y}px) scale(${zoom})`;
    if (!animate) {
        frame.getBoundingClientRect();
        frame.style.removeProperty('transition');
    }
    frame.getBoundingClientRect();
    void loadFocusedMap().then((source) => {
        if (!overlay.isConnected || overlay.dataset.focusedRegion !== region) return;
        const svg = createCameraSvg(source, selectedRegion, clearedDestinations, testUnlock);
        overlay.querySelector('.guild-map-focused-vector')?.remove();
        overlay.append(svg);
        // Reordering SVG markers can interrupt pointerleave delivery. Clear hover
        // state from the stable panel instead, including when leaving the panel.
        const clearTooltips = (activeMarker = null) => {
            svg.querySelectorAll('.guild-map-location-marker.is-locked').forEach((marker) => {
                marker.classList.toggle('is-tooltip-visible', marker === activeMarker);
            });
        };
        overlay.onpointermove = (event) => {
            if (event.pointerType === 'touch' || event.pointerType === 'pen') return;
            if (frame.getAnimations().some((animation) => animation.transitionProperty === 'transform' && animation.playState === 'running')) {
                clearTooltips();
                return;
            }
            const marker = event.target.closest('.guild-map-location-marker.is-locked');
            clearTooltips(marker && svg.contains(marker) ? marker : null);
        };
        overlay.onpointerleave = () => clearTooltips();
        overlay.classList.add('is-vector-ready');
        frame.setAttribute('aria-hidden', 'true');
        followCamera(overlay, frame, svg);
    }).catch((error) => console.warn('Focused map vector could not be rendered.', error));
    return true;
}

export function returnToGuildWorldMap(game) {
    const overlay = game.querySelector('.guild-expedition-overlay');
    const frame = overlay?.querySelector('.guild-expedition-map');
    if (!frame || !overlay.classList.contains('is-focused') || overlay.classList.contains('is-returning')) return false;
    delete overlay.dataset.focusedRegion;
    overlay.classList.add('is-returning');
    overlay.querySelector('.guild-map-focused-title').hidden = true;
    overlay.querySelector('.guild-map-world-return').hidden = true;
    frame.removeAttribute('aria-hidden');
    frame.style.transform = '';
    frame.getBoundingClientRect();
    const svg = overlay.querySelector('.guild-map-focused-vector');
    if (svg) followCamera(overlay, frame, svg);
    const movement = frame.getAnimations().filter((animation) => animation.transitionProperty === 'transform');
    void Promise.allSettled(movement.map((animation) => animation.finished)).then(() => {
        if (!overlay.isConnected || overlay.dataset.focusedRegion) return;
        cancelAnimationFrame(cameraFrames.get(overlay));
        cameraFrames.delete(overlay);
        overlay.querySelector('.guild-map-focused-vector')?.remove();
        overlay.classList.remove('is-vector-ready');
        overlay.classList.add('has-returned');
        overlay.classList.remove('is-focused', 'is-returning');
        frame.querySelector('.guild-map-overview-image').removeAttribute('aria-hidden');
        frame.querySelector('.guild-map-focused-image').setAttribute('aria-hidden', 'true');
        frame.querySelector('.guild-map-hit-layer').removeAttribute('aria-hidden');
        frame.querySelectorAll('[role="button"]').forEach((button) => button.setAttribute('tabindex', '0'));
    });
    return true;
}
