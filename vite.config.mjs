import { createHash } from 'node:crypto';
import { buildRuntimeData } from './scripts/runtime-data.mjs';

export default ({ command }) => {
    const data = command === 'build' ? JSON.stringify(buildRuntimeData(new URL('./public/data/', import.meta.url))) : null;
    const filename = data && `assets/game-data-${createHash('sha256').update(data).digest('hex').slice(0, 12)}.json`;
    return {
        define: { __GAME_DATA_URL__: JSON.stringify(filename ? `/${filename}` : null) },
        plugins: data ? [{
            name: 'runtime-game-data',
            generateBundle() { this.emitFile({ type: 'asset', fileName: filename, source: data }); },
            transformIndexHtml() { return [{ tag: 'link', attrs: { rel: 'preload', as: 'fetch', href: `/${filename}`, crossorigin: 'anonymous' }, injectTo: 'head' }]; },
        }] : [],
        server: {
            watch: {
                // Windows can temporarily lock SVG files while they are copied.
                usePolling: true,
                interval: 500,
                binaryInterval: 1000,
                ignored: ['**/data/*-build-temp/**', '**/data/*-tools/**'],
            },
        },
    };
};
