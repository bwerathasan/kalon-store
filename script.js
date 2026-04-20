/* ════════════════════════════════════════
   KALON — script.js
════════════════════════════════════════ */

/* Countdown removed — longevity display is static (10–12 hours) */

/* ── Email form handlers ── */
function handleEmailSubmit(e) {
  e.preventDefault();
  var form = e.currentTarget;
  var input = form.querySelector('input');
  var btn   = form.querySelector('button');
  btn.textContent = '\u2713 Joined. You will hear from us first.';
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
  btn.textContent = '\u2713 Done. Check your inbox.';
  btn.style.background = '#2C2C2C';
  input.disabled = true;
  btn.disabled   = true;
  setTimeout(closePopup, 2400);
}

/* ── Product selection — updates order summary & form receipt ── */
var currentProduct = 'duo';
var _duoOOS = false;

var PRODUCTS = {
  'duo': {
    label:    'The Duo',
    price:    '₪649',
    showWas:  true,
    savings:  '₪129 saved — the only promotional structure',
    lines: [
      { label: 'Crystal Veil — No.01', val: '₪379' },
      { label: 'Encens Noir — No.02',  val: '₪399' },
      { label: 'The Duo Bundle',       val: 'Save ₪129', cls: 'os-line--gift', valCls: 'os-gift' },
      { label: 'Shipping',             val: 'Free with The Duo', valCls: 'os-free' }
    ],
    fosLines: [
      { label: 'Crystal Veil — No.01', val: '₪379' },
      { label: 'Encens Noir — No.02',  val: '₪399' },
      { label: 'The Duo Bundle',       val: 'Save ₪129', cls: 'fos-gift' }
    ],
    fosTotal: '₪649'
  },
  'crystal-veil': {
    label:    'Crystal Veil — No.01',
    price:    '₪379',
    showWas:  false,
    savings:  null,
    lines: [
      { label: 'Crystal Veil — No.01', val: '₪379' },
      { label: 'Longevity',            val: '10–12 hours' },
      { label: 'Shipping',             val: 'Calculated at checkout' }
    ],
    fosLines: [
      { label: 'Crystal Veil — No.01', val: '₪379' }
    ],
    fosTotal: '₪379'
  },
  'encens-noir': {
    label:    'Encens Noir — No.02',
    price:    '₪399',
    showWas:  false,
    savings:  null,
    lines: [
      { label: 'Encens Noir — No.02', val: '₪399' },
      { label: 'Longevity',           val: '10–12 hours' },
      { label: 'Shipping',            val: 'Calculated at checkout' }
    ],
    fosLines: [
      { label: 'Encens Noir — No.02', val: '₪399' }
    ],
    fosTotal: '₪399'
  },
};

function selectProduct(type) {
  currentProduct = type;
  var p = PRODUCTS[type];
  if (!p) return;

  // Update hidden form field
  var hiddenInput = document.getElementById('f-product');
  if (hiddenInput) hiddenInput.value = type;

  // Rebuild os-lines
  var linesEl = document.getElementById('os-lines-container');
  if (linesEl) {
    linesEl.innerHTML = p.lines.map(function (l) {
      return '<div class="os-line' + (l.cls ? ' ' + l.cls : '') + '">' +
        '<span class="os-label">' + l.label + '</span>' +
        '<span class="os-val' + (l.valCls ? ' ' + l.valCls : '') + '">' + l.val + '</span>' +
        '</div>';
    }).join('');
  }

  // Update pricing row
  var wasBlock = document.getElementById('os-was-block');
  if (wasBlock) wasBlock.style.display = p.showWas ? '' : 'none';

  var nowLabel = document.getElementById('os-now-label-el');
  if (nowLabel) nowLabel.textContent = p.label;

  var nowPrice = document.getElementById('os-now-price-el');
  if (nowPrice) nowPrice.textContent = p.price;

  // Savings pill
  var savingsEl = document.getElementById('os-savings-block');
  if (savingsEl) {
    savingsEl.style.display = p.savings ? '' : 'none';
    if (p.savings) savingsEl.textContent = p.savings;
  }

  // Restore order-summary CTA when switching away from Duo
  if (type !== 'duo') {
    _toggle('os-confirm-cta', true, true);
    _toggle('os-duo-oos', false, false);
  } else {
    _toggle('os-confirm-cta', !_duoOOS, true);
    _toggle('os-duo-oos', _duoOOS, false);
  }

  // Rebuild form mini-receipt
  var fosEl = document.getElementById('fos-container');
  if (fosEl) {
    var html = p.fosLines.map(function (l) {
      return '<div class="fos-line' + (l.cls ? ' ' + l.cls : '') + '"><span>' + l.label + '</span><span>' + l.val + '</span></div>';
    }).join('');
    html += '<div class="fos-total"><span>Total</span><span>' + p.fosTotal + '</span></div>';
    fosEl.innerHTML = html;
  }
}

