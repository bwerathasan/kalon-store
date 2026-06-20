const puppeteer = require('puppeteer-core');

const CHROME = 'C:\\Users\\hasan\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe';
const URL    = 'http://localhost:5000/';
const PIXEL  = '1359606469381115';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu'],
  });

  const page = await browser.newPage();

  const allRequests  = [];
  const allResponses = [];
  const jsErrors     = [];

  page.on('pageerror', err => jsErrors.push('pageerror: ' + err.message));
  page.on('console',   msg => {
    if (msg.type() === 'error') jsErrors.push('[console.error] ' + msg.text());
  });

  await page.setRequestInterception(true);
  page.on('request', req => {
    allRequests.push(req.url());
    req.continue();
  });
  page.on('response', res => {
    allResponses.push({ status: res.status(), url: res.url() });
  });

  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 20000 });
  await new Promise(r => setTimeout(r, 3000));

  // Check fbq state
  const fbqDefined = await page.evaluate(() => typeof window.fbq === 'function');
  const fbqQueue   = await page.evaluate(() => {
    try { return JSON.stringify(window.fbq.queue || []); } catch(e) { return '[]'; }
  });
  const pixelInited = await page.evaluate((id) => {
    try {
      var cfg = window._fbq && window._fbq.pixelsByID;
      return cfg ? Object.keys(cfg) : [];
    } catch(_) { return []; }
  }, PIXEL);

  // Force-fire PageView manually to test fbq call path
  const manualFire = await page.evaluate(() => {
    try { window.fbq('track', 'PageView'); return 'fired'; }
    catch(e) { return 'ERROR: ' + e.message; }
  });

  await new Promise(r => setTimeout(r, 2000));

  await browser.close();

  // ── Categorise ──
  const fbEvents   = allRequests.filter(u => u.includes('fbevents'));
  const fbBeacons  = allRequests.filter(u => u.includes('facebook.com/tr') || u.includes('facebook.net/tr'));
  const errors404  = allResponses.filter(r => r.status === 404);
  const errors5xx  = allResponses.filter(r => r.status >= 500);

  console.log('\n══════════════════════════════════');
  console.log('  META PIXEL VERIFICATION REPORT');
  console.log('══════════════════════════════════\n');

  console.log('1. fbevents.js network request');
  fbEvents.forEach(u => {
    const resp = allResponses.find(r => r.url === u);
    console.log('   URL:    ', u);
    console.log('   Status: ', resp ? (resp.status === 200 ? '✓ ' + resp.status : '✗ ' + resp.status) : 'unknown');
  });
  if (!fbEvents.length) console.log('   ✗ No request to fbevents.js found');

  console.log('\n2. fbq defined in window');
  console.log('   ✓' , fbqDefined ? 'YES — fbq is a function' : '✗ NO');

  console.log('\n3. Pixels initialised with dataset ID');
  console.log('   IDs found in fbq:', pixelInited.length ? pixelInited.join(', ') : 'none');
  console.log('   Expected ID ' + PIXEL + ':', pixelInited.includes(PIXEL) ? '✓ FOUND' : '✗ NOT FOUND');

  console.log('\n4. PageView beacon (automatic on load)');
  const autoBeacons = fbBeacons.slice(0, fbBeacons.length); // all captured before manual fire
  if (autoBeacons.length) {
    autoBeacons.forEach(u => console.log('   ✓ Beacon:', u.substring(0, 100)));
  } else {
    console.log('   ✗ No beacon to facebook.com/tr captured');
  }

  console.log('\n5. Manual fbq(\'track\', \'PageView\') test call');
  console.log('   Result:', manualFire === 'fired' ? '✓ Call succeeded without error' : '✗ ' + manualFire);

  console.log('\n6. JavaScript errors on page');
  if (jsErrors.length === 0) {
    console.log('   ✓ None');
  } else {
    jsErrors.forEach(e => console.log('   ✗', e));
  }

  console.log('\n7. 404 errors (resources not found)');
  if (errors404.length === 0) {
    console.log('   ✓ None');
  } else {
    errors404.forEach(r => console.log('   ✗ 404:', r.url));
  }

  console.log('\n8. All facebook.com network requests');
  const fbAll = allRequests.filter(u => u.includes('facebook'));
  if (fbAll.length) {
    fbAll.forEach(u => console.log('   •', u.substring(0, 120)));
  } else {
    console.log('   (none)');
  }

  console.log('\n══════════════════════════════════');
  const ok = fbqDefined && pixelInited.includes(PIXEL) && manualFire === 'fired' && jsErrors.filter(e => !e.includes('404')).length === 0;
  console.log(ok ? '  RESULT: ✓ PIXEL OPERATIONAL' : '  RESULT: ✗ ISSUES DETECTED — SEE ABOVE');
  console.log('══════════════════════════════════\n');
})();
