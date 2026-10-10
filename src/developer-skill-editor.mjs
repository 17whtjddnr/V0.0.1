const escape = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const numberField = (name, label, value, max = 10000, step = 'any') => `<label>${label}<input type="number" name="${name}" value="${Number(Number(value).toFixed(10))}" min="0" max="${max}" step="${step}" required></label>`;
const textField = (name, label, value) => `<label>${label}<input name="${name}" value="${escape(value)}" maxlength="160"></label>`;
const options = (values, selected) => values.map((value) => `<option value="${escape(value)}" ${value === selected ? 'selected' : ''}>${escape(value)}</option>`).join('');

export function createDeveloperSkillEditor(config) {
    const { skill, effects, deriveSkill } = config;
    const page = document.createElement('main');
    page.className = 'developer-skill-editor-page';
    const targets = ['적', '적전체', '자신', '아군', '아군과 자신', '아군전체'];
    const effectTargets = [...new Set(['대상', '자신', '아군', '사망 아군', '이번 주공격', '원래 공격 대상', '자신→대상', ...effects.map((effect) => effect.effectTarget)].filter(Boolean))];
    const effectSlot = (index) => {
        const effect = skill.effects[index] || {};
        return `<fieldset class="skill-editor-effect" data-effect-slot="${index}"><legend>효과 ${index + 1}</legend><label>효과 종류<select name="effect${index}code"><option value="">없음</option>${effects.map((item) => `<option value="${escape(item.code)}" ${item.code === effect.code ? 'selected' : ''}>${escape(item.name)} · ${escape(item.code)}</option>`).join('')}</select></label><div data-effect-fields><div class="skill-editor-fields">${numberField(`effect${index}value`, '수치', effect.value ?? 0)}${numberField(`effect${index}duration`, '지속 턴', effect.duration ?? 0, 100, '1')}${numberField(`effect${index}chance`, '확률 (%)', (effect.chance ?? 1) * 100, 100)}<label>효과 적용 대상<select name="effect${index}effectTarget">${options([...new Set([...effectTargets, effect.effectTarget].filter(Boolean))], effect.effectTarget || '대상')}</select></label></div><details><summary>이름·단위·균형 기준 편집</summary><div class="skill-editor-fields">${textField(`effect${index}name`, '효과 이름', effect.name)}${textField(`effect${index}englishName`, '영문 이름', effect.englishName)}${textField(`effect${index}unit`, '수치 단위', effect.unit)}${numberField(`effect${index}baseValue`, '기준 수치', effect.baseValue ?? 1)}${numberField(`effect${index}baseDuration`, '기준 지속 턴', effect.baseDuration ?? 0, 100, '1')}${numberField(`effect${index}baseCost`, '기준 비용', effect.baseCost ?? 0)}</div></details></div></fieldset>`;
    };
    page.innerHTML = `<form><div class="skill-editor-toolbar"><div><span>${escape(skill.id)}</span><h1>스킬 편집</h1></div><div><button type="button" data-skill-cancel>돌아가기</button><button type="submit">저장</button></div></div><div class="skill-editor-layout"><aside class="skill-editor-sidebar"><section><h2>스킬 썸네일</h2><img class="skill-editor-thumbnail" alt="스킬 썸네일 미리보기"><div class="skill-editor-image-buttons"><label class="developer-upload-button">이미지 업로드<input type="file" data-skill-image-upload accept="image/png,image/jpeg,image/webp"></label><button type="button" data-skill-image-reset>기본 아이콘</button></div><div class="skill-editor-icon-grid" aria-label="썸네일 이미지 선택"></div><div class="skill-editor-image-pagination"><button type="button" data-icon-page="-1" aria-label="이전 이미지">←</button><span></span><button type="button" data-icon-page="1" aria-label="다음 이미지">→</button></div></section><section class="skill-editor-score" aria-live="polite"><h2>균형점수</h2><output data-skill-score></output><p>목표 <output data-skill-target-score></output> · 차이 <output data-skill-score-delta></output></p><p data-skill-balance-status></p><small>변경한 값을 그대로 계산하며, 자동으로 수치를 보정하지 않습니다.</small></section></aside><div class="skill-editor-main"><section><h2>기본 설정</h2><div class="skill-editor-fields">${textField('name', '스킬 이름', skill.name)}<label>스킬 대상<select name="target">${options(targets, skill.target)}</select></label>${numberField('cooldown', '쿨타임 (턴)', skill.cooldown, 100, '1')}${numberField('balanceTargetScore', '목표 균형점수 (%)', (skill.balanceTargetScore ?? skill.targetScore ?? .9) * 100, 10000)}<label class="skill-editor-check"><input type="checkbox" name="isBasicAttack" ${skill.isBasicAttack ? 'checked' : ''}>기본 공격</label><label class="skill-editor-check"><input type="checkbox" name="enabled" ${config.enabled ? 'checked' : ''}>활성화</label></div><div class="skill-editor-categories"><span>유형</span>${['공격', '회복', '버프', '디버프'].map((category) => `<label><input type="checkbox" name="category" value="${category}" ${skill.category.split('|').includes(category) ? 'checked' : ''}>${category}</label>`).join('')}</div></section><section><h2>피해 계수</h2><div class="skill-editor-fields">${['공격력', '방어력', '속도', '생명력'].map((label, index) => numberField(`damage${index}`, `${label} 비례`, skill.damageCoefficients[index] ?? 0)).join('')}</div><h2>회복 계수</h2><div class="skill-editor-fields">${['공격력', '최대 생명력'].map((label, index) => numberField(`healing${index}`, `${label} 비례`, skill.healingCoefficients[index] ?? 0)).join('')}</div></section><section><h2>스킬 효과 · 최대 4개</h2><div class="skill-editor-effects">${[0, 1, 2, 3].map(effectSlot).join('')}</div></section><section><h2>설명 미리보기</h2><p class="skill-editor-description" data-skill-description></p><details><summary>설명 직접 편집</summary><label>한국어 설명<textarea name="customTooltipKo" rows="3" placeholder="비워두면 변경값으로 자동 생성합니다.">${escape(skill.customTooltipKo || '')}</textarea></label><label>영문 설명<textarea name="customTooltipEn" rows="3" placeholder="비워두면 변경값으로 자동 생성합니다.">${escape(skill.customTooltipEn || '')}</textarea></label></details></section></div></div><p class="skill-editor-error" role="alert"></p></form>`;
    const form = page.querySelector('form');
    const error = page.querySelector('.skill-editor-error');
    const save = form.querySelector('[type=submit]');
    form.elements.name.required = true;
    let thumbnailSrc = skill.thumbnailSrc || '';
    let imagePage = 0;
    let revision = 0;
    let disposed = false;
    const preview = page.querySelector('.skill-editor-thumbnail');
    const renderIcons = () => {
        preview.src = thumbnailSrc || config.defaultThumbnailSrc;
        const grid = page.querySelector('.skill-editor-icon-grid');
        grid.replaceChildren();
        config.iconChoices.slice(imagePage * 9, imagePage * 9 + 9).forEach((src, index) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.dataset.skillImage = src;
            button.setAttribute('aria-label', `스킬 이미지 ${imagePage * 9 + index + 1}`);
            button.setAttribute('aria-pressed', thumbnailSrc === src);
            const image = document.createElement('img');image.src = src;image.alt = '';button.append(image);grid.append(button);
        });
        page.querySelector('.skill-editor-image-pagination span').textContent = `${imagePage + 1} / ${Math.ceil(config.iconChoices.length / 9)}`;
        page.querySelector('[data-icon-page="-1"]').disabled = imagePage === 0;
        page.querySelector('[data-icon-page="1"]').disabled = (imagePage + 1) * 9 >= config.iconChoices.length;
    };
    const syncEffect = (index) => {
        const selected = form.elements[`effect${index}code`].value;
        page.querySelector(`[data-effect-slot="${index}"]`).querySelectorAll('[data-effect-fields] input, [data-effect-fields] select').forEach((input) => { input.disabled = !selected; });
    };
    const numeric = (name) => {
        const input = form.elements[name];
        if (!input.value.trim() || !input.checkValidity()) throw new Error('수치의 허용 범위를 확인해주세요.');
        return Number(input.value);
    };
    const readDraft = () => {
        const data = new FormData(form);
        const selectedEffects = [0, 1, 2, 3].flatMap((index) => {
            const code = data.get(`effect${index}code`);
            if (!code) return [];
            const effect = effects.find((item) => item.code === code);
            if (!effect) throw new Error('올바른 효과를 선택해주세요.');
            return [{ ...effect, code,
                name: String(data.get(`effect${index}name`) || effect.name),
                englishName: String(data.get(`effect${index}englishName`) || effect.englishName),
                unit: String(data.get(`effect${index}unit`) || ''),
                effectTarget: String(data.get(`effect${index}effectTarget`)),
                value: numeric(`effect${index}value`), duration: numeric(`effect${index}duration`),
                chance: numeric(`effect${index}chance`) / 100,
                baseValue: numeric(`effect${index}baseValue`), baseDuration: numeric(`effect${index}baseDuration`), baseCost: numeric(`effect${index}baseCost`),
            }];
        });
        return { name: String(data.get('name')).trim(), target: String(data.get('target')), category: data.getAll('category').join('|'),
            isBasicAttack: data.has('isBasicAttack'), cooldown: numeric('cooldown'), balanceTargetScore: numeric('balanceTargetScore') / 100,
            damageCoefficients: [0, 1, 2, 3].map((index) => numeric(`damage${index}`)), healingCoefficients: [0, 1].map((index) => numeric(`healing${index}`)),
            effects: selectedEffects, thumbnailSrc, customTooltipKo: String(data.get('customTooltipKo')).trim(), customTooltipEn: String(data.get('customTooltipEn')).trim(),
        };
    };
    const updateScore = () => {
        try {
            const derived = deriveSkill({ ...skill, ...readDraft() });
            page.querySelector('[data-skill-score]').textContent = `${(derived.scoreAfter * 100).toFixed(1)}%`;
            page.querySelector('[data-skill-target-score]').textContent = `${(derived.targetScore * 100).toFixed(1)}%`;
            const delta = (derived.scoreAfter - derived.targetScore) * 100;
            page.querySelector('[data-skill-score-delta]').textContent = `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%p`;
            page.querySelector('[data-skill-balance-status]').textContent = derived.balanceReached ? '목표 ±2%p 범위' : delta > 0 ? '목표보다 높은 점수' : '목표보다 낮은 점수';
            page.querySelector('[data-skill-description]').textContent = derived.tooltipKo;
            error.textContent = '';
        } catch (exception) {
            page.querySelector('[data-skill-score]').textContent = '입력값 확인';
            error.textContent = exception.message;
        }
    };
    [0, 1, 2, 3].forEach(syncEffect);
    form.addEventListener('input', updateScore);
    form.addEventListener('change', async (event) => {
        const slot = event.target.name?.match(/^effect(\d)code$/);
        if (slot) {
            const index = Number(slot[1]);const effect = effects.find((item) => item.code === event.target.value);
            if (effect) {
                const defaults = { name: effect.name, englishName: effect.englishName, unit: effect.unit, effectTarget: effect.effectTarget, value: effect.baseValue, duration: effect.baseDuration, chance: 100, baseValue: effect.baseValue, baseDuration: effect.baseDuration, baseCost: effect.baseCost };
                Object.entries(defaults).forEach(([key, value]) => { form.elements[`effect${index}${key}`].value = value ?? ''; });
            }
            syncEffect(index);
        }
        updateScore();
        if (event.target.matches('[data-skill-image-upload]') && event.target.files[0]) {
            const current = ++revision;save.disabled = true;
            try {
                const src = await uploadedThumbnail(event.target.files[0]);
                if (disposed || current !== revision) return;
                thumbnailSrc = src;renderIcons();updateScore();
            } catch (exception) { if (!disposed && current === revision) error.textContent = exception.message; }
            finally { if (!disposed && current === revision) save.disabled = false; }
        }
    });
    form.addEventListener('click', (event) => {
        const button = event.target.closest('button');if (!button || button.disabled) return;
        if (button.matches('[data-skill-cancel]')) { disposed = true;config.onCancel(); }
        if (button.dataset.iconPage) { imagePage += Number(button.dataset.iconPage);renderIcons(); }
        if (button.dataset.skillImage || button.matches('[data-skill-image-reset]')) {
            revision += 1;save.disabled = false;thumbnailSrc = button.dataset.skillImage || '';
            page.querySelector('[data-skill-image-upload]').value = '';renderIcons();updateScore();
        }
    });
    const projectNote = document.createElement('p');
    projectNote.className = 'skill-editor-save-note';
    projectNote.textContent = '저장하면 프로젝트 파일에 기록됩니다. Git 커밋·푸시 후 배포 버전에 반영됩니다.';
    form.querySelector('.skill-editor-toolbar').after(projectNote);
    form.addEventListener('submit', async (event) => {
        event.preventDefault();if (save.disabled) return;
        save.disabled = true; form.inert = true;
        try {
            const draft = readDraft();
            if (!draft.name || !draft.category) throw new Error('스킬 이름과 유형을 입력해주세요.');
            await config.onSave(draft, form.elements.enabled.checked);
            disposed = true;
        } catch (exception) { error.textContent = `저장하지 못했습니다. ${exception.message}`; }
        finally { save.disabled = false; form.inert = false; }
    });
    renderIcons();updateScore();
    return page;
}

async function uploadedThumbnail(file) {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('PNG·JPEG·WebP 이미지를 선택해주세요.');
    const bitmap = await createImageBitmap(file);
    try {
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, 256 / Math.max(bitmap.width, bitmap.height));
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/webp', .85);
    } finally { bitmap.close(); }
}
