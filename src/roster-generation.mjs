const characterGradeCounts = [120, 55, 25];
const monsterGradeCounts = [12, 8, 5, 3, 2];
const elements = ['불', '물', '풀', '빛', '어둠'];

const characterHouses = ['아르덴', '벨로스', '칼드윈', '에르하임', '세라핀', '라그넬', '모르칸', '엘드리안', '바르카', '실바렌', '카르미르', '노크티스', '이그니스', '루미에르', '드라벤', '오르펠', '페르디아', '아스텔', '케르누스', '발테온'];
const characterGivenNames = ['루미엘', '세레나', '카이렌', '엘로윈', '라비안', '미레아', '테오란', '아일린', '로에른', '벨리카'];
const monsterDescriptors = ['잿빛', '핏빛', '검은', '뒤틀린', '메마른', '굶주린', '울부짖는', '망각의', '갈라진', '침묵의'];
const monsterCreatures = ['그림울프', '심연 와이번', '혈석 가고일', '황혼 히드라', '망령 사슴', '독안개 맘모스', '뿔달린 식탐자', '서리 바실리스크', '밤가시 키메라', '재의 불사조', '늪지 트롤', '검은 케르베로스', '유리비늘 드레이크', '공허 메뚜기', '핏줄 거미', '달빛 웬디고', '무덤 구울', '폭풍 그리핀', '가시갑주 멧돼지', '얼음 리치', '붉은 만티코어', '심장포식자', '망각의 밴시', '용암 살라맨더', '뼈날개 로크', '저주받은 사티로스', '철턱 베히모스', '수정벌레 군주', '어둠송곳니 표범', '균열의 레비아탄'];
const jobTitles = { 기사: '기사', 마도사: '마도사', 사수: '사수', 정령사: '정령사', 도적: '도적', 전사: '전사' };
const jobMarks = { 기사: '⚔', 마도사: '✧', 사수: '➶', 정령사: '✚', 도적: '⚝', 전사: '⚒' };
const gradeColors = { 1: 'green', 2: 'blue', 3: 'purple', 4: 'gold', 5: 'red' };
const basicSkill = {
    id: 'BASIC_ATTACK', name: '기본 공격', target: '적', cooldown: 0, category: '공격', isBasicAttack: true,
    damageCoefficients: [0.85, 0, 0, 0], healingCoefficients: [0, 0], effects: [],
    tooltipKo: '대상: 적 1명. 공격력의 0.85배 피해를 줍니다. 쿨타임 없음.',
    tooltipEn: 'Target: one enemy. Deals 0.85x Attack damage. No cooldown.',
};
const fallbackSkillPool = [
    { id: 'FALLBACK_1', name: '수호자의 일격', cooldown: 2, category: '공격', damageCoefficients: [0.9, 0, 0, 0], healingCoefficients: [0, 0], effects: [], tooltipKo: '', tooltipEn: '' },
    { id: 'FALLBACK_2', name: '황혼의 가호', cooldown: 3, category: '버프', damageCoefficients: [0, 0, 0, 0], healingCoefficients: [0, 0], effects: [], tooltipKo: '', tooltipEn: '' },
    { id: 'FALLBACK_3', name: '균열의 화살', cooldown: 1, category: '공격', damageCoefficients: [1, 0, 0, 0], healingCoefficients: [0, 0], effects: [], tooltipKo: '', tooltipEn: '' },
    { id: 'FALLBACK_4', name: '별빛 회복', cooldown: 2, category: '회복', damageCoefficients: [0, 0, 0, 0], healingCoefficients: [0.7, 0], effects: [], tooltipKo: '', tooltipEn: '' },
    { id: 'FALLBACK_5', name: '속박의 인장', cooldown: 2, category: '디버프', damageCoefficients: [0, 0, 0, 0], healingCoefficients: [0, 0], effects: [], tooltipKo: '', tooltipEn: '' },
];

