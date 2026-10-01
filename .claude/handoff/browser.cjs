/* eslint-disable @typescript-eslint/no-require-imports */
// Opens one visible, dark-mode Chromium on /login and keeps it open with a
// DevTools port, so the user logs in once and check scripts attach to it:
//
//   node .claude/handoff/browser.cjs <scratch dir>        (run in background)
//   const browser = await chromium.connectOverCDP('http://localhost:9333');
//   const page = await browser.contexts()[0].newPage();   (close it after)
//
// The login lives in <scratch dir>/profile; delete that folder when done.
const { chromium } = require('../../../vector-verify/node_modules/playwright');

const dir = process.argv[2];
if (!dir) {
    console.error('Usage: node .claude/handoff/browser.cjs <scratch dir>');
    process.exit(1);
}

(async () => {
    const context = await chromium.launchPersistentContext(`${dir}/profile`, {
        headless: false,
        colorScheme: 'dark',
        viewport: null,
        args: ['--remote-debugging-port=9333', '--window-size=1400,950'],
    });
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto('http://localhost:3000/login');
    console.log('open on :9333');
    context.on('close', () => process.exit(0));
})().catch(error => {
    console.error(error);
    process.exit(1);
});
