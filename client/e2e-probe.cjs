// One-off E2E probe: reproduce the New Task modal flow in real Chrome and
// capture exactly what the user sees (console errors, network failures,
// on-screen validation messages). Not part of the test suite.
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = 'http://localhost:5173';
const EMAIL = 'skyji1512@gmail.com';
const PASSWORD = 'Sandeep@123';
const ART = path.join(__dirname, 'e2e-artifacts');
const browserLog = [];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function clickByText(page, selector, text) {
  const ok = await page.evaluate((sel, t) => {
    const els = [...document.querySelectorAll(sel)];
    const el = els.find((e) => e.textContent.trim().includes(t));
    if (el) { el.click(); return true; }
    return false;
  }, selector, text);
  if (!ok) throw new Error(`No ${selector} with text "${text}"`);
}

async function visibleTexts(page, selector) {
  return page.evaluate((sel) => [...document.querySelectorAll(sel)].map((e) => e.textContent.trim()).filter(Boolean), selector);
}

async function dumpState(page, tag, log) {
  const reds = await visibleTexts(page, '.text-red-600');
  const body = await page.evaluate(() => document.body.innerText.slice(0, 1500));
  log.push(`\n===== ${tag} =====`);
  log.push('Field errors (.text-red-600): ' + JSON.stringify(reds));
  log.push('BODY SNIPPET: ' + body.replace(/\n+/g, ' | ').slice(0, 600));
  await page.screenshot({ path: path.join(ART, `${tag}.png`) });
  return { tag, reds };
}

async function tagSelects(page) {
  // Tag selects inside the dialog in DOM order: [type, priority, (assignee)]
  return page.evaluate(() => {
    const selects = [...document.querySelectorAll('[role="dialog"] select')];
    selects.forEach((s, i) => s.setAttribute('data-e2e', `sel${i}`));
    return selects.map((s) => ({
      e2e: s.getAttribute('data-e2e'),
      value: s.value,
      options: [...s.options].map((o) => o.textContent.trim()).slice(0, 6),
    }));
  });
}

async function runScenario(page, browserLog, scenario) {
  const { name, type, useAssignee, priority } = scenario;
  // Open modal fresh
  await clickByText(page, 'button', 'New Task');
  await page.waitForSelector('[role="dialog"] input[placeholder="What needs to be done?"]', { timeout: 8000 });
  await page.type('[role="dialog"] input[placeholder="What needs to be done?"]', `E2E ${name} ${Date.now() % 10000}`);

  const before = await tagSelects(page);
  browserLog.push(`[${name}] selects before: ${JSON.stringify(before)}`);

  await page.select('[data-e2e="sel0"]', type);
  if (useAssignee) {
    await page.waitForFunction(() => document.querySelectorAll('[role="dialog"] select').length >= 3, { timeout: 8000 });
    await tagSelects(page);
    const val = await page.evaluate(() => {
      const s = [...document.querySelectorAll('[role="dialog"] select')][2];
      const opt = [...s.options].find((o) => o.textContent.includes('Dr. Singh'));
      return opt ? opt.value : null;
    });
    browserLog.push(`[${name}] Dr. Singh option value: ${val}`);
    if (!val) { await dumpState(page, `${name}-no-assignee`, browserLog); return { name, failed: true, why: 'Dr. Singh not in dropdown' }; }
    await page.select('[data-e2e="sel2"]', val);
  }
  await page.select('[data-e2e="sel1"]', priority);

  await page.screenshot({ path: path.join(ART, `${name}-filled.png`) });
  await clickByText(page, '[role="dialog"] button', 'Create task');
  await sleep(3500);

  const modalStillOpen = await page.evaluate(() => !!document.querySelector('[role="dialog"]'));
  const state = await dumpState(page, name, browserLog);
  browserLog.push(`[${name}] modal still open after submit: ${modalStillOpen}`);
  return { name, failed: modalStillOpen, fieldErrors: state.reds };
}

(async () => {
  fs.mkdirSync(ART, { recursive: true });
  const consoleErrors = [];
  const failedRequests = [];

  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300)); });
  page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + String(e).slice(0, 300)));
  page.on('response', async (res) => {
    if (res.status() >= 400 && res.url().includes('/api/')) {
      let body = '';
      try { body = (await res.text()).slice(0, 200); } catch {}
      failedRequests.push(`${res.status()} ${res.request().method()} ${res.url()} -> ${body}`);
    }
  });

  // Login
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 30000 });
  browserLog.push('GOTO OK, url=' + page.url());
  await page.screenshot({ path: path.join(ART, '00-landing.png') });
  const hasEmailInput = await page.$('input[type="email"]');
  browserLog.push('email input present: ' + !!hasEmailInput);
  await page.waitForSelector('input[type="email"]', { timeout: 15000 });
  await page.type('input[type="email"]', EMAIL);
  await page.type('input[type="password"]', PASSWORD);
  await Promise.all([
    page.waitForResponse((r) => r.url().includes('/auth/') && r.request().method() === 'POST', { timeout: 15000 }).then((r) => browserLog.push('login API status: ' + r.status())).catch(() => browserLog.push('login API: NO RESPONSE SEEN')),
    page.click('button[type="submit"]'),
  ]);
  await page.screenshot({ path: path.join(ART, '01-after-login.png') });
  await page.waitForFunction(() => !window.location.pathname.startsWith('/login'), { timeout: 15000 });
  browserLog.push('LOGIN OK, at ' + page.url());
  // Go to the tasks page where the New Task button lives
  await page.goto(BASE + '/tasks', { waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForFunction(() => document.body.innerText.includes('New Task'), { timeout: 15000 });
  browserLog.push('ON TASKS PAGE');

  const results = [];
  results.push(await runScenario(page, browserLog, { name: 'A-personal', type: 'PERSONAL', useAssignee: false, priority: 'HIGH' }));
  // Close modal if still open before scenario B
  const stillOpen = await page.evaluate(() => !!document.querySelector('[role="dialog"]'));
  if (stillOpen) { await page.keyboard.press('Escape'); await sleep(500); }
  results.push(await runScenario(page, browserLog, { name: 'B-assigned', type: 'ASSIGNED', useAssignee: true, priority: 'HIGH' }));

  browserLog.push('\n===== CONSOLE ERRORS =====\n' + (consoleErrors.join('\n') || '(none)'));
  browserLog.push('\n===== FAILED API CALLS =====\n' + (failedRequests.join('\n') || '(none)'));

  fs.writeFileSync(path.join(ART, 'report.txt'), browserLog.join('\n'));
  console.log(browserLog.join('\n'));
  await browser.close();
})().catch(async (e) => { console.error('PROBE CRASHED:', e.message); console.log(browserLog.join('\n')); try { if (typeof browser !== 'undefined' && browser) await browser.close(); } catch {} process.exit(1); });
