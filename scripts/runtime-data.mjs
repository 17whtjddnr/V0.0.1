import { readFileSync } from 'node:fs';
import XLSX from 'xlsx';

export const catalogTables = [
    ['Skill_List_2000.xlsx', '스킬 2000종', 4],
    ['Skill_List_2000.xlsx', '효과 규칙 55종', 2],
    ['Skill_Effects_55.xlsx', '스킬효과 목록', 3],
    ['Zodiac_Stats_Merged.xlsx', '기준스탯 72종', 5],
    ['Zodiac_Stats_Merged.xlsx', '성장분해', 5],
];

export function tableKey(filename, sheetName, headerIndex) {
    return JSON.stringify([filename, sheetName, headerIndex]);
}

export function buildRuntimeData(root) {
    const workbooks = new Map();
    const read = path => {
        if (!workbooks.has(path)) workbooks.set(path, XLSX.read(readFileSync(new URL(path, root)), { type: 'buffer' }));
        return workbooks.get(path);
    };
    const tables = {};
    for (const [filename, sheetName, headerIndex] of catalogTables) {
        const sheet = read(`import/${filename}`).Sheets[sheetName];
        if (!sheet) throw new Error(`Missing sheet: ${filename}/${sheetName}`);
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: false });
        // Store column names once instead of repeating them for all 2,000 skills.
        tables[tableKey(filename, sheetName, headerIndex)] = { headers: rows[headerIndex], rows: rows.slice(headerIndex + 1).filter(row => row.some(value => value !== '' && value != null)) };
    }
    let skillRows;
    for (const filename of ['skills-editable.xlsx', 'skills.xlsx']) {
        try {
            const workbook = read(filename);
            const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' });
            if (rows.length === 4 && rows.every(row => row.id && row.name)) { skillRows = rows; break; }
        } catch { /* The next workbook supplies the same fallback as the client. */ }
    }
    if (!skillRows) throw new Error('No valid default skill workbook.');
    return { skillRows, tables };
}