function allocateGrades(counts, firstGrade = 1) {
    const remaining = [...counts];
    const assigned = counts.map(() => 0);
    const total = counts.reduce((sum, count) => sum + count, 0);
    const grades = [];
    for (let index = 0; index < total; index += 1) {
        let selected = -1;
        let largestDeficit = -Infinity;
        counts.forEach((count, gradeIndex) => {
            if (remaining[gradeIndex] <= 0) return;
            const deficit = count * (index + 1) / total - assigned[gradeIndex];
            if (deficit > largestDeficit) {
                selected = gradeIndex;
                largestDeficit = deficit;
            }
        });
        remaining[selected] -= 1;
        assigned[selected] += 1;
        grades.push(selected + firstGrade);
    }
    return grades;
}

function lookupGrowthRows(rows) {
    const growth = new Map();
    rows.forEach((row) => {
        const stateId = Number(row['상태ID']);
        const level = Number(row['레벨']);
        const grade = Number(row['등급']);
        if (!Number.isInteger(stateId) || !row['별자리'] || !row['직업'] || !level || !grade) return;
        growth.set(`${row['별자리']}|${row['직업']}|${level}|${grade}`, row);
    });
    return growth;
}

function statsFromGrowth(row) {
    return {
        attack: Number(row['공격력']),
        maxHp: Number(row['생명력']),
        defense: Number(row['방어력']),
        speed: Number(row['속도']),
        critChance: Number(row['치명확률']),
        critDamage: Number(row['치명피해']),
        effectHit: Number(row['효과적중']),
        effectResist: Number(row['효과저항']),
    };
}

function zodiacAndJob(index, zodiacs, jobs) {
    const zodiacIndex = index % zodiacs.length;
    const round = Math.floor(index / zodiacs.length);
    return { zodiac: zodiacs[zodiacIndex], job: jobs[(zodiacIndex + round) % jobs.length] };
}

function characterName(index) {
    const house = characterHouses[Math.floor(index / characterGivenNames.length) % characterHouses.length];
    return `${house} ${characterGivenNames[index % characterGivenNames.length]}`;
}

function skillsForRoster(index, skillPool, job) {
    const pool = skillPool.length >= 3 ? skillPool : fallbackSkillPool;
    const basicAttacks = pool.filter((skill) => skill.isBasicAttack);
    const regularSkills = pool.filter((skill) => !skill.isBasicAttack);
    const hasCategory = (skill, category) => String(skill.category || '').split('|').includes(category);
    const spirits = job === '정령사';
    const recoveries = regularSkills.filter((skill) => hasCategory(skill, '회복'));
    const attacks = regularSkills.filter((skill) => hasCategory(skill, '공격') && (spirits || !hasCategory(skill, '회복')));
    const buffs = regularSkills.filter((skill) => hasCategory(skill, '버프') && (spirits || !hasCategory(skill, '회복')));
    const debuffs = regularSkills.filter((skill) => hasCategory(skill, '디버프') && (spirits || !hasCategory(skill, '회복')));
    const pick = (items, offset, fallback) => items.length ? items[((offset % items.length) + items.length) % items.length] : fallback;
    const basic = pick(basicAttacks, index, basicSkill);
    const assigned = spirits
        ? [
            pick(recoveries, index * 3, fallbackSkillPool[3]),
            pick(buffs, index * 5, fallbackSkillPool[1]),
            pick(debuffs, index * 7, fallbackSkillPool[4]),
        ]
        : [
            pick(attacks, index * 3, fallbackSkillPool[0]),
            pick(attacks, index * 3 + 1, fallbackSkillPool[2]),
            pick(index % 2 === 0 ? buffs : debuffs, index * 11, index % 2 === 0 ? fallbackSkillPool[1] : fallbackSkillPool[4]),
        ];
    const uniqueSkills = assigned.filter((skill, skillIndex) => assigned.findIndex((candidate) => candidate.id === skill.id) === skillIndex);
    while (uniqueSkills.length < 3) {
        const fillerPool = (spirits ? [...recoveries, ...buffs, ...debuffs] : [...attacks, ...buffs, ...debuffs])
            .filter((skill) => !uniqueSkills.some((assignedSkill) => assignedSkill.id === skill.id));
        if (!fillerPool.length) break;
        const filler = pick(fillerPool, index * 13 + uniqueSkills.length, fallbackSkillPool[0]);
        uniqueSkills.push(filler);
    }
    return [basic, ...uniqueSkills];
}

