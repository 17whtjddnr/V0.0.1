const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

export function dialoguePanelMarkup(speaker, text, canAdvance = true) {
    return `<section class="plaza-monologue-dialogue${canAdvance ? '' : ' has-choices'}" ${canAdvance ? 'role="button" tabindex="0" data-action="plaza-dialogue-advance" aria-label="다이얼로그 · 다음 대사"' : 'aria-label="다이얼로그"'} aria-describedby="plaza-monologue-full-text"><strong class="plaza-monologue-speaker">${escape(speaker)}</strong><p class="plaza-monologue-line" aria-hidden="true"></p><span class="plaza-monologue-accessible" id="plaza-monologue-full-text">${escape(text)}</span>${canAdvance ? '<img class="plaza-monologue-indicator" src="/assets/icons/dropdown_icon.svg" alt="" aria-hidden="true">' : ''}</section>`;
}
