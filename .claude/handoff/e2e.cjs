// Usage: node .claude/handoff/e2e.cjs <dir with state.json>; needs `yarn dev` on :3000.
const { chromium } = require('/Users/colemanel/Documents/CBID/vector-verify/node_modules/playwright');
const S = process.argv[2];
const BASE = 'http://localhost:3000';
const results = [];
const check = (name, ok, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
const shot = (page, name) => page.screenshot({ path: `${S}/shots/p-${name}.png` });
const params = page => Object.fromEntries(new URL(page.url()).searchParams);
const summary = page => page.getByRole('heading', { name: /^Summary,/ });
const ready = page => summary(page).waitFor({ timeout: 300000 });
const NOV = `${BASE}/?range=custom&from=2025-11&to=2025-11`;

(async () => {
    const browser = await chromium.launch();
    const context = await browser.newContext({ storageState: `${S}/state.json`, viewport: { width: 1440, height: 900 } });
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => m.type() === 'error' && errors.push('console: ' + m.text().slice(0, 200)));
    const step = async (name, fn) => { try { await fn(); } catch (e) { check(name, false, e.message.split('\n')[0]); } };

    await step('default', async () => {
        await page.goto(BASE); await ready(page); await page.waitForTimeout(2000);
        check('default period is last month', (await summary(page).textContent()).includes('August 2026'), await summary(page).textContent());
        check('map heading follows the period', (await page.getByRole('heading', { name: /^Collection,/ }).textContent()).includes('August 2026'));
        check('no month picker or map period switch', (await page.getByRole('button', { name: 'Summary month' }).count()) === 0 && (await page.getByText('Whole range').count()) === 0);
        check('no trends section', (await page.getByRole('heading', { name: 'Trends' }).count()) === 0);
        await shot(page, '01-default');
    });

    await step('presets', async () => {
        await page.getByRole('radio', { name: '12M' }).click();
        await ready(page); await page.waitForTimeout(2000);
        const heading = await summary(page).textContent();
        check('12M shows a 12-month period everywhere', /Oct 2025 – Sep 2026/.test(heading) && (await page.getByRole('heading', { name: /^Collection,/ }).textContent()).includes('Oct 2025'), heading);
        check('12M map has points', (await page.locator('.leaflet-marker-icon').count()) > 0);
        const kpiDelta = await page.getByText(/vs previous 12 months/).first().isVisible().catch(() => false);
        check('KPI compares with previous 12 months', kpiDelta);
        await shot(page, '02-12m');
        await page.getByRole('radio', { name: 'All' }).click();
        await ready(page); await page.waitForTimeout(2000);
        check('All has no comparison', (await page.getByText(/vs /).count()) === 0);
        check('All map has points', (await page.locator('.leaflet-marker-icon').count()) > 0);
        await page.getByRole('radio', { name: 'Last month' }).click();
        await page.waitForTimeout(500);
        check('Last month (default) clears range', !('range' in params(page)), JSON.stringify(params(page)));
    });

    await step('custom single month', async () => {
        await page.goto(NOV); await ready(page); await page.waitForTimeout(2500);
        check('custom month heading', (await summary(page).textContent()).includes('November 2025'));
        check('single month compares with Oct', await page.getByText(/vs Oct/).first().isVisible());
        const rows = (await page.evaluate(() => navigator.clipboard.readText().catch(() => ''))) ;
        await page.locator('.leaflet-marker-icon:has(span[style*="9999px"])').first().click(); await page.waitForTimeout(1200);
        check('cluster click lists Sessions', /\d+ Session/.test(await page.getByText(/^\d+ Sessions?$/).first().textContent().catch(() => '')));
        const deviceLine = await page.getByText(/registered · \d+ active/).textContent().catch(() => '');
        check('both layers on by default', !!deviceLine && (await page.getByText(/placed by GPS/).count()) > 0, deviceLine);
        await shot(page, '03-both-layers');
    });

    await step('custom range pickers', async () => {
        await page.getByRole('radio', { name: 'Custom' }).isVisible();
        await page.getByRole('button', { name: 'From' }).click();
        await page.getByRole('button', { name: 'Sep', exact: true }).click();
        await ready(page); await page.waitForTimeout(1500);
        check('From picker widens the period', params(page).from === '2025-09' && (await summary(page).textContent()).includes('Sep 2025 – Nov 2025'), JSON.stringify(params(page)));
    });

    await step('summary interactions', async () => {
        await page.getByRole('button', { name: /Show field completeness for National Malaria/ }).click();
        check('expand shows field completeness', await page.getByText('Field completeness').isVisible());
        await page.getByRole('button', { name: 'Copy for Excel' }).click(); await page.waitForTimeout(400);
        const text = await page.evaluate(() => navigator.clipboard.readText());
        check('copy header names the period', text.split('\n')[0].includes('Sep 2025 – Nov 2025'), text.split('\n')[0].slice(0, 60));
        await page.getByRole('button', { name: 'National Malaria Elimination Division', exact: true }).click();
        await page.getByText(/not yet certified/).waitFor({ timeout: 120000 });
        const title = await page.getByRole('dialog').getByRole('heading').first().textContent();
        check('Session panel covers the period', title.includes('Sep 2025 – Nov 2025'), title);
        await page.waitForTimeout(800);
        await shot(page, '04-sessions');
        await page.keyboard.press('Escape'); await page.waitForTimeout(400);
        check('closing panel clears URL', !('sessions' in params(page)));
    });

    await step('program filter', async () => {
        await page.getByRole('button', { name: /of 7 programs/ }).click();
        await page.getByRole('checkbox').nth(1).click();
        await page.keyboard.press('Escape'); await ready(page); await page.waitForTimeout(1500);
        check('exclude written to URL', (params(page).exclude ?? '').includes('8'), JSON.stringify(params(page)));
    });

    await step('cycles stay compact', async () => {
        await page.goto(`${BASE}/?range=all`); await ready(page); await page.waitForTimeout(1500);
        const note = await page.getByText(/^Cycles? /).first().textContent().catch(() => '');
        check('All shows a cycle span, not every number', note.length < 40, note);
        await summary(page).scrollIntoViewIfNeeded(); await page.mouse.wheel(0, 250); await page.waitForTimeout(400);
        await shot(page, '06-cycles-all');
    });

    await step('mobile', async () => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto(NOV); await ready(page); await page.waitForTimeout(1500);
        check('no horizontal scroll on phone', (await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0);
        await shot(page, '05-mobile');
    });

    console.log(results.join('\n'));
    console.log('console/page errors:', errors.length, JSON.stringify([...new Set(errors)].slice(0, 6), null, 1));
    await browser.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
