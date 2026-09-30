import { writeFile, mkdir } from 'node:fs/promises';
import * as XLSX from 'xlsx';

const rows = [
    { id: 'reynold', name: '레이놀드', title: '성전사', element: '화염', job: '기사', mark: '✠', color: 'red', attack: 980, defense: 720, maxHp: 12800, critChance: 15, critDamage: 150, effectHit: 15, effectResist: 20, speed: 102 },
    { id: 'dismas', name: '디스마스', title: '노상강도', element: '암속성', job: '사수', mark: '♜', color: 'gold', attack: 1140, defense: 590, maxHp: 9800, critChance: 27, critDamage: 165, effectHit: 20, effectResist: 10, speed: 118 },
    { id: 'vestal', name: '베스탈', title: '성녀', element: '광속성', job: '정령사', mark: '☼', color: 'ivory', attack: 840, defense: 800, maxHp: 10800, critChance: 15, critDamage: 150, effectHit: 10, effectResist: 30, speed: 98 },
    { id: 'paracelsus', name: '파라셀수스', title: '역병 의사', element: '자연', job: '마도사', mark: '☣', color: 'green', attack: 1060, defense: 650, maxHp: 9300, critChance: 18, critDamage: 155, effectHit: 35, effectResist: 15, speed: 112 },
];

const workbook = XLSX.utils.book_new();
const sheet = XLSX.utils.json_to_sheet(rows);
sheet['!cols'] = [{ wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 8 }, { wch: 10 }, ...Array.from({ length: 8 }, () => ({ wch: 16 }))];
XLSX.utils.book_append_sheet(workbook, sheet, 'CharacterStats');
await mkdir('public/data', { recursive: true });
await writeFile('public/data/character-stats-editable.xlsx', XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
console.log('Generated public/data/character-stats-editable.xlsx');