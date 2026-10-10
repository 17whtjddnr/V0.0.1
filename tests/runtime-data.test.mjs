import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import XLSX from 'xlsx';
import { buildRuntimeData, catalogTables, tableKey } from '../scripts/runtime-data.mjs';

test('production data preserves every workbook value used by combat and growth', () => {
    const root = new URL('../public/data/', import.meta.url);
    const data = buildRuntimeData(root);
    for (const [filename, name, headerIndex] of catalogTables) {
        const workbook = XLSX.read(readFileSync(new URL(`import/${filename}`, root)), { type: 'buffer' });
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, defval: '', blankrows: false });
        const expected = rows.slice(headerIndex + 1).filter(row => row.some(value => value !== '' && value != null))
            .map(row => Object.fromEntries(rows[headerIndex].map((key, index) => [key, row[index] ?? ''])));
        const table = JSON.parse(JSON.stringify(data)).tables[tableKey(filename, name, headerIndex)];
        const actual = table.rows.map(row => Object.fromEntries(table.headers.map((key, index) => [key, row[index] ?? ''])));
        assert.deepEqual(actual, expected, name);
    }
    const skills = XLSX.read(readFileSync(new URL('skills-editable.xlsx', root)), { type: 'buffer' });
    assert.deepEqual(data.skillRows, XLSX.utils.sheet_to_json(skills.Sheets[skills.SheetNames[0]], { defval: '' }));
});
