export function createDeveloperImagePicker(container, config) {
    const labels = { portrait: '전체 이미지', thumbnail: '썸네일' };
    const values = { portrait: config.portraitSrc || '', thumbnail: config.thumbnailSrc || '' };
    const revisions = { portrait: 0, thumbnail: 0 };
    const pending = new Set();
    let disposed = false;
    let kind = 'portrait';
    let page = 0;
    const pageSize = 9;
    const pageCount = Math.ceil(config.files.length / pageSize);
    const asset = config.asset || ((file, type) => `/assets/art/2D/${type === 'portrait' ? 'Character' : 'Character_thumnail'}/${file}`);
    container.innerHTML = `<div class="developer-image-pair">${Object.entries(labels).map(([type, label]) => `<section class="developer-image-card"><h3>${label}</h3><img class="developer-image-preview is-${type}" data-image-preview="${type}" alt="${label} 미리보기"><div><button type="button" data-image-gallery="${type}" aria-pressed="${type === kind}">이미지 선택</button><label class="developer-upload-button">업로드<input type="file" data-image-upload="${type}" accept="image/png,image/jpeg,image/webp"></label></div><button type="button" class="developer-image-reset" data-image-reset="${type}">기본 이미지</button></section>`).join('')}</div><section class="developer-image-gallery"><h3 data-gallery-title></h3><div class="developer-image-grid" role="group" aria-label="이미지 선택"></div><div class="developer-image-pagination"><button type="button" data-image-page="-1" aria-label="이전 이미지 페이지">←</button><span aria-live="polite"></span><button type="button" data-image-page="1" aria-label="다음 이미지 페이지">→</button></div></section><small>PNG·JPEG·WebP · 썸네일과 전체 이미지는 각각 저장됩니다.</small>`;
    const preview = (type) => {
        container.querySelector(`[data-image-preview="${type}"]`).src = values[type] || config.defaults[type];
    };
    const renderGallery = () => {
        container.querySelector('[data-gallery-title]').textContent = `${labels[kind]} 선택`;
        container.querySelectorAll('[data-image-gallery]').forEach((button) => button.setAttribute('aria-pressed', button.dataset.imageGallery === kind));
        const grid = container.querySelector('.developer-image-grid');
        grid.replaceChildren();
        config.files.slice(page * pageSize, (page + 1) * pageSize).forEach((file, index) => {
            const src = asset(file, kind);
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `developer-image-tile is-${kind}`;
            button.dataset.imageAsset = file;
            button.setAttribute('aria-label', `${labels[kind]} ${page * pageSize + index + 1}`);
            button.setAttribute('aria-pressed', src === (values[kind] || config.defaults[kind]));
            const image = document.createElement('img');
            image.src = src;
            image.alt = '';
            image.draggable = false;
            button.append(image);
            grid.append(button);
        });
        container.querySelector('.developer-image-pagination span').textContent = `${page + 1} / ${pageCount}`;
        container.querySelector('[data-image-page="-1"]').disabled = page === 0;
        container.querySelector('[data-image-page="1"]').disabled = page === pageCount - 1;
    };
    const updateBusy = () => config.onBusy(pending.size > 0);
    const cancelUpload = (type) => {
        revisions[type] += 1;
        pending.delete(type);
        container.querySelector(`[data-image-upload="${type}"]`).value = '';
        updateBusy();
    };
    container.addEventListener('click', (event) => {
        const button = event.target.closest('button');
        if (!button || button.disabled) return;
        if (button.dataset.imageGallery) {
            kind = button.dataset.imageGallery;
            const selected = config.files.findIndex((file) => asset(file, kind) === values[kind]);
            page = selected < 0 ? 0 : Math.floor(selected / pageSize);
        }
        if (button.dataset.imagePage) page += Number(button.dataset.imagePage);
        if (button.dataset.imageAsset) {
            cancelUpload(kind);
            values[kind] = asset(button.dataset.imageAsset, kind);
            preview(kind);
            config.onError('');
        }
        if (button.dataset.imageReset) {
            const type = button.dataset.imageReset;
            cancelUpload(type);
            values[type] = '';
            preview(type);
            config.onError('');
        }
        renderGallery();
    });
    container.addEventListener('change', async (event) => {
        const type = event.target.dataset.imageUpload;
        const file = event.target.files?.[0];
        if (!type || !file) return;
        const revision = ++revisions[type];
        pending.add(type);
        updateBusy();
        config.onError('');
        try {
            const src = await prepareImage(file, type);
            if (disposed || revisions[type] !== revision) return;
            values[type] = src;
            preview(type);
            renderGallery();
        } catch (error) {
            if (!disposed && revisions[type] === revision) config.onError(error.message);
        } finally {
            if (!disposed && revisions[type] === revision) { pending.delete(type); updateBusy(); }
        }
    });
    preview('portrait');
    preview('thumbnail');
    renderGallery();
    return {
        values: () => ({ portraitSrc: values.portrait, thumbnailSrc: values.thumbnail }),
        dispose: () => { disposed = true; },
    };
}

async function prepareImage(file, type) {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('PNG·JPEG·WebP 이미지를 선택해주세요.');
    const bitmap = await createImageBitmap(file);
    try {
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, (type === 'thumbnail' ? 256 : 1024) / Math.max(bitmap.width, bitmap.height));
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/webp', .85);
    } finally { bitmap.close(); }
}
