const puppeteer = require('puppeteer-core');
const path = require('path');

const CHROME = 'C:\\Users\\hasan\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe';
const URL    = 'http://localhost:5000/';
const OUT    = path.join(__dirname, '..', '..', 'screenshots');

const fs = require('fs');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu'],
  });

  // ── Mobile: 390×844 (iPhone 14) ──
  const mobile = await browser.newPage();
  await mobile.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await mobile.goto(URL, { waitUntil: 'networkidle2', timeout: 20000 });
  await new Promise(r => setTimeout(r, 800));

  // Above-the-fold crop (full viewport height)
  await mobile.screenshot({ path: path.join(OUT, 'hero-mobile-fold.png'), clip: { x: 0, y: 0, width: 390, height: 844 } });

  // Hero section full height
  const mHeroH = await mobile.evaluate(() => {
    var h = document.querySelector('.hero');
    return h ? h.getBoundingClientRect().bottom + window.scrollY + 40 : 1100;
  });
  await mobile.screenshot({ path: path.join(OUT, 'hero-mobile-full.png'), clip: { x: 0, y: 0, width: 390, height: Math.min(mHeroH, 1400) } });

  await mobile.close();

  // ── Desktop: 1280×900 ──
  const desktop = await browser.newPage();
  await desktop.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1.5 });
  await desktop.goto(URL, { waitUntil: 'networkidle2', timeout: 20000 });
  await new Promise(r => setTimeout(r, 800));

  // Above-the-fold
  await desktop.screenshot({ path: path.join(OUT, 'hero-desktop-fold.png'), clip: { x: 0, y: 0, width: 1280, height: 900 } });

  await desktop.close();
  await browser.close();

  console.log('Screenshots saved to:', OUT);
  console.log('  hero-mobile-fold.png  — 390px, above the fold');
  console.log('  hero-mobile-full.png  — 390px, full hero height');
  console.log('  hero-desktop-fold.png — 1280px, above the fold');
})();
