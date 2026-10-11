import { buildCharacterPortraitFileAssignments, characterPortraitFiles, additionalCharacters, BASE_CHARACTER_COUNT } from './character-assets.mjs';

export const imageJobs = Object.freeze({ N: '기사', W: '전사', M: '마도사', T: '도적', A: '사수', H: '정령사' });
const exemptIds = new Set(['CHAR-246', 'CHAR-208']);
export const storyCompanionNames = Object.freeze({ 'CHAR-STORY-LORA': '윌로우', 'CHAR-STORY-LYSIA': '비올라' });
export const storyCompanionIds = Object.freeze({ lora: 'CHAR-112', lysia: 'CHAR-111' });
export const legacyStoryCharacterIds = Object.freeze({ 'CHAR-STORY-LORA': storyCompanionIds.lora, 'CHAR-STORY-LYSIA': storyCompanionIds.lysia });
const femaleNames = `아델리아 엘리시아 클로에 레티시아 비올라 에스텔 루시아 이사벨 셀린 카밀라
아리아 베로니카 이벨린 플로라 에밀리아 로잘린 오필리아 실비아 아멜리아 엘레나
다프네 유리아 소피아 비비안 샤를로트 릴리아 크리스티나 마리엘 아나스타샤 티아나
에블린 레오나 루미나 아스트리아 네리아 엘로디 베아트리스 지젤 프리실라 나탈리아
미라벨 카탈리나 엘리제 로웨나 세실리아 아우렐리아 아델라인 이졸데 코델리아 발레리아
줄리엣 헬레나 로제타 멜리사 디아나 이리나 아나벨 오데트 클라리스 페넬로페
레이나 아리엘 리디아 니콜레타 테레사 엘리노어 마틸다 베르타 윌로우 에리카
셀레스트 라비니아 피오나 에일라 브리엘 카산드라 알테아 모르가나 네리사 베스페라
유스티나 아델린 이베트 루실 도로테아 엘비라 사비나 카리나 미레나 에우제니아
비앙카 레티아 마르셀라 이리스 올리비아 델리아 리아나 베니타 세라피나 레베카
오리아나 미네르바 아벨리아 레오니아 카렌 아네트 에바 아그네스 베아트릭스 시에나
라일라 니나 노엘리아 루이자 이본느 마리에타 클레멘타인 프레야 엘프리데 아델하이트
로렐라이 힐다 그레타 엘사 로미나 데보라 다니엘라 라파엘라 가브리엘라 페트라
레지나 알리시아 에스메 카야 브리짓 카밀레 아말리아 요하나 아드리아나 탈리아
엘리안느 루네아 칼리스타 에우도라 테오도라 벨린다 파울리나 미리암 사샤 리젤`.split(/\s+/);
const maleNames = `레온 아드리안 루카스 테오도르 펠릭스 에드윈 오스카 실반 알렉산더 율리안
카일 에릭 가브리엘 라파엘 빈센트 세드릭 로웰 휴고 로데릭 알베르트
데미안 니콜라스 세바스찬 올리버 아서 트리스탄 에드먼드 알프레드 베네딕트 카스파르
라이너 디트리히 하인리히 지그문트 발터 콘라트 루돌프 볼프강 프리드리히 오토
기욤 루시앙 에티엔 마르셀 로랑 클로드 아르망 가스통 파비앙 마티외
알렉시오 도미니크 레오폴트 마그누스 다리우스 레미 알리스터 던컨 가레스톤 키어런
로난 핀리 에이든 브렌던 코너 패트릭 데클런 케빈 숀 리암
노아 엘리엇 에단 네이선 사이먼 토비아스 요한 마르틴 다니엘 미하엘
사무엘 벤자민 조슈아 이삭 아벨 엘리아스 나다니엘 실라스 에즈라 말라키
레오나르도 로렌조 마테오 루치오 줄리오 엔리코 안젤로 세르지오 파올로 비토
로드리고 페르난도 알론소 디에고 에스테반 이그나시오 살바도르 라미로 곤살로 카를로스
에밀 빅토르 이반 드미트리 니키타 보리스 안톤 미로슬라프 카지미르 스타니스
루퍼스 레지널드 퍼시벌 고드윈 발렌틴 플로리안 유진 티모시 스테판 암브로스`.split(/\s+/);

export function characterImageMetadata(source = '') {
    const file = source.split('/').pop().split('?')[0];
    const added = additionalCharacters.find(character => character.portraitFile === file);
    if (added) return { file, gender: added.gender, job: added.job };
    const match = file.match(/^\d+_([FM])_([NWMTAH])\.webp$/i);
    if (match) return { file, gender: match[1].toUpperCase(), job: imageJobs[match[2].toUpperCase()] };
    // These original assets predate the filename convention; keep their image assignments.
    if (file === '0126_T.webp') return { file, gender: 'F', job: imageJobs.T };
    if (file === '0137_Shop.webp') return { file, gender: 'F', job: null };
    return null;
}

const namesByFile = new Map();
for (const [gender, names] of [['F', femaleNames], ['M', maleNames]]) {
    const files = characterPortraitFiles.filter(file => characterImageMetadata(file)?.gender === gender).sort();
    if (files.length > names.length || new Set(names).size !== names.length) throw new Error('캐릭터 이름 목록이 부족하거나 중복됩니다.');
    files.forEach((file, index) => namesByFile.set(file, names[index]));
}
additionalCharacters.forEach(character => namesByFile.set(character.portraitFile, character.name));

// The same full ID list is used at every level, keeping all existing image assignments stable.
export const characterIdentityPortraits = Object.freeze(buildCharacterPortraitFileAssignments(
    [...Array.from({ length: BASE_CHARACTER_COUNT }, (_, index) => ({ id: `CHAR-${String(index + 1).padStart(3, '0')}` })), ...additionalCharacters],
));

export function characterIdentity(entry) {
    if (exemptIds.has(entry.id) || entry.isMaster) return null;
    const metadata = characterImageMetadata(entry.portraitSrc || characterIdentityPortraits[entry.id] || entry.thumbnailSrc);
    if (!metadata) return storyCompanionNames[entry.id]
        ? { name: storyCompanionNames[entry.id], gender: entry.gender, job: entry.job } : null;
    return { name: storyCompanionNames[entry.id] || (entry.storyCompanion ? entry.name.split(/\s+/).at(-1) : namesByFile.get(metadata.file)),
        gender: metadata.gender, job: metadata.job || entry.job };
}
