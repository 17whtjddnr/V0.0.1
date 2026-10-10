export function createDeveloperCharacterSkillPicker(container, { skills, skillIds, isEnabled, onEdit }) {
    const selected = Array.from({ length: 4 }, (_, index) => skillIds[index] || '');
    const byId = new Map(skills.map((skill) => [skill.id, skill]));
    container.innerHTML = '<h3>배정 스킬</h3><p>서로 다른 스킬 4개를 순서대로 배정합니다. 직업을 변경해도 선택한 스킬은 유지됩니다.</p><label class="developer-skill-search">스킬 검색<input type="search" placeholder="스킬 이름 또는 ID 검색" autocomplete="off"></label><div class="developer-character-skill-slots"></div>';
    const search = container.querySelector('input');
    const list = container.querySelector('.developer-character-skill-slots');
    const rows = selected.map((_, index) => {
        const row = document.createElement('div');
        row.className = 'developer-character-skill-slot';
        const label = document.createElement('label');
        label.textContent = '스킬 ' + (index + 1);
        const select = document.createElement('select');
        select.name = 'assignedSkill' + (index + 1);
        select.required = true;
        const edit = document.createElement('button');
        edit.type = 'button';
        edit.dataset.assignedSkillEdit = String(index);
        edit.textContent = '편집';
        const summary = document.createElement('small');
        summary.setAttribute('aria-live', 'polite');
        label.append(select);
        row.append(label, edit, summary);
        list.append(row);
        select.addEventListener('change', () => { selected[index] = select.value; updateSummary(index); });
        edit.addEventListener('click', () => { if (byId.has(selected[index])) onEdit(selected[index]); });
        return { select, edit, summary };
    });
    function updateSummary(index) {
        const skill = byId.get(selected[index]);
        rows[index].edit.disabled = !skill;
        rows[index].edit.setAttribute('aria-label', skill ? skill.name + ' 스킬 편집' : '스킬을 선택한 후 편집');
        rows[index].summary.textContent = skill
            ? skill.id + ' · ' + skill.target + ' · 쿨타임 ' + skill.cooldown + '턴' + (isEnabled(skill.id) ? '' : ' · 비활성 스킬: 다시 선택해주세요') : '배정할 스킬을 선택해주세요.';
    }
    function renderOptions() {
        const query = search.value.trim().toLocaleLowerCase();
        const matches = skills.filter((skill) => isEnabled(skill.id) && (!query || (skill.name + ' ' + skill.id).toLocaleLowerCase().includes(query)));
        rows.forEach(({ select }, index) => {
            const choices = [...matches];
            const current = byId.get(selected[index]);
            if (current && !choices.some((skill) => skill.id === current.id)) choices.unshift(current);
            select.replaceChildren(new Option('스킬 선택', ''));
            const fragment = document.createDocumentFragment();
            for (const skill of choices) fragment.append(new Option(skill.name + ' · ' + skill.id + (isEnabled(skill.id) ? '' : ' (비활성)'), skill.id));
            select.append(fragment);
            select.value = selected[index];
            updateSummary(index);
        });
    }
    search.addEventListener('input', renderOptions);
    renderOptions();
    return { values: () => [...selected] };
}
