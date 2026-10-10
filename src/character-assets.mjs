import imageFiles from '../data/characters/image-files.json' with { type: 'json' };

// Extra art can be selected in the editor without reshuffling existing characters.
export const characterPortraitFiles = Object.freeze([...imageFiles, '0138_F_H.webp']);

export function characterPortraitAsset(file) {
    const revisions = {
        '0138_F_H.webp': '20261010-173918',
        '0000_M_W.webp': '20261010-173957',
    };
    return `/assets/art/2D/Character/${file}${revisions[file] ? `?v=${revisions[file]}` : ''}`;
}

export function characterThumbnailAsset(file) {
    const updated = {
        '0138_F_H.webp': '138_F_H.webp?v=20261010-173627',
        '0000_M_W.webp': '0000_M_W.webp?v=20261010-173646',
    };
    return `/assets/art/2D/Character_thumnail/${updated[file] || file}`;
}

export const playerThumbnailAsset = characterThumbnailAsset('0000_M_W.webp');

// Keep the original 124 image assignments stable for existing character IDs.
const legacyCharacterPortraitFiles = [
    '0001_M_N.webp', '0002_M_A.webp', '0003_M_T.webp', '0004_M_T.webp', '0005_M_H.webp',
    '0006_M_N.webp', '0007_M_N.webp', '0008_M_A.webp', '0009_M_N.webp', '0010_M_H.webp',
    '0011_M_M.webp', '0012_M_M.webp', '0013_M_W.webp', '0014_M_W.webp', '0015_M_N.webp',
    '0016_M_A.webp', '0017_M_M.webp', '0018_M_N.webp', '0019_M_A.webp', '0020_M_W.webp',
    '0021_M_M.webp', '0022_M_T.webp', '0023_M_W.webp', '0024_M_T.webp', '0025_M_W.webp',
    '0026_M_A.webp', '0027_M_W.webp', '0028_M_T.webp', '0029_M_N.webp', '0030_M_A.webp',
    '0031_M_N.webp', '0032_M_W.webp', '0033_M_H.webp', '0034_M_H.webp', '0035_M_M.webp',
    '0036_M_M.webp', '0037_M_W.webp', '0038_M_M.webp', '0039_M_H.webp', '0040_M_M.webp',
    '0041_M_W.webp', '0042_M_A.webp', '0043_M_A.webp', '0044_M_W.webp', '0045_M_N.webp',
    '0046_M_W.webp', '0047_M_M.webp', '0048_M_N.webp', '0049_M_H.webp', '0050_M_H.webp',
    '0051_M_W.webp', '0052_M_A.webp', '0053_M_N.webp', '0054_M_M.webp', '0055_M_H.webp',
    '0056_M_W.webp', '0057_M_A.webp', '0058_M_H.webp', '0059_M_W.webp', '0060_M_A.webp',
    '0061_M_H.webp', '0062_M_T.webp', '0063_M_A.webp', '0064_M_A.webp', '0065_M_A.webp',
    '0066_M_H.webp', '0067_M_M.webp', '0068_M_A.webp', '0069_M_T.webp', '0070_M_N.webp',
    '0071_M_T.webp', '0072_M_W.webp', '0073_M_W.webp', '0074_M_T.webp', '0075_M_M.webp',
    '0076_M_T.webp', '0077_M_N.webp', '0078_M_W.webp', '0079_M_W.webp', '0080_M_H.webp',
    '0081_M_W.webp', '0082_M_H.webp', '0083_M_A.webp', '0084_M_M.webp', '0085_M_W.webp',
    '0086_M_M.webp', '0087_M_T.webp', '0088_M_A.webp', '0089_M_H.webp', '0090_M_M.webp',
    '0091_M_N.webp', '0092_M_M.webp', '0093_M_W.webp', '0094_M_H.webp', '0095_M_N.webp',
    '0096_M_H.webp', '0097_M_M.webp', '0098_M_A.webp', '0099_M_H.webp', '0100_M_N.webp',
    '0101_M_T.webp', '0102_M_H.webp', '0103_M_W.webp', '0104_M_M.webp', '0105_M_A.webp',
    '0106_M_W.webp', '0107_M_N.webp', '0108_M_W.webp', '0109_M_A.webp', '0110_M_H.webp',
    '0111_M_H.webp', '0112_M_M.webp', '0113_M_N.webp', '0114_M_N.webp', '0115_M_M.webp',
    '0116_M_M.webp', '0117_M_W.webp', '0118_M_T.webp', '0119_M_T.webp', '0120_M_M.webp',
    '0121_M_W.webp', '0122_M_W.webp', '0123_M_H.webp', '0124_M_A.webp',
];

function createSeededRandom(seed) {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6D2B79F5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function shuffleWithSeed(items, random) {
    const shuffled = [...items];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(random() * (index + 1));
        [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }
    return shuffled;
}

export function buildCharacterPortraitFileAssignments(characters) {
    const random = createSeededRandom(20240501);
    const legacyCharacters = characters.filter((character) => Number(character.id.slice(5)) <= 200);
    const shuffledCharacters = shuffleWithSeed(legacyCharacters, random);
    const shuffledFiles = shuffleWithSeed(legacyCharacterPortraitFiles, random);
    const assignments = {};
    shuffledCharacters.forEach((character, index) => {
        if (index < shuffledFiles.length) assignments[character.id] = shuffledFiles[index];
    });
    const usedFiles = new Set(Object.values(assignments));
    const availableFiles = shuffleWithSeed(imageFiles.filter((file) => !usedFiles.has(file)), random);
    const unassignedCharacters = shuffleWithSeed(characters.filter((character) => !assignments[character.id]), random);
    if (availableFiles.length < unassignedCharacters.length) throw new Error('Not enough unique character image pairs.');
    unassignedCharacters.forEach((character, index) => {
        assignments[character.id] = availableFiles[index];
    });
    return assignments;
}

