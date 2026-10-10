import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const stages = [
    ['온바람 평야', 'meadow', 'Stormreach'], ['안개솔 숲', 'mistwood', 'Stormreach'],
    ['잔물결 강', 'quietleaf', 'Stormreach'], ['잿빛 심연', 'ashabyss', 'Stormreach'],
    ['바람성', 'windcastle', 'Stormreach'], ['서풍 들판', 'veyrholt-1', 'Veyrholt'],
    ['울림굴', 'veyrholt-2', 'Veyrholt'], ['검은깃 야영지', 'veyrholt-3', 'Veyrholt'],
    ['벼랑바람 길', 'veyrholt-4', 'Veyrholt'], ['푸른솔 숲', 'veyrholt-5', 'Veyrholt'],
    ['고산 요새', 'veyrholt-6', 'Veyrholt'],
];
const subregions = { 북부: 'north', 서부: 'west', 동부: 'east', 남부: 'south',
    '성문 입구': 'gate', '무너진 광장': 'square', 광장: 'square', '왕실 유적': 'royal', 왕실: 'royal',
    '황폐한 안뜰': 'courtyard', 안뜰: 'courtyard', '외곽 초소': 'outpost', 야영지: 'camp', '약탈품 창고': 'warehouse', 망루: 'tower' };
const files = (directory) => readdirSync(path.join(root, directory), { recursive: true })
    .filter((file) => file.endsWith('.webp')).map((file) => file.replaceAll('\\', '/'));
const images = files('public/assets/art/2D/Monster');
const thumbnails = files('public/assets/art/2D/Monster_thumnail');
const normalize = (value) => value.replace(/[\s_]/g, '');
const assetName = (file) => normalize(path.posix.basename(file).replace(/^\d+_/, '').replace(/(?:_BOSS)?\.webp$/i, ''));
const assetFor = (list, name) => {
    const matches = list.filter((file) => assetName(file) === normalize(name));
    if (matches.length > 1) throw new Error(`Ambiguous asset: ${name}`);
    return matches[0];
};
const monsters = [];
let stage;
for (const line of readFileSync(path.join(root, '던전별_몬스터_추천.md'), 'utf8').split(/\r?\n/)) {
    if (line.startsWith('### ')) stage = stages.find(([name]) => name === line.slice(4));
    if (!stage || !line.startsWith('| ') || line.startsWith('| 구역')) continue;
    const [subregionName, ...cells] = line.split('|').slice(1, -1).map((cell) => cell.trim());
    const floor = subregionName.match(/^지하 (\d+)층$/);
    const subregion = floor ? `floor-${floor[1]}` : subregions[subregionName];
    if (!subregion || cells.length !== 4) throw new Error(`Invalid stage row: ${line}`);
    cells.forEach((cell, slot) => {
        const match = cell.match(/^(.+?)〔([대중소])〕—(.+)$/);
        if (!match) throw new Error(`Invalid monster: ${cell}`);
        const [, name, size, concept] = match;
        const image = assetFor(images, name), thumbnail = assetFor(thumbnails, name);
        if (!thumbnail) throw new Error(`Missing thumbnail: ${name}`);
        const number = Number(path.posix.basename(thumbnail).match(/^\d+/)[0]);
        const thumbnailSrc = `/assets/art/2D/Monster_thumnail/${thumbnail}`;
        monsters.push({ id: `MON-EXP-${String(number).padStart(4, '0')}`, name, size, concept,
            region: stage[2], location: stage[1], locationName: stage[0], subregion, subregionName,
            stageName: `${stage[0]} ${subregionName}`, isBoss: slot === 3,
            grade: slot === 3 ? 5 : size === '대' ? 4 : size === '중' ? 2 + (number % 2) : 1 + (number % 2),
            portraitSrc: image ? `/assets/art/2D/Monster/${image}` : thumbnailSrc,
            thumbnailSrc, portraitFallback: !image });
    });
}
if (monsters.length !== 168 || new Set(monsters.map((entry) => entry.id)).size !== 168) throw new Error('Expected 168 unique monsters.');

