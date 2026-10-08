// Saves a downloaded coverage workbook as the dashboard's fallback copy.
// Usage: node scripts/save-coverage-copy.mjs ~/Downloads/vectorcam-coverage.xlsx
import { readFile, writeFile } from 'node:fs/promises';

const [source] = process.argv.slice(2);
if (!source) {
    console.error('Usage: node scripts/save-coverage-copy.mjs <workbook.xlsx>');
    process.exit(1);
}

const workbook = await readFile(source);
// An .xlsx is a zip; anything else (an HTML sign-in page) is refused.
if (workbook.subarray(0, 2).toString() !== 'PK') {
    console.error(`${source} is not an .xlsx workbook`);
    process.exit(1);
}

const target = new URL(
    '../src/api/coverage/coverage-saved-copy.json',
    import.meta.url,
);
await writeFile(
    target,
    JSON.stringify(
        { savedAt: Date.now(), workbook: workbook.toString('base64') },
        null,
        4,
    ) + '\n',
);
console.log(`Saved ${source} as the fallback copy`);
