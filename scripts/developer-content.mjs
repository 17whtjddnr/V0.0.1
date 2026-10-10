import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';

const kinds = new Set(['characters', 'monsters', 'skills']);
const actorFields = new Set(['name', 'element', 'zodiac', 'job', 'grade', 'portraitSrc', 'thumbnailSrc', 'skillIds', 'enabled']);
const object = value => value && typeof value === 'object' && !Array.isArray(value);
function checkData(value) {
    if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('유효하지 않은 숫자입니다.');
    if (object(value) || Array.isArray(value)) for (const [key, item] of Object.entries(value)) {
        if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('유효하지 않은 필드입니다.');
        checkData(item);
    }
}

export function createProjectContentWriter(root) {
    let writes = Promise.resolve();
    const directory = path.join(root, 'data/developer');
    async function imageFile(source) {
        if (!source) return source;
        if (typeof source !== 'string') throw new Error('이미지 경로를 확인해주세요.');
        if (source.startsWith('/assets/')) {
            const decoded = decodeURIComponent(source.split('?')[0]);
            const publicDirectory = path.resolve(root, 'public');
            const target = path.resolve(publicDirectory, `.${decoded}`);
            if (!target.startsWith(publicDirectory + path.sep) || decoded.includes('\\')) throw new Error('이미지 경로를 확인해주세요.');
            await readFile(target);
            return source;
        }
        const match = source.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);
        if (!match) throw new Error('프로젝트 이미지 또는 PNG·JPEG·WebP 업로드를 사용해주세요.');
        const bytes = Buffer.from(match[2], 'base64');
        const valid = match[1] === 'png' ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
            : match[1] === 'jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
            : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
        if (!valid || bytes.length > 6 * 1024 * 1024) throw new Error('이미지 형식 또는 용량을 확인해주세요.');
        const filename = `${createHash('sha256').update(bytes).digest('hex').slice(0, 24)}.${match[1] === 'jpeg' ? 'jpg' : match[1]}`;
        const output = path.join(root, 'public/assets/art/edited');
        await mkdir(output, { recursive: true });
        await writeFile(path.join(output, filename), bytes);
        return `/assets/art/edited/${filename}`;
    }
    async function save({ kind, id, patch }) {
        if (!kinds.has(kind) || typeof id !== 'string' || !(kind === 'skills' ? /^SKILL_\d+$/ : kind === 'characters' ? /^CHAR-\d+$/ : /^MON-[A-Za-z0-9-]+$/).test(id) || !object(patch)) throw new Error('편집 대상이 올바르지 않습니다.');
        checkData(patch);
        const allowed = kind === 'skills' ? new Set(['enabled', 'values']) : actorFields;
        if (Object.keys(patch).some(key => !allowed.has(key))) throw new Error('지원하지 않는 편집 필드입니다.');
        if (patch.enabled !== undefined && typeof patch.enabled !== 'boolean') throw new Error('활성화 값을 확인해주세요.');
        if (patch.grade !== undefined && (!Number.isInteger(patch.grade) || patch.grade < 1 || patch.grade > 5)) throw new Error('등급을 확인해주세요.');
        if (patch.skillIds !== undefined && (!Array.isArray(patch.skillIds) || patch.skillIds.length !== 4 || new Set(patch.skillIds).size !== 4 || patch.skillIds.some(skill => !/^SKILL_\d+$/.test(skill)))) throw new Error('서로 다른 스킬을 4개 배정해주세요.');
        for (const key of ['name', 'element', 'zodiac', 'job']) if (patch[key] !== undefined && (typeof patch[key] !== 'string' || !patch[key].trim() || patch[key].length > 160)) throw new Error('이름과 분류를 확인해주세요.');
        const normalized = structuredClone(patch);
        if (kind === 'skills' && normalized.values !== undefined) {
            const skill = normalized.values;
            if (!object(skill) || typeof skill.name !== 'string' || !skill.name.trim() || !Array.isArray(skill.effects) || skill.effects.length > 4 || ![skill.damageCoefficients, skill.healingCoefficients].every((values, index) => Array.isArray(values) && values.length === (index ? 2 : 4) && values.every(value => typeof value === 'number' && value >= 0))) throw new Error('스킬 이름·계수·효과를 확인해주세요.');
            if (skill.thumbnailSrc !== undefined) skill.thumbnailSrc = await imageFile(skill.thumbnailSrc);
        }
        for (const key of ['portraitSrc', 'thumbnailSrc']) if (normalized[key] !== undefined) normalized[key] = await imageFile(normalized[key]);
        await mkdir(directory, { recursive: true });
        const filename = path.join(directory, `${kind}.json`);
        let settings = {};
        try { settings = JSON.parse(await readFile(filename, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
        const next = { ...settings, [id]: { ...settings[id], ...normalized } };
        const temporary = `${filename}.${randomUUID()}.tmp`;
        await writeFile(temporary, JSON.stringify(next, null, 2) + '\n', 'utf8');
        await rename(temporary, filename);
        return next;
    }
    return edit => {
        const result = writes.then(() => save(edit));
        writes = result.catch(() => {});
        return result;
    };
}

export function developerContentPlugin(root) {
    const save = createProjectContentWriter(root);
    return {
        name: 'developer-content-files',
        apply: 'serve',
        configureServer(server) {
            server.middlewares.use(async (request, response, next) => {
                if (request.url?.split('?')[0] !== '/__developer-content') return next();
                response.setHeader('Content-Type', 'application/json; charset=utf-8');
                response.setHeader('Cache-Control', 'no-store');
                const remote = request.socket.remoteAddress || '';
                const origin = request.headers.origin;
                let localHost = false;
                try { localHost = ['localhost', '127.0.0.1', '[::1]'].includes(new URL(`http://${request.headers.host}`).hostname); } catch { /* Reject unknown hosts. */ }
                if (!localHost || !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote) || origin !== `http://${request.headers.host}`) {
                    response.statusCode = 403; response.end(JSON.stringify({ error: '로컬 개발 페이지에서만 저장할 수 있습니다.' })); return;
                }
                if (request.method !== 'POST' || !request.headers['content-type']?.startsWith('application/json')) {
                    response.statusCode = 405; response.end(JSON.stringify({ error: 'JSON POST 요청이 필요합니다.' })); return;
                }
                try {
                    let length = 0;
                    const chunks = [];
                    for await (const chunk of request) {
                        length += chunk.length;
                        if (length > 18 * 1024 * 1024) throw new Error('편집 데이터가 너무 큽니다.');
                        chunks.push(chunk);
                    }
                    const edit = JSON.parse(Buffer.concat(chunks).toString('utf8'));
                    const settings = await save(edit);
                    // Keep the active editor open, while subsequent reloads read fresh JSON.
                    const file = path.join(root, 'data/developer', `${edit.kind}.json`).replaceAll('\\', '/');
                    for (const module of server.moduleGraph.getModulesByFile(file) || []) server.moduleGraph.invalidateModule(module);
                    response.end(JSON.stringify({ settings }));
                } catch (error) {
                    response.statusCode = 400;
                    response.end(JSON.stringify({ error: error.message }));
                }
            });
        },
    };
}
