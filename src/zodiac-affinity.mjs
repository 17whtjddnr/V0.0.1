export const zodiacNames = [
    '양자리', '황소자리', '쌍둥이자리', '게자리', '사자자리', '처녀자리',
    '천칭자리', '전갈자리', '사수자리', '염소자리', '물병자리', '물고기자리',
];

export const zodiacGlyphs = {
    양자리: '♈', 황소자리: '♉', 쌍둥이자리: '♊', 게자리: '♋', 사자자리: '♌', 처녀자리: '♍',
    천칭자리: '♎', 전갈자리: '♏', 사수자리: '♐', 염소자리: '♑', 물병자리: '♒', 물고기자리: '♓',
};

export const zodiacAffinityValues = { veryGood: 40, good: 30, normal: 20, bad: 10, veryBad: 0 };

const roundTiers = ['veryGood', 'good', 'good', 'normal', 'normal', 'normal', 'normal', 'bad', 'bad', 'bad', 'veryBad'];
const compatibilityTiers = Object.fromEntries(zodiacNames.map((zodiac) => [zodiac, {}]));
let rotation = [...zodiacNames];

for (let round = 0; round < zodiacNames.length - 1; round += 1) {
    const points = zodiacAffinityValues[roundTiers[round]];
    for (let pairIndex = 0; pairIndex < zodiacNames.length / 2; pairIndex += 1) {
        const first = rotation[pairIndex];
        const second = rotation[zodiacNames.length - 1 - pairIndex];
        compatibilityTiers[first][second] = points;
        compatibilityTiers[second][first] = points;
    }
    rotation = [rotation[0], rotation[rotation.length - 1], ...rotation.slice(1, -1)];
}

zodiacNames.forEach((zodiac) => {
    compatibilityTiers[zodiac][zodiac] = zodiacAffinityValues.normal;
});

export const zodiacCompatibility = compatibilityTiers;

export function initialAffinityFor(playerZodiac, characterZodiac) {
    return zodiacCompatibility[playerZodiac]?.[characterZodiac] ?? zodiacAffinityValues.veryBad;
}
