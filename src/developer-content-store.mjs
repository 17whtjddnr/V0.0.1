import characters from '../data/developer/characters.json' with { type: 'json' };
import skills from '../data/developer/skills.json' with { type: 'json' };
import monsters from '../data/developer/monsters.json' with { type: 'json' };

const projectData = { characters, skills, monsters };
function browserStorage() {
    try { return globalThis.localStorage; } catch { return null; }
}

export function createDeveloperContentStore(kind, {
    defaults = projectData[kind],
    development = import.meta.env?.DEV ?? true,
    persist = import.meta.env?.DEV ? persistProjectEdit : null,
    storage = browserStorage(),
} = {}) {
    const storageKey = `game-developer-${kind}-v1`;
    let current = structuredClone(defaults);
    if (development) {
        try {
            const cached = JSON.parse(storage?.getItem(storageKey) || '{}');
            if (cached && typeof cached === 'object' && !Array.isArray(cached)) {
                for (const [id, patch] of Object.entries(cached)) current[id] = { ...current[id], ...patch };
            }
        } catch { /* Old browser edits are optional; the project file is authoritative in production. */ }
    }
    return {
        get settings() { return current; },
        save(id, patch) {
            if (!development) throw new Error('편집은 로컬 개발 서버에서만 가능합니다.');
            const values = { ...current[id], ...patch };
            if (persist) return persist(kind, id, values).then(settings => {
                current = { ...current, ...settings };
                // A full browser cache must not undo a successful project-file save.
                try { storage?.setItem(storageKey, JSON.stringify(current)); } catch { /* Saved on disk. */ }
                return current[id];
            });
            const next = { ...current, [id]: values };
            storage?.setItem(storageKey, JSON.stringify(next));
            current = next;
            return current[id];
        },
    };
}

async function persistProjectEdit(kind, id, patch) {
    const response = await fetch('/__developer-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, id, patch }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.settings) throw new Error(result.error || '프로젝트 파일 저장에 실패했습니다. 개발 서버를 확인해주세요.');
    return result.settings;
}