function createRoster(kind, count, gradeCounts, zodiacs, jobs, growth, level, skillPool) {
    const grades = allocateGrades(gradeCounts, kind === 'character' ? 3 : 1);
    return Array.from({ length: count }, (_, index) => {
        const { zodiac, job } = zodiacAndJob(index, zodiacs, jobs);
        const element = elements[index % elements.length];
        const grade = grades[index];
        const profile = growth.get(`${zodiac}|${job}|${level}|${grade}`);
        if (!profile) throw new Error(`Missing zodiac growth row: ${zodiac} / ${job} / Lv.${level} / Grade ${grade}`);
        const stats = statsFromGrowth(profile);
        if (kind === 'character') {
            return {
                id: `CHAR-${String(index + 1).padStart(3, '0')}`,
                name: characterName(index),
                zodiac,
                element,
                job,
                title: jobTitles[job] || job,
                level,
                grade,
                gradeColor: gradeColors[grade],
                mark: jobMarks[job] || '✦',
                skills: skillsForRoster(index, skillPool, job),
                stats,
                growthStateId: Number(profile['상태ID']),
            };
        }
        return {
            id: `MON-${String(index + 1).padStart(3, '0')}`,
            name: `${monsterDescriptors[index % monsterDescriptors.length]} ${monsterCreatures[index % monsterCreatures.length]}`,
            zodiac,
            element,
            job,
            level,
            grade,
            gradeColor: gradeColors[grade],
            mark: ['☠', '♟', '♜', '✣', '♞'][index % 5],
            skills: skillsForRoster(index, skillPool, job),
            stats,
            growthStateId: Number(profile['상태ID']),
        };
    });
}

export function applyRosterProfile(entry, changes, growthRows, skillPool = []) {
    const profile = { ...entry, ...changes };
    const row = growthRows.find((row) => row['별자리'] === profile.zodiac
        && row['직업'] === profile.job
        && Number(row['레벨']) === Number(profile.level)
        && Number(row['등급']) === Number(profile.grade));
    if (!row) throw new Error('선택한 별자리·직업·등급·레벨의 성장표가 없습니다.');
    const index = Math.max(0, Number(String(entry.id).split('-')[1]) - 1);
    return {
        ...profile,
        title: jobTitles[profile.job] || profile.job,
        mark: jobMarks[profile.job] || '✦',
        gradeColor: gradeColors[profile.grade],
        growthStateId: Number(row['상태ID']),
        stats: statsFromGrowth(row),
        skills: profile.job === entry.job ? entry.skills : skillsForRoster(index, skillPool, profile.job),
    };
}

export function generateRosters(growthRows, level = 5, skillPool = []) {
    const selectedLevel = Number(level);
    if (!Number.isInteger(selectedLevel) || selectedLevel < 1 || selectedLevel > 5) {
        throw new Error(`Roster level must be an integer from 1 to 5; got ${level}`);
    }
    const validRows = growthRows.filter((row) => Number.isInteger(Number(row['상태ID'])) && row['별자리'] && row['직업']);
    const zodiacs = [...new Set(validRows.map((row) => row['별자리']))];
    const jobs = [...new Set(validRows.map((row) => row['직업']))];
    if (zodiacs.length !== 12 || jobs.length !== 6 || validRows.length !== 1800) {
        throw new Error(`Expected 1,800 growth states over 12 zodiacs and 6 jobs; got ${validRows.length}, ${zodiacs.length}, and ${jobs.length}`);
    }
    const growth = lookupGrowthRows(validRows);
    return {
        characters: createRoster('character', 200, characterGradeCounts, zodiacs, jobs, growth, selectedLevel, skillPool),
        monsters: createRoster('monster', 30, monsterGradeCounts, zodiacs, jobs, growth, selectedLevel, skillPool),
    };
}
