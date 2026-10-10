// Fetch only likely next-scene images, with a bounded queue and decoded-image cache.
export function createImageWarmup({ createImage = () => new Image(), schedule = callback => setTimeout(callback, 350), limit = 2 } = {}) {
    const retained = new Map();
    let pending = [], active = 0, scheduled = false;
    function pump() {
        while (active < limit && pending.length) {
            const url = pending.shift();
            if (retained.has(url)) continue;
            const image = createImage();
            retained.set(url, image);
            active++;
            image.decoding = 'async'; image.fetchPriority = 'low';
            const finish = () => {
                image.onload = image.onerror = null;
                active--;
                while (retained.size > 32) {
                    const disposable = [...retained].find(([, item]) => !item.onload);
                    if (!disposable) break;
                    retained.delete(disposable[0]);
                }
                pump();
            };
            image.onload = finish;
            image.onerror = () => { retained.delete(url); finish(); };
            image.src = url;
        }
    }
    return urls => {
        pending = [...new Set(urls)].filter(url => typeof url === 'string' && url.startsWith('/assets/') && !retained.has(url)).slice(0, 8);
        if (scheduled) return;
        scheduled = true;
        schedule(() => { scheduled = false; pump(); });
    };
}
