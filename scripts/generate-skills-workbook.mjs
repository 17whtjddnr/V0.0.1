import { writeFile, mkdir } from 'node:fs/promises';
import * as XLSX from 'xlsx';

const rows = [
    { id: 'strike', name: '무기 공격', icon: '⚔', target: 'enemy', damageCoefficient: 0.85, healAttackCoefficient: '', healMaxHpCoefficient: '', stressRecovery: '', effect1Type: '', effect1Chance: '', effect1Turns: '', effect1Value: '', effect2Type: '', effect2Chance: '', effect2Turns: '', effect2Value: '', effect3Type: '', effect3Chance: '', effect3Turns: '', effect3Value: '', effect4Type: '', effect4Chance: '', effect4Turns: '', effect4Value: '', cooldown: 0, description: '선택한 적에게 기본 피해를 줍니다.' },
    { id: 'power', name: '방패 강타', icon: '✦', target: 'enemy', damageCoefficient: 1.45, healAttackCoefficient: '', healMaxHpCoefficient: '', stressRecovery: '', effect1Type: 'stun', effect1Chance: 30, effect1Turns: 1, effect1Value: '', effect2Type: '', effect2Chance: '', effect2Turns: '', effect2Value: '', effect3Type: '', effect3Chance: '', effect3Turns: '', effect3Value: '', effect4Type: '', effect4Chance: '', effect4Turns: '', effect4Value: '', cooldown: 2, description: '30% 확률로 적을 1턴간 기절시킵니다.' },
    { id: 'recover', name: '전열 정비', icon: '✚', target: 'ally', damageCoefficient: '', healAttackCoefficient: 1, healMaxHpCoefficient: 0.06, stressRecovery: '', effect1Type: '', effect1Chance: '', effect1Turns: '', effect1Value: '', effect2Type: '', effect2Chance: '', effect2Turns: '', effect2Value: '', effect3Type: '', effect3Chance: '', effect3Turns: '', effect3Value: '', effect4Type: '', effect4Chance: '', effect4Turns: '', effect4Value: '', cooldown: 2, description: '선택한 아군을 회복합니다.' },
    { id: 'resolve', name: '정신 집중', icon: '◈', target: 'self', damageCoefficient: '', healAttackCoefficient: '', healMaxHpCoefficient: '', stressRecovery: 18, effect1Type: 'attackUp', effect1Chance: 100, effect1Turns: 1, effect1Value: 0.2, effect2Type: '', effect2Chance: '', effect2Turns: '', effect2Value: '', effect3Type: '', effect3Chance: '', effect3Turns: '', effect3Value: '', effect4Type: '', effect4Chance: '', effect4Turns: '', effect4Value: '', cooldown: 3, description: '스트레스를 낮추고 1턴간 공격력을 높입니다.' },
];

const workbook = XLSX.utils.book_new();
const sheet = XLSX.utils.json_to_sheet(rows);
sheet['!cols'] = [
    { wch: 14 }, { wch: 16 }, { wch: 8 }, { wch: 12 }, { wch: 18 }, { wch: 22 },
    { wch: 20 }, { wch: 16 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 42 },
];
XLSX.utils.book_append_sheet(workbook, sheet, 'Skills');
await mkdir('public/data', { recursive: true });
await writeFile('public/data/skills-editable.xlsx', XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
console.log('Generated public/data/skills-editable.xlsx');