// Assign fixed, balanced quotas, reserving the strongest thematic matches first.
// Seeded tie-breaking keeps assignments stable across reloads and regeneration.
const rules = {
    element: {
        불: [/불|화약|화로|횃불|신호불|붉은도끼|파쇄/, /돌진|맹수|멧돼지|사자|도끼|엄니|갈기/],
        물: [/물|강|여울|수달|가재|거북|악어|어인|조개|치어|이무기|개구리/, /안개|이슬|젖은|진흙|석회/],
        풀: [/꽃|풀|솔|씨앗|수지|송진|나무|고목|포자|버섯|뿌리|잎|덤불|덩굴/, /토끼|산양|사슴|다람쥐|오소리/],
        빛: [/수호|백각|백|은|석상|왕실|근위|빛|기수|기사|전당/, /바람|매|독수리|그리핀|성문|경비|방패/],
        어둠: [/심연|망자|해골|유령|망령|공허|그림자|참회|간수|독방|봉인/, /도적|독|거미|박쥐|까마귀|지네|전갈|미믹/],
    },
    job: {
        기사: [/기사|근위|방패|창병|경비|문지기|수호|갑옷|갑주|성문/, /돌|갑각|거북|껍질|집게|들소/],
        전사: [/도끼|거인|거한|멧돼지|엄니|곰|거수|들소|오우거|주먹|파쇄/, /돌진|산양|갈기|장창|낫|사마귀/],
        도적: [/도적|칼잡이|곡예|살쾡이|늑대|들개|뱀|족제비|거미|정찰|덫|미믹/, /매복|기습|추적|날카로운|토끼|메뚜기/],
        사수: [/쇠뇌|투척|매|독수리|하피|그리핀|씨앗|까마귀|나방|벌|부엉|박쥐/, /가시|낙석|솔방울|갈대|멀리|바람/],
        마도사: [/사제|망령|유령|공허|그림자|음파|메아리|속삭임|봉인|마법|독방/, /불|독|슬라임|정령|안개|이슬/],
        정령사: [/요정|나무병|보행목|수호목|고목|정령|꽃가루|버섯|포자|씨앗령/, /슬라임|꽃|이끼|송진|수지|가지|숲지기/],
    },
    zodiac: {
        양자리: [/산양|뿔|고슴도치/, /돌진|엄니|멧돼지/],
        황소자리: [/들소|멧돼지|곰|거한|거수|거인/, /철|바위|돌|강한/],
        쌍둥이자리: [/곡예|도깨비|시종|미믹|잔영|그림자/, /교란|기습|날개/],
        게자리: [/게|가재|거북|집게|갑충|딱정벌레/, /방패|갑각|껍질|수호/],
        사자자리: [/사자|갈기|왕|대장|두목|장군/, /곰|엄니|맹수/],
        처녀자리: [/꽃|이끼|버섯|풀|수지|송진|솔/, /요정|정령|포자/],
        천칭자리: [/기사|근위|경비|간수|문지기|참회/, /수호|성문|석상/],
        전갈자리: [/전갈|거미|뱀|독|지네|벌|흡혈/, /가시|함정|매복/],
        사수자리: [/쇠뇌|매|독수리|그리핀|하피|정찰|사냥/, /투척|바람|날개/],
        염소자리: [/산양|산|벼랑|절벽|고산/, /바위|낙석|돌|나무/],
        물병자리: [/술사|정령|공허|봉인|음파|메아리/, /안개|바람|요정|불빛/],
        물고기자리: [/물|강|여울|수달|이무기|치어|조개/, /유령|망령|속삭임|이슬/],
    },
};
function noise(text) {
    let value = 2166136261;
    for (const letter of text) value = Math.imul(value ^ letter.codePointAt(0), 16777619);
    return (value >>> 0) / 4294967296;
}
for (const [field, preferences] of Object.entries(rules)) {
    const options = Object.keys(preferences);
    const capacity = Object.fromEntries(options.map((value, index) => [value, Math.floor(monsters.length / options.length) + (index < monsters.length % options.length ? 1 : 0)]));
    const pending = new Set(monsters);
    const score = (entry, value) => {
        const [strong, weak] = preferences[value];
        const identity = field === 'element' && value === '풀' && /풀방울|꽃|포자|나무|고목|수호목|씨앗|덩굴/.test(entry.name) ? 30 : 0;
        return identity + (strong.test(entry.name) ? 20 : 0) + (strong.test(entry.concept) ? 10 : 0)
            + (weak.test(entry.name) ? 6 : 0) + (weak.test(entry.concept) ? 3 : 0)
            + noise(`${entry.id}:${field}:${value}`);
    };
    while (pending.size) {
        let choice;
        for (const entry of pending) {
            const ranked = options.filter((value) => capacity[value] > 0).map((value) => ({ value, score: score(entry, value) })).sort((a, b) => b.score - a.score);
            const priority = ranked[0].score - (ranked[1]?.score ?? -100) + ranked[0].score / 100;
            if (!choice || priority > choice.priority) choice = { entry, value: ranked[0].value, priority };
        }
        choice.entry[field] = choice.value;
        capacity[choice.value] -= 1;
        pending.delete(choice.entry);
    }
}
mkdirSync(path.join(root, 'data/monsters'), { recursive: true });
writeFileSync(path.join(root, 'data/monsters/expedition-monsters.json'), `${JSON.stringify(monsters, null, 2)}\n`);
console.log(`Registered ${monsters.length} monsters in ${new Set(monsters.map((entry) => entry.stageName)).size} stages.`);
for (const field of Object.keys(rules)) console.log(field, Object.fromEntries(Object.keys(rules[field]).map((value) => [value, monsters.filter((entry) => entry[field] === value).length])));
for (const entry of monsters.filter((entry) => entry.portraitFallback)) console.warn(`Portrait missing; using thumbnail: ${entry.stageName} / ${entry.name}`);