/* ── Smooth scroll helper ── */
function scrollToSection(e, id) {
  if (e) e.preventDefault();
  var el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth' });
}

/* ── Inventory — fetch availability and update UI ── */
function loadInventory() {
  fetch('/api/inventory')
    .then(function (r) { return r.json(); })
    .then(function (body) {
      if (!body || !body.availability) return;
      var av = body.availability;
      _applyProductState('crystal-veil', !!av['crystal-veil']);
      _applyProductState('encens-noir',  !!av['encens-noir']);
      _applyProductState('duo',          !!av['duo']);
    })
    .catch(function (err) {
      console.error('[INVENTORY] fetch failed:', err && err.message);
    });
}

function _applyProductState(product, inStock) {
  if (product === 'crystal-veil') {
    _toggle('cv-cta',     inStock, true);
    _toggle('cv-oos',     !inStock, false);
    _toggle('cv-ind-cta', inStock, true);
    _toggle('cv-ind-oos', !inStock, false);
  } else if (product === 'encens-noir') {
    _toggle('en-cta',     inStock, true);
    _toggle('en-oos',     !inStock, false);
    _toggle('en-ind-cta', inStock, true);
    _toggle('en-ind-oos', !inStock, false);
  } else if (product === 'duo') {
    _toggle('duo-cta',        inStock, true);
    _toggle('duo-oos',        !inStock, false);
    _toggle('os-confirm-cta', inStock, true);
    _toggle('os-duo-oos',     !inStock, false);
    _duoOOS = !inStock;
    if (floatingCta) floatingCta.style.display = inStock ? '' : 'none';
  }
}

function _toggle(id, show, useInline) {
  var el = document.getElementById(id);
  if (!el) return;
  el.style.display = show ? (useInline ? '' : 'block') : 'none';
}

/* ── Notify-me form handler ── */
function handleNotify(e, product) {
  e.preventDefault();
  var form     = e.currentTarget;
  var input    = form.querySelector('.notify-input');
  var btn      = form.querySelector('.notify-btn');
  var feedback = form.closest('.oos-block').querySelector('.notify-feedback');
  var email    = input.value.trim();

  if (!email) return;
  btn.disabled    = true;
  btn.textContent = '...';

  fetch('/api/waitlist', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ email: email, product: product }),
  })
  .then(function (r) { return r.json(); })
  .then(function (body) {
    form.style.display      = 'none';
    feedback.style.display  = 'block';
    feedback.textContent    = body.already
      ? 'Already on the list. We will notify you.'
      : 'Done. We will email you when it is back.';
  })
  .catch(function () {
    btn.disabled    = false;
    btn.textContent = 'Notify me';
  });
}

loadInventory();

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

  if (aboveOrderFlow && !_duoOOS) {
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

  if (currentProduct === 'duo' && _duoOOS) {
    errorEl.textContent   = 'The Duo is currently out of stock.';
    errorEl.style.display = 'block';
    return;
  }

  if (!name || !phone || !city || !address) {
    btn.textContent = 'Please fill in all required fields.';
    btn.style.background = '#8A4A00';
    setTimeout(function () {
      btn.textContent = 'Place Order\u00a0\u2192';
      btn.style.background = '';
    }, 2500);
    return;
  }

  // Disable button while sending
  btn.disabled = true;
  btn.textContent = 'Sending...';

  var payload = {
    full_name: name,
    phone:     phone,
    email:     email,
    city:      city,
    address:   address,
    notes:     notes,
    product:   currentProduct
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
    var msg = (err.body && err.body.outOfStock)
      ? 'This product is currently out of stock.'
      : 'Something went wrong. Please try again.';
    errorEl.textContent   = msg;
    errorEl.style.display = 'block';
    btn.disabled          = false;
    btn.textContent       = 'Place Order\u00a0\u2192';
    // Re-check inventory to update UI if stock ran out mid-session
    if (err.body && err.body.outOfStock) loadInventory();
  });
}
