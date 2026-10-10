export function typeDialogueText(element, text, { interval = 35, immediate = false, onCharacter = () => {} } = {}) {
    if (!element) return () => {};
    const characters = Array.from(String(text || ''));
    let timer;
    let index = 0;
    let stopped = false;
    element.textContent = immediate ? characters.join('') : '';
    const tick = () => {
        if (stopped || !element.isConnected) return;
        const character = characters[index];
        element.textContent += character;
        onCharacter(character, index++);
        if (index < characters.length) timer = setTimeout(tick, interval);
    };
    if (!immediate && characters.length) timer = setTimeout(tick, interval);
    return () => { stopped = true; clearTimeout(timer); };
}
