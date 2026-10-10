let runtimeData;
const workbookLoads = new Map();

async function productionData() {
    runtimeData ||= fetch(__GAME_DATA_URL__).then(response => {
        if (!response.ok) throw new Error(`Game data returned ${response.status}`);
        return response.json();
    });
    return runtimeData;
}

async function developmentWorkbook(path) {
    if (!workbookLoads.has(path)) workbookLoads.set(path, (async () => {
        const [XLSX, response] = await Promise.all([import('xlsx'), fetch(path, { cache: 'no-store' })]);
        if (!response.ok) throw new Error(`${path} returned ${response.status}`);
        return { XLSX, workbook: XLSX.read(await response.arrayBuffer(), { type: 'array' }) };
    })());
    return workbookLoads.get(path);
}

export async function readDefaultSkillRows() {
    if (import.meta.env.PROD) return (await productionData()).skillRows;
    for (const filename of ['skills-editable.xlsx', 'skills.xlsx']) {
        try {
            const { XLSX, workbook } = await developmentWorkbook(`/data/${filename}`);
            const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' });
            if (rows.length === 4 && rows.every(row => row.id && row.name)) return rows;
        } catch (error) { console.warn(`${filename} could not be loaded.`, error); }
    }
    return [];
}

export async function readCatalogTable(filename, sheetName, headerIndex) {
    let table;
    if (import.meta.env.PROD) {
        table = (await productionData()).tables[JSON.stringify([filename, sheetName, headerIndex])];
        if (!table) throw new Error(`Missing table: ${filename}/${sheetName}`);
    } else {
        const { XLSX, workbook } = await developmentWorkbook(`/data/import/${filename}`);
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) throw new Error(`${filename} is missing the ${sheetName} sheet`);
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: false });
        table = { headers: rows[headerIndex] || [], rows: rows.slice(headerIndex + 1).filter(row => row.some(value => value !== '' && value != null)) };
    }
    return table.rows.map(row => Object.fromEntries(table.headers.map((header, index) => [header, row[index] ?? ''])));
}
