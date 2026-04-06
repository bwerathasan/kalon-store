/* ════════════════════════════════════════
   KALON — script.js
════════════════════════════════════════ */

/* ── Countdown Timer ──
   Persists deadline in localStorage so it
   doesn't reset on every page reload.
──────────────────────────────────────── */
(function initCountdown() {
  const KEY = 'kalon_offer_deadline';
  const DURATION_MS = 23 * 3600000 + 59 * 60000 + 59 * 1000;

  let deadline = Number(localStorage.getItem(KEY));
  if (!deadline || Date.now() > deadline) {
    deadline = Date.now() + DURATION_MS;
    localStorage.setItem(KEY, deadline);
  }

  const elH = document.getElementById('cd-h');
  const elM = document.getElementById('cd-m');
  const elS = document.getElementById('cd-s');

  function pad(n) { return String(n).padStart(2, '0'); }

  function tick() {
    const diff = Math.max(0, deadline - Date.now());
    elH.textContent = pad(Math.floor(diff / 3600000));
    elM.textContent = pad(Math.floor((diff % 3600000) / 60000));
    elS.textContent = pad(Math.floor((diff % 60000) / 1000));
    if (diff > 0) setTimeout(tick, 1000);
  }

  tick();
})();

/* ── Email form handlers ── */
function handleEmailSubmit(e) {
  e.preventDefault();
  var form = e.currentTarget;
  var input = form.querySelector('input');
  var btn   = form.querySelector('button');
  btn.textContent = '✓ تم التسجيل! سيصلكِ الكود قريباً';
  btn.style.background = '#2C2C2C';
  input.value    = '';
  input.disabled = true;
  btn.disabled   = true;
}

function handlePopupSubmit(e) {
  e.preventDefault();
  var form  = e.currentTarget;
  var btn   = form.querySelector('button');
  var input = form.querySelector('input');
  btn.textContent = '✓ تم! سيصلكِ الكود على بريدكِ';
  btn.style.background = '#2C2C2C';
  input.disabled = true;
  btn.disabled   = true;
  setTimeout(closePopup, 2400);
}

/* ── Smooth scroll helper ── */
function scrollToSection(e, id) {
  if (e) e.preventDefault();
  var el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth' });
}

/* ── Smooth scroll to offer (legacy, kept for safety) ── */
function scrollToOffer(e) {
  scrollToSection(e, 'order-summary');
}

/* ── Floating CTA ──
   Visible between hero and order-summary.
   Hides once user enters order flow.
──────────────────────────────────────── */
var floatingCta = document.getElementById('floating-cta');

window.addEventListener('scroll', function () {
  var scrollY        = window.scrollY;
  var summaryEl      = document.getElementById('order-summary');
  var summaryTop     = summaryEl ? summaryEl.getBoundingClientRect().top + scrollY : Infinity;
  var aboveOrderFlow = scrollY > 560 && scrollY < summaryTop - 80;

  if (aboveOrderFlow) {
    floatingCta.classList.add('visible');
    floatingCta.setAttribute('aria-hidden', 'false');
  } else {
    floatingCta.classList.remove('visible');
    floatingCta.setAttribute('aria-hidden', 'true');
  }
}, { passive: true });

/* ── Nav shadow on scroll ── */
var mainNav = document.getElementById('main-nav');

window.addEventListener('scroll', function () {
  mainNav.style.boxShadow = window.scrollY > 40
    ? '0 2px 18px rgba(0,0,0,0.07)'
    : 'none';
}, { passive: true });

/* ── Order form handler ── */
function handleOrderSubmit(e) {
  e.preventDefault();
  var form    = document.getElementById('order-form-el');
  var success = document.getElementById('order-success');
  var errorEl = document.getElementById('order-error');
  var btn     = form.querySelector('.order-submit-btn');

  // Basic validation
  var name    = document.getElementById('f-name').value.trim();
  var phone   = document.getElementById('f-phone').value.trim();
  var city    = document.getElementById('f-city').value.trim();
  var address = document.getElementById('f-address').value.trim();
  var email   = document.getElementById('f-email').value.trim();
  var notes   = document.getElementById('f-notes').value.trim();

  errorEl.style.display = 'none';

  if (!name || !phone || !city || !address) {
    btn.textContent = 'يرجى تعبئة جميع الحقول المطلوبة';
    btn.style.background = '#8A4A00';
    setTimeout(function () {
      btn.textContent = 'إرسال الطلب \u00a0←';
      btn.style.background = '';
    }, 2500);
    return;
  }

  // Disable button while sending
  btn.disabled = true;
  btn.textContent = 'جاري الإرسال...';

  var payload = {
    full_name: name,
    phone:     phone,
    email:     email,
    city:      city,
    address:   address,
    notes:     notes
  };
  console.log('[ORDER] Sending payload:', payload);

  fetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  .then(function (res) {
    console.log('[ORDER] Response status:', res.status);
    return res.json().then(function (body) {
      console.log('[ORDER] Response body:', body);
      if (!res.ok) {
        var err = new Error('Server returned ' + res.status);
        err.body = body;
        throw err;
      }
      return body;
    });
  })
  .then(function () {
    // Clear form fields
    document.getElementById('f-name').value    = '';
    document.getElementById('f-phone').value   = '';
    document.getElementById('f-email').value   = '';
    document.getElementById('f-city').value    = '';
    document.getElementById('f-address').value = '';
    document.getElementById('f-notes').value   = '';

    form.style.display    = 'none';
    success.style.display = 'block';
  })
  .catch(function (err) {
    console.error('[ORDER] Submission failed:', err.message);
    if (err.body) console.error('[ORDER] Server error detail:', err.body);
    errorEl.textContent   = 'حدث خطأ أثناء إرسال الطلب، حاولي مرة أخرى';
    errorEl.style.display = 'block';
    btn.disabled          = false;
    btn.textContent       = 'إرسال الطلب \u00a0←';
  });
}
