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
  btn.textContent = t('email_joined');
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
  btn.textContent = t('email_popup_done');
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
      ? t('notify_already')
      : t('notify_done');
  })
  .catch(function () {
    btn.disabled    = false;
    btn.textContent = t('notify_btn');
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
    errorEl.textContent   = t('form_oos_error');
    errorEl.style.display = 'block';
    return;
  }

  if (!name || !phone || !city || !address) {
    btn.textContent = t('form_validation');
    btn.style.background = '#8A4A00';
    setTimeout(function () {
      btn.textContent = t('form_submit');
      btn.style.background = '';
    }, 2500);
    return;
  }

  // Disable button while sending
  btn.disabled = true;
  btn.textContent = t('form_sending');

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
      ? t('form_oos_single')
      : t('form_error');
    errorEl.textContent   = msg;
    errorEl.style.display = 'block';
    btn.disabled          = false;
    btn.textContent       = t('form_submit');
    // Re-check inventory to update UI if stock ran out mid-session
    if (err.body && err.body.outOfStock) loadInventory();
  });
}

/* ── Language Switcher ── */
var currentLang = 'en';

var translations = {
  en: {
    announce: '\u2756\u00a0Free shipping on The Duo\u00a0\u2756\u00a0Crystal Veil \u00b7 Encens Noir\u00a0\u2756',
    nav_cta: 'Order Now', hero_eyebrow: 'EXTRAIT DE PARFUM \u00b7 HOUSE OF KALON',
    hero_familiar: 'Familiar. Built to stay.', hero_cta: 'Order Now\u00a0\u2192',
    offer_badge: 'The Duo', offer_headline: 'Crystal Veil + Encens Noir',
    offer_tagline: 'Two moods. One uncompromising standard.',
    item1_name: 'CRYSTAL VEIL', item2_name: 'ENCENS NOIR', item3_name: 'THE DUO',
    item3_sub: 'The only bundle', price_individual: 'Individual', price_duo: 'The Duo',
    savings_pill: '\u20aa129 saved \u2014 structured, not seasonal',
    countdown_label: 'Engineered longevity',
    urgency: 'Performance is the only luxury that matters.',
    duo_cta: 'Order The Duo', oos_label: 'Out of stock',
    notify_ph: 'Email \u2014 notify me when back', notify_btn: 'Notify me',
    notify_already: 'Already on the list. We will notify you.',
    notify_done: 'Done. We will email you when it is back.',
    collection_eyebrow: 'The Collection', collection_title: 'The Collection',
    cv_number: 'KALON \u2014 No.01', cv_name: 'Crystal Veil', cv_vibe: 'Clean \u00b7 Airy \u00b7 Crystalline',
    en_number: 'KALON \u2014 No.02', en_name: 'Encens Noir', en_vibe: 'Dark \u00b7 Resinous \u00b7 Commanding',
    order_now: 'Order Now', why_eyebrow: 'Why KALON', why_title: 'Why KALON',
    why1_title: 'Engineered Performance',
    why1_desc: '10\u201312 hours. Tested. Documented. Repeatable. Not a claim \u2014 a standard.',
    why2_title: 'Original Compositions',
    why2_desc: 'Not a copy. Not inspired by. An elevation \u2014 built from legendary scent DNA into its own identity.',
    why3_title: 'A Standard. Not a Product.',
    why3_desc: 'Every bottle passes the same test before it leaves. No exceptions. No compromises.',
    reviews_eyebrow: 'Wear Tests', reviews_title: 'What They Said',
    review1_text: '\u201cOrdered The Duo for me and my husband. Performance is a 10+. We\u2019re both completely hooked. It fills the entire room \u2014 people ask about it before we even say hello. Nothing we\u2019ve tried before stays like this.\u201d',
    review1_name: 'Yarden & Kobi M.', review1_loc: 'Verified \u2014 The Duo',
    review2_text: '\u201cCrystal Veil is top-tier unisex. Smells like burnt sugar and air \u2014 delicious, clean, genuinely luxurious. My 3 sisters and 4 of my friends have all ordered after smelling it on me. That says everything.\u201d',
    review2_name: 'Lina Azouri', review2_loc: 'Verified \u2014 Crystal Veil',
    review3_text: '\u201cEncens Noir smells like a Dubai billionaire. Strong, rich, maximum wow effect. The kind of scent where people stop and ask. Powerful without being aggressive \u2014 pure class.\u201d',
    review3_name: 'Tarek Ali', review3_loc: 'Verified \u2014 Encens Noir',
    wa_eyebrow: 'Contact', wa_title: 'Questions?', wa_sub: 'Our team responds fast.',
    wa_cta: 'Contact via WhatsApp', os_eyebrow: 'Order Summary',
    os_confirm: 'Confirm Order\u00a0\u2192', os_oos_label: 'Out of stock \u2014 The Duo',
    email_eyebrow: 'House of Kalon', email_title: 'Join the House of Kalon',
    email_sub: 'New releases. Wear-test results. Performance updates. First.',
    email_btn: 'Join Now', email_note: 'No spam. Unsubscribe any time.',
    email_ph: 'Your email address',
    email_joined: '\u2713 Joined. You will hear from us first.',
    email_popup_done: '\u2713 Done. Check your inbox.',
    ind_title: 'Or Order Individually', ind_sub: 'Single bottle \u00b7 No discounts',
    cv_ind_sub: '\u20aa379 \u00b7 Clean \u00b7 Airy', en_ind_sub: '\u20aa399 \u00b7 Dark \u00b7 Magnetic',
    ind_order: 'Order', ind_oos_sm: 'Out of stock',
    form_eyebrow: 'KALON Order', form_title: 'Order Details',
    form_sub: 'Enter your details. We will contact you within 24 hours to confirm and arrange delivery.',
    form_name: 'Full Name', form_phone: 'Phone', form_email: 'Email',
    form_optional: '(optional)', form_city: 'City', form_address: 'Address', form_notes: 'Order Notes',
    form_name_ph: 'Your full name', form_phone_ph: '05XXXXXXXX',
    form_email_ph: 'example@email.com', form_city_ph: 'Your city',
    form_address_ph: 'Street, building, apartment',
    form_notes_ph: 'Any additional details or special requests...',
    form_submit: 'Place Order\u00a0\u2192',
    form_note: 'We will contact you within 24 hours to confirm your order and arrange delivery.',
    form_validation: 'Please fill in all required fields.', form_sending: 'Sending...',
    form_oos_error: 'The Duo is currently out of stock.',
    form_error: 'Something went wrong. Please try again.',
    form_oos_single: 'This product is currently out of stock.',
    success_title: 'Order submitted.',
    success_sub: 'We will contact you within 24 hours to confirm and arrange delivery.',
    floating_cta: 'Order The Duo \u2014 \u20aa649',
    footer_tagline: 'Performance is the only luxury that matters.',
    footer_copy: '\u00a9 2025 KALON. All rights reserved.',
    hero_headline_html: 'Performance is the only<br />luxury that matters.',
    hero_sub_html: 'The scent your nose already knows.<br />Now it finally stays.',
    cv_desc_html: 'Airy sweetness and crystalline clarity \u2014 saffron, transparent amber, soft woods.<br />Weightless but persistent. Gentle projection that lasts all day.<br />For those who are always remembered, without trying.',
    en_desc_html: 'Dark incense, dense oud, warm spice \u2014 it enters the room before you do.<br />Smoky woods and leather depth that builds through the night.<br />Heavy, expensive, intentional. Not for the timid.',
  },
  ar: {
    announce: '\u2756\u00a0\u0634\u062d\u0646 \u0645\u062c\u0627\u0646\u064a \u0645\u0639 \u0627\u0644\u062b\u0646\u0627\u0626\u064a\u00a0\u2756\u00a0\u0643\u0631\u064a\u0633\u062a\u0627\u0644 \u0641\u064a\u0644 \u00b7 \u0625\u0646\u0633\u0627\u0646 \u0646\u0648\u0627\u0631\u00a0\u2756',
    nav_cta: '\u0627\u0637\u0644\u0628 \u0627\u0644\u0622\u0646', hero_eyebrow: '\u0625\u0643\u0633\u062a\u0631\u0627 \u062f\u0648 \u0628\u0627\u0631\u0641\u0627\u0645 \u00b7 \u0628\u064a\u062a \u0643\u0627\u0644\u0648\u0646',
    hero_familiar: '\u0645\u0623\u0644\u0648\u0641. \u0645\u0635\u0645\u0651\u0645 \u0644\u064a\u0628\u0642\u0649.', hero_cta: '\u0627\u0637\u0644\u0628 \u0627\u0644\u0622\u0646',
    offer_badge: '\u0627\u0644\u062b\u0646\u0627\u0626\u064a', offer_headline: '\u0643\u0631\u064a\u0633\u062a\u0627\u0644 \u0641\u064a\u0644 + \u0625\u0646\u0633\u0627\u0646 \u0646\u0648\u0627\u0631',
    offer_tagline: '\u0645\u0632\u0627\u062c\u0627\u0646. \u0645\u0639\u064a\u0627\u0631 \u0648\u0627\u062d\u062f \u0644\u0627 \u062a\u0647\u0627\u0648\u0646 \u0641\u064a\u0647.',
    item1_name: '\u0643\u0631\u064a\u0633\u062a\u0627\u0644 \u0641\u064a\u0644', item2_name: '\u0625\u0646\u0633\u0627\u0646 \u0646\u0648\u0627\u0631', item3_name: '\u0627\u0644\u062b\u0646\u0627\u0626\u064a',
    item3_sub: '\u0627\u0644\u062d\u0632\u0645\u0629 \u0627\u0644\u0648\u062d\u064a\u062f\u0629', price_individual: '\u0641\u0631\u062f\u064a', price_duo: '\u0627\u0644\u062b\u0646\u0627\u0626\u064a',
    savings_pill: '\u0648\u0641\u0651\u0631 \u20aa129 \u2014 \u0645\u0646\u0638\u0651\u0645 \u0644\u0627 \u0645\u0648\u0633\u0645\u064a',
    countdown_label: '\u0623\u062f\u0627\u0621 \u0645\u064f\u0635\u0645\u064e\u0651\u0645',
    urgency: '\u0627\u0644\u0623\u062f\u0627\u0621 \u0647\u0648 \u0627\u0644\u0631\u0641\u0627\u0647\u064a\u0629 \u0627\u0644\u0648\u062d\u064a\u062f\u0629 \u0627\u0644\u062a\u064a \u062a\u0647\u0645\u0651.',
    duo_cta: '\u0627\u0637\u0644\u0628 \u0627\u0644\u062b\u0646\u0627\u0626\u064a', oos_label: '\u0646\u0641\u0630 \u0645\u0646 \u0627\u0644\u0645\u062e\u0632\u0648\u0646',
    notify_ph: '\u0627\u0644\u0628\u0631\u064a\u062f \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a \u2014 \u0623\u0634\u0639\u0631\u0646\u064a \u0639\u0646\u062f \u0627\u0644\u062a\u0648\u0641\u0631',
    notify_btn: '\u0623\u0634\u0639\u0631\u0646\u064a',
    notify_already: '\u0623\u0646\u062a \u0628\u0627\u0644\u0641\u0639\u0644 \u0639\u0644\u0649 \u0627\u0644\u0642\u0627\u0626\u0645\u0629. \u0633\u0646\u062e\u0637\u0631\u0643.',
    notify_done: '\u062a\u0645. \u0633\u0646\u0631\u0633\u0644 \u0625\u0644\u064a\u0643 \u0628\u0631\u064a\u062f\u064b\u0627 \u0639\u0646\u062f \u0627\u0644\u062a\u0648\u0641\u0631.',
    collection_eyebrow: '\u0627\u0644\u0645\u062c\u0645\u0648\u0639\u0629', collection_title: '\u0627\u0644\u0645\u062c\u0645\u0648\u0639\u0629',
    cv_number: '\u0643\u0627\u0644\u0648\u0646 \u2014 No.01', cv_name: '\u0643\u0631\u064a\u0633\u062a\u0627\u0644 \u0641\u064a\u0644', cv_vibe: '\u0646\u0638\u064a\u0641 \u00b7 \u0647\u0648\u0627\u0626\u064a \u00b7 \u0628\u0644\u0648\u0631\u064a',
    en_number: '\u0643\u0627\u0644\u0648\u0646 \u2014 No.02', en_name: '\u0625\u0646\u0633\u0627\u0646 \u0646\u0648\u0627\u0631', en_vibe: '\u062f\u0627\u0643\u0646 \u00b7 \u0635\u0645\u063a\u064a \u00b7 \u0622\u0645\u0631',
    order_now: '\u0627\u0637\u0644\u0628 \u0627\u0644\u0622\u0646', why_eyebrow: '\u0644\u0645\u0627\u0630\u0627 \u0643\u0627\u0644\u0648\u0646', why_title: '\u0644\u0645\u0627\u0630\u0627 \u0643\u0627\u0644\u0648\u0646',
    why1_title: '\u0623\u062f\u0627\u0621 \u0645\u064f\u0647\u064e\u0646\u062f\u064e\u0633', why1_desc: '10\u201312 \u0633\u0627\u0639\u0629. \u0645\u064f\u062e\u062a\u0628\u064e\u0631. \u0645\u0648\u062b\u0651\u064e\u0642. \u0642\u0627\u0628\u0644 \u0644\u0644\u062a\u0643\u0631\u0627\u0631. \u0644\u064a\u0633 \u0627\u062f\u0639\u0627\u0621\u064b\u0627 \u2014 \u0628\u0644 \u0645\u0639\u064a\u0627\u0631.',
    why2_title: '\u062a\u0631\u0627\u0643\u064a\u0628 \u0623\u0635\u064a\u0644\u0629', why2_desc: '\u0644\u064a\u0633\u062a \u0646\u0633\u062e\u0629. \u0644\u064a\u0633\u062a \u0645\u0633\u062a\u0648\u062d\u0627\u0629. \u0627\u0631\u062a\u0642\u0627\u0621 \u2014 \u0645\u0628\u0646\u064a\u0651 \u0645\u0646 \u062d\u0645\u0636 \u0646\u0648\u0648\u064a \u0639\u0637\u0631\u064a \u0623\u0633\u0637\u0648\u0631\u064a \u0625\u0644\u0649 \u0647\u0648\u064a\u0629 \u062e\u0627\u0635\u0629.',
    why3_title: '\u0645\u0639\u064a\u0627\u0631. \u0644\u064a\u0633 \u0645\u0646\u062a\u062c\u064b\u0627.', why3_desc: '\u0643\u0644 \u0632\u062c\u0627\u062c\u0629 \u062a\u062c\u062a\u0627\u0632 \u0627\u0644\u0627\u062e\u062a\u0628\u0627\u0631 \u0646\u0641\u0633\u0647 \u0642\u0628\u0644 \u0627\u0644\u0645\u063a\u0627\u062f\u0631\u0629. \u0644\u0627 \u0627\u0633\u062a\u062b\u0646\u0627\u0621\u0627\u062a. \u0644\u0627 \u062a\u0646\u0627\u0632\u0644\u0627\u062a.',
    reviews_eyebrow: '\u0627\u062e\u062a\u0628\u0627\u0631\u0627\u062a \u0627\u0644\u0627\u0631\u062a\u062f\u0627\u0621', reviews_title: '\u0645\u0627\u0630\u0627 \u0642\u0627\u0644\u0648\u0627',
    review1_text: '\u201c\u0637\u0644\u0628\u062a \u0627\u0644\u062b\u0646\u0627\u0626\u064a \u0644\u064a \u0648\u0644\u0632\u0648\u062c\u064a. \u0627\u0644\u0623\u062f\u0627\u0621 10+. \u0627\u0646\u0628\u0647\u0631\u0646\u0627 \u062a\u0645\u0627\u0645\u064b\u0627. \u064a\u0645\u0644\u0623 \u0627\u0644\u063a\u0631\u0641\u0629 \u2014 \u064a\u0633\u0623\u0644\u0648\u0646 \u0639\u0646\u0647 \u0642\u0628\u0644 \u0623\u0646 \u0646\u0642\u0648\u0644 \u0645\u0631\u062d\u0628\u064b\u0627.\u201d',
    review1_name: '\u064a\u0631\u062f\u0646 \u0648\u0643\u0648\u0628\u064a \u0645.', review1_loc: '\u0645\u0648\u062b\u0651\u0642 \u2014 \u0627\u0644\u062b\u0646\u0627\u0626\u064a',
    review2_text: '\u201c\u0643\u0631\u064a\u0633\u062a\u0627\u0644 \u0641\u064a\u0644 \u0639\u0637\u0631 \u062c\u0646\u0633\u064a \u0645\u0646 \u0627\u0644\u062f\u0631\u062c\u0629 \u0627\u0644\u0623\u0648\u0644\u0649. \u0623\u062e\u062a\u064a \u0627\u0644\u062b\u0644\u0627\u062b \u0648\u0623\u0631\u0628\u0639\u0629 \u0635\u062f\u064a\u0642\u0627\u062a \u0637\u0644\u0628\u0646\u0647 \u0628\u0639\u062f \u0634\u0645\u0651\u0647 \u0639\u0644\u064a\u0651.\u201d',
    review2_name: '\u0644\u064a\u0646\u0627 \u0639\u0632\u0648\u0631\u064a', review2_loc: '\u0645\u0648\u062b\u0651\u0642 \u2014 \u0643\u0631\u064a\u0633\u062a\u0627\u0644 \u0641\u064a\u0644',
    review3_text: '\u201c\u0625\u0646\u0633\u0627\u0646 \u0646\u0648\u0627\u0631 \u0645\u062b\u0644 \u0645\u0644\u064a\u0627\u0631\u062f\u064a\u0631 \u062f\u0628\u064a. \u0642\u0648\u064a\u0651 \u0641\u0627\u062e\u0631. \u0627\u0644\u0646\u0648\u0639 \u0627\u0644\u0630\u064a \u064a\u0648\u0642\u0641 \u0627\u0644\u0646\u0627\u0633 \u0648\u064a\u0633\u0623\u0644\u0648\u0646.\u201d',
    review3_name: '\u0637\u0627\u0631\u0642 \u0639\u0644\u064a', review3_loc: '\u0645\u0648\u062b\u0651\u0642 \u2014 \u0625\u0646\u0633\u0627\u0646 \u0646\u0648\u0627\u0631',
    wa_eyebrow: '\u062a\u0648\u0627\u0635\u0644', wa_title: '\u0623\u0633\u0626\u0644\u0629\u061f', wa_sub: '\u0641\u0631\u064a\u0642\u0646\u0627 \u064a\u0631\u062f \u0628\u0633\u0631\u0639\u0629.',
    wa_cta: '\u062a\u0648\u0627\u0635\u0644 \u0639\u0628\u0631 \u0648\u0627\u062a\u0633\u0627\u0628', os_eyebrow: '\u0645\u0644\u062e\u0635 \u0627\u0644\u0637\u0644\u0628',
    os_confirm: '\u062a\u0623\u0643\u064a\u062f \u0627\u0644\u0637\u0644\u0628 \u2190', os_oos_label: '\u0646\u0641\u0630 \u0645\u0646 \u0627\u0644\u0645\u062e\u0632\u0648\u0646 \u2014 \u0627\u0644\u062b\u0646\u0627\u0626\u064a',
    email_eyebrow: '\u0628\u064a\u062a \u0643\u0627\u0644\u0648\u0646', email_title: '\u0627\u0646\u0636\u0645 \u0625\u0644\u0649 \u0628\u064a\u062a \u0643\u0627\u0644\u0648\u0646',
    email_sub: '\u0625\u0635\u062f\u0627\u0631\u0627\u062a \u062c\u062f\u064a\u062f\u0629. \u0646\u062a\u0627\u0626\u062c \u0627\u0644\u0627\u062e\u062a\u0628\u0627\u0631. \u062a\u062d\u062f\u064a\u062b\u0627\u062a \u0627\u0644\u0623\u062f\u0627\u0621. \u0623\u0646\u062a \u0623\u0648\u0644 \u0645\u0646 \u064a\u0639\u0644\u0645.',
    email_btn: '\u0627\u0646\u0636\u0645 \u0627\u0644\u0622\u0646', email_note: '\u0644\u0627 \u0631\u0633\u0627\u0626\u0644 \u0645\u0632\u0639\u062c\u0629. \u0625\u0644\u063a\u0627\u0621 \u0627\u0644\u0627\u0634\u062a\u0631\u0627\u0643 \u0641\u064a \u0623\u064a \u0648\u0642\u062a.',
    email_ph: '\u0628\u0631\u064a\u062f\u0643 \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a',
    email_joined: '\u2713 \u062a\u0645 \u0627\u0644\u0627\u0646\u0636\u0645\u0627\u0645. \u0633\u062a\u0633\u0645\u0639 \u0645\u0646\u0651\u0627 \u0623\u0648\u0644\u064b\u0627.',
    email_popup_done: '\u2713 \u062a\u0645. \u062a\u062d\u0642\u0651\u0642 \u0645\u0646 \u0628\u0631\u064a\u062f\u0643 \u0627\u0644\u0648\u0627\u0631\u062f.',
    ind_title: '\u0623\u0648 \u0627\u0637\u0644\u0628 \u0628\u0634\u0643\u0644 \u0641\u0631\u062f\u064a', ind_sub: '\u0632\u062c\u0627\u062c\u0629 \u0648\u0627\u062d\u062f\u0629 \u00b7 \u0628\u062f\u0648\u0646 \u062e\u0635\u0648\u0645\u0627\u062a',
    cv_ind_sub: '\u20aa379 \u00b7 \u0646\u0638\u064a\u0641 \u00b7 \u0647\u0648\u0627\u0626\u064a', en_ind_sub: '\u20aa399 \u00b7 \u062f\u0627\u0643\u0646 \u00b7 \u0645\u063a\u0646\u0627\u0637\u064a\u0633\u064a',
    ind_order: '\u0627\u0637\u0644\u0628', ind_oos_sm: '\u0646\u0641\u0630 \u0645\u0646 \u0627\u0644\u0645\u062e\u0632\u0648\u0646',
    form_eyebrow: '\u0637\u0644\u0628 \u0643\u0627\u0644\u0648\u0646', form_title: '\u062a\u0641\u0627\u0635\u064a\u0644 \u0627\u0644\u0637\u0644\u0628',
    form_sub: '\u0623\u062f\u062e\u0644 \u0628\u064a\u0627\u0646\u0627\u062a\u0643. \u0633\u0646\u062a\u0635\u0644 \u0628\u0643 \u062e\u0644\u0627\u0644 24 \u0633\u0627\u0639\u0629 \u0644\u0644\u062a\u0623\u0643\u064a\u062f \u0648\u062a\u0631\u062a\u064a\u0628 \u0627\u0644\u062a\u0633\u0644\u064a\u0645.',
    form_name: '\u0627\u0644\u0627\u0633\u0645 \u0627\u0644\u0643\u0627\u0645\u0644', form_phone: '\u0627\u0644\u0647\u0627\u062a\u0641', form_email: '\u0627\u0644\u0628\u0631\u064a\u062f \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a',
    form_optional: '(\u0627\u062e\u062a\u064a\u0627\u0631\u064a)', form_city: '\u0627\u0644\u0645\u062f\u064a\u0646\u0629', form_address: '\u0627\u0644\u0639\u0646\u0648\u0627\u0646', form_notes: '\u0645\u0644\u0627\u062d\u0638\u0627\u062a \u0627\u0644\u0637\u0644\u0628',
    form_name_ph: '\u0627\u0633\u0645\u0643 \u0627\u0644\u0643\u0627\u0645\u0644', form_phone_ph: '05XXXXXXXX', form_email_ph: 'example@email.com',
    form_city_ph: '\u0645\u062f\u064a\u0646\u062a\u0643', form_address_ph: '\u0627\u0644\u0634\u0627\u0631\u0639\u060c \u0627\u0644\u0645\u0628\u0646\u0649\u060c \u0627\u0644\u0634\u0642\u0629',
    form_notes_ph: '\u0623\u064a \u062a\u0641\u0627\u0635\u064a\u0644 \u0625\u0636\u0627\u0641\u064a\u0629 \u0623\u0648 \u0637\u0644\u0628\u0627\u062a \u062e\u0627\u0635\u0629...',
    form_submit: '\u0642\u062f\u0651\u0645 \u0627\u0644\u0637\u0644\u0628 \u2190',
    form_note: '\u0633\u0646\u062a\u0635\u0644 \u0628\u0643 \u062e\u0644\u0627\u0644 24 \u0633\u0627\u0639\u0629 \u0644\u062a\u0623\u0643\u064a\u062f \u0637\u0644\u0628\u0643 \u0648\u062a\u0631\u062a\u064a\u0628 \u0627\u0644\u062a\u0633\u0644\u064a\u0645.',
    form_validation: '\u064a\u0631\u062c\u0649 \u062a\u0639\u0628\u0626\u0629 \u062c\u0645\u064a\u0639 \u0627\u0644\u062d\u0642\u0648\u0644 \u0627\u0644\u0645\u0637\u0644\u0648\u0628\u0629.',
    form_sending: '\u062c\u0627\u0631\u064d \u0627\u0644\u0625\u0631\u0633\u0627\u0644...', form_oos_error: '\u0627\u0644\u062b\u0646\u0627\u0626\u064a \u063a\u064a\u0631 \u0645\u062a\u0648\u0641\u0631 \u062d\u0627\u0644\u064a\u064b\u0627.',
    form_error: '\u062d\u062f\u062b \u062e\u0637\u0623. \u064a\u0631\u062c\u0649 \u0627\u0644\u0645\u062d\u0627\u0648\u0644\u0629 \u0645\u0631\u0629 \u0623\u062e\u0631\u0649.', form_oos_single: '\u0647\u0630\u0627 \u0627\u0644\u0645\u0646\u062a\u062c \u063a\u064a\u0631 \u0645\u062a\u0648\u0641\u0631 \u062d\u0627\u0644\u064a\u064b\u0627.',
    success_title: '\u062a\u0645 \u062a\u0642\u062f\u064a\u0645 \u0627\u0644\u0637\u0644\u0628.', success_sub: '\u0633\u0646\u062a\u0635\u0644 \u0628\u0643 \u062e\u0644\u0627\u0644 24 \u0633\u0627\u0639\u0629 \u0644\u0644\u062a\u0623\u0643\u064a\u062f \u0648\u062a\u0631\u062a\u064a\u0628 \u0627\u0644\u062a\u0633\u0644\u064a\u0645.',
    floating_cta: '\u0627\u0637\u0644\u0628 \u0627\u0644\u062b\u0646\u0627\u0626\u064a \u2014 \u20aa649',
    footer_tagline: '\u0627\u0644\u0623\u062f\u0627\u0621 \u0647\u0648 \u0627\u0644\u0631\u0641\u0627\u0647\u064a\u0629 \u0627\u0644\u0648\u062d\u064a\u062f\u0629 \u0627\u0644\u062a\u064a \u062a\u0647\u0645\u0651.', footer_copy: '\u00a9 2025 KALON. \u062c\u0645\u064a\u0639 \u0627\u0644\u062d\u0642\u0648\u0642 \u0645\u062d\u0641\u0648\u0638\u0629.',
    hero_headline_html: '\u0627\u0644\u0623\u062f\u0627\u0621 \u0647\u0648 \u0627\u0644\u0631\u0641\u0627\u0647\u064a\u0629<br />\u0627\u0644\u0648\u062d\u064a\u062f\u0629 \u0627\u0644\u062a\u064a \u062a\u0647\u0645\u0651.',
    hero_sub_html: '\u0627\u0644\u0639\u0637\u0631 \u0627\u0644\u0630\u064a \u062a\u0639\u0631\u0641\u0647 \u0623\u0646\u0641\u0643 \u0628\u0627\u0644\u0641\u0639\u0644.<br />\u0627\u0644\u0622\u0646 \u064a\u0628\u0642\u0649 \u0623\u062e\u064a\u0631\u064b\u0627.',
    cv_desc_html: '\u062d\u0644\u0627\u0648\u0629 \u0647\u0648\u0627\u0626\u064a\u0629 \u0648\u0648\u0636\u0648\u062d \u0628\u0644\u0648\u0631\u064a \u2014 \u0632\u0639\u0641\u0631\u0627\u0646\u060c \u0639\u0646\u0628\u0631 \u0634\u0641\u0627\u0641\u060c \u062e\u0634\u0628 \u0646\u0627\u0639\u0645.<br />\u062e\u0641\u064a\u0641 \u0644\u0643\u0646 \u062f\u0627\u0626\u0645. \u0625\u0633\u0642\u0627\u0637 \u0644\u0637\u064a\u0641 \u064a\u062f\u0648\u0645 \u0637\u0648\u0627\u0644 \u0627\u0644\u064a\u0648\u0645.<br />\u0644\u0645\u0646 \u064a\u064f\u062a\u0630\u0643\u0651\u064e\u0631 \u062f\u0627\u0626\u0645\u064b\u0627\u060c \u062f\u0648\u0646 \u0623\u0646 \u064a\u062d\u0627\u0648\u0644.',
    en_desc_html: '\u0628\u062e\u0648\u0631 \u062f\u0627\u0643\u0646\u060c \u0639\u0648\u062f \u0643\u062b\u064a\u0641\u060c \u062a\u0648\u0627\u0628\u0644 \u062f\u0627\u0641\u0626\u0629 \u2014 \u064a\u062f\u062e\u0644 \u0627\u0644\u063a\u0631\u0641\u0629 \u0642\u0628\u0644\u0643.<br />\u062e\u0634\u0628 \u0645\u062f\u062e\u0651\u0646 \u0648\u0639\u0645\u0642 \u0627\u0644\u062c\u0644\u062f \u064a\u062a\u0635\u0627\u0639\u062f \u0637\u0648\u0627\u0644 \u0627\u0644\u0644\u064a\u0644.<br />\u062b\u0642\u064a\u0644\u060c \u0641\u0627\u062e\u0631\u060c \u0645\u0642\u0635\u0648\u062f. \u0644\u064a\u0633 \u0644\u0644\u062c\u0628\u0646\u0627\u0621.',
  },
  he: {
    announce: '\u2756\u00a0\u05de\u05e9\u05dc\u05d5\u05d7 \u05d7\u05d9\u05e0\u05dd \u05e2\u05dd \u05d4\u05d3\u05d5\u05d0\u05d5\u00a0\u2756\u00a0Crystal Veil \u00b7 Encens Noir\u00a0\u2756',
    nav_cta: '\u05d4\u05d6\u05de\u05df \u05e2\u05db\u05e9\u05d9\u05d5', hero_eyebrow: 'EXTRAIT DE PARFUM \u00b7 \u05d1\u05d9\u05ea \u05e7\u05dc\u05d5\u05df',
    hero_familiar: '\u05de\u05d5\u05db\u05e8. \u05e0\u05d1\u05e0\u05d4 \u05dc\u05d4\u05d9\u05e9\u05d0\u05e8.', hero_cta: '\u05d4\u05d6\u05de\u05df \u05e2\u05db\u05e9\u05d9\u05d5',
    offer_badge: '\u05d4\u05d3\u05d5\u05d0\u05d5', offer_headline: 'Crystal Veil + Encens Noir',
    offer_tagline: '\u05e9\u05e0\u05d9 \u05de\u05e6\u05d1\u05d9 \u05e8\u05d5\u05d7. \u05e1\u05d8\u05e0\u05d3\u05e8\u05d8 \u05d0\u05d7\u05d3 \u05dc\u05dc\u05d0 \u05e4\u05e9\u05e8\u05d5\u05ea.',
    item1_name: 'CRYSTAL VEIL', item2_name: 'ENCENS NOIR', item3_name: '\u05d4\u05d3\u05d5\u05d0\u05d5',
    item3_sub: '\u05d4\u05d7\u05d1\u05d9\u05dc\u05d4 \u05d4\u05d9\u05d7\u05d9\u05d3\u05d4', price_individual: '\u05e0\u05e4\u05e8\u05d3', price_duo: '\u05d4\u05d3\u05d5\u05d0\u05d5',
    savings_pill: '\u20aa129 \u05d7\u05d9\u05e1\u05db\u05d5\u05df \u2014 \u05de\u05d5\u05d1\u05e0\u05d4, \u05dc\u05d0 \u05e2\u05d5\u05e0\u05ea\u05d9',
    countdown_label: '\u05e2\u05de\u05d9\u05d3\u05d5\u05ea \u05de\u05d4\u05d5\u05e0\u05d3\u05e1\u05ea',
    urgency: '\u05d4\u05d1\u05d9\u05e6\u05d5\u05e2\u05d9\u05dd \u05d4\u05dd \u05d4\u05e4\u05d9\u05e0\u05d5\u05e7 \u05d4\u05d9\u05d7\u05d9\u05d3 \u05e9\u05d7\u05e9\u05d5\u05d1.',
    duo_cta: '\u05d4\u05d6\u05de\u05df \u05d0\u05ea \u05d4\u05d3\u05d5\u05d0\u05d5', oos_label: '\u05d0\u05d6\u05dc \u05de\u05d4\u05de\u05dc\u05d0\u05d9',
    notify_ph: '\u05d0\u05d9\u05de\u05d9\u05d9\u05dc \u2014 \u05d4\u05d5\u05d3\u05e2 \u05dc\u05d9 \u05db\u05e9\u05d9\u05d7\u05d6\u05d5\u05e8',
    notify_btn: '\u05d4\u05d5\u05d3\u05e2 \u05dc\u05d9', notify_already: '\u05db\u05d1\u05e8 \u05d1\u05e8\u05e9\u05d9\u05de\u05d4. \u05e0\u05d5\u05d3\u05d9\u05e2 \u05dc\u05da.',
    notify_done: '\u05e1\u05d9\u05d5\u05dd. \u05e0\u05e9\u05dc\u05d7 \u05dc\u05da \u05de\u05d9\u05d9\u05dc \u05db\u05e9\u05d9\u05d7\u05d6\u05d5\u05e8.',
    collection_eyebrow: '\u05d4\u05e7\u05d5\u05dc\u05e7\u05e6\u05d9\u05d4', collection_title: '\u05d4\u05e7\u05d5\u05dc\u05e7\u05e6\u05d9\u05d4',
    cv_number: 'KALON \u2014 No.01', cv_name: 'Crystal Veil', cv_vibe: '\u05e0\u05e7\u05d9 \u00b7 \u05d0\u05d5\u05d5\u05e8\u05d9\u05e8\u05d9 \u00b7 \u05e7\u05e8\u05d9\u05e1\u05d8\u05dc\u05d9',
    en_number: 'KALON \u2014 No.02', en_name: 'Encens Noir', en_vibe: '\u05db\u05d4\u05d4 \u00b7 \u05e9\u05e8\u05e4\u05d9 \u00b7 \u05de\u05e6\u05d5\u05d5\u05d4',
    order_now: '\u05d4\u05d6\u05de\u05df \u05e2\u05db\u05e9\u05d9\u05d5', why_eyebrow: '\u05dc\u05de\u05d4 KALON', why_title: '\u05dc\u05de\u05d4 KALON',
    why1_title: '\u05d1\u05d9\u05e6\u05d5\u05e2\u05d9\u05dd \u05de\u05d4\u05d5\u05e0\u05d3\u05e1\u05d9\u05dd', why1_desc: '10\u201312 \u05e9\u05e2\u05d5\u05ea. \u05e0\u05d1\u05d3\u05e7. \u05de\u05ea\u05d5\u05e2\u05d3. \u05e0\u05d9\u05ea\u05df \u05dc\u05d7\u05d6\u05e8\u05d4. \u05dc\u05d0 \u05d8\u05e2\u05e0\u05d4 \u2014 \u05e1\u05d8\u05e0\u05d3\u05e8\u05d8.',
    why2_title: '\u05e7\u05d5\u05de\u05e4\u05d5\u05d6\u05d9\u05e6\u05d9\u05d5\u05ea \u05de\u05e7\u05d5\u05e8\u05d9\u05d5\u05ea', why2_desc: '\u05dc\u05d0 \u05d4\u05e2\u05ea\u05e7. \u05dc\u05d0 \u05d4\u05e9\u05e4\u05e2\u05d4. \u05e2\u05dc\u05d9\u05d9\u05d4 \u2014 \u05d1\u05e0\u05d5\u05d9\u05d4 \u05de-DNA \u05d1\u05e9\u05de\u05d9 \u05d0\u05d2\u05d3\u05d9 \u05dc\u05d6\u05d4\u05d5\u05ea \u05de\u05e9\u05dc\u05d4.',
    why3_title: '\u05e1\u05d8\u05e0\u05d3\u05e8\u05d8. \u05dc\u05d0 \u05de\u05d5\u05e6\u05e8.', why3_desc: '\u05db\u05dc \u05d1\u05e7\u05d1\u05d5\u05e7 \u05e2\u05d5\u05d1\u05e8 \u05d0\u05ea \u05d0\u05d5\u05ea\u05d4 \u05d4\u05d1\u05d3\u05d9\u05e7\u05d4 \u05dc\u05e4\u05e0\u05d9 \u05e9\u05d9\u05e6\u05d0. \u05dc\u05dc\u05d0 \u05d9\u05d5\u05e6\u05d0\u05d9\u05dd \u05de\u05df \u05d4\u05db\u05dc\u05dc. \u05dc\u05dc\u05d0 \u05e4\u05e9\u05e8\u05d5\u05ea.',
    reviews_eyebrow: '\u05d1\u05d3\u05d9\u05e7\u05d5\u05ea \u05e2\u05d8\u05d9\u05d9\u05d4', reviews_title: '\u05de\u05d4 \u05d4\u05dd \u05d0\u05de\u05e8\u05d5',
    review1_text: '\u201c\u05d4\u05d6\u05de\u05e0\u05ea\u05d9 \u05d0\u05ea \u05d4\u05d3\u05d5\u05d0\u05d5 \u05dc\u05d9 \u05d5\u05dc\u05d1\u05e2\u05dc\u05d9. \u05d1\u05d9\u05e6\u05d5\u05e2\u05d9\u05dd 10+. \u05e9\u05e0\u05d9\u05e0\u05d5 \u05e7\u05e1\u05d5\u05de\u05d9\u05dd. \u05de\u05de\u05dc\u05d0 \u05d0\u05ea \u05d4\u05d7\u05d3\u05e8 \u2014 \u05e9\u05d5\u05d0\u05dc\u05d9\u05dd \u05dc\u05e4\u05e0\u05d9 \u05e9\u05d0\u05de\u05e8\u05e0\u05d5 \u05e9\u05dc\u05d5\u05dd.\u201d',
    review1_name: '\u05d9\u05e8\u05d3\u05df \u05d5\u05e7\u05d5\u05d1\u05d9 \u05de.', review1_loc: '\u05de\u05d0\u05d5\u05de\u05ea \u2014 \u05d4\u05d3\u05d5\u05d0\u05d5',
    review2_text: '\u201cCrystal Veil \u05d4\u05d5\u05d0 \u05e7\u05d5\u05dc\u05e7\u05e6\u05d9\u05d4 \u05de\u05e6\u05d5\u05d9\u05e0\u05ea. \u05d0\u05d7\u05d9\u05d5\u05ea\u05d9 \u05d5\u05d7\u05d1\u05e8\u05d5\u05ea \u05d4\u05d6\u05de\u05d9\u05e0\u05d5 \u05d0\u05d7\u05e8\u05d9 \u05e9\u05d4\u05e8\u05d9\u05d7\u05d5 \u05e2\u05dc\u05d9\u05d9.\u201d',
    review2_name: '\u05dc\u05d9\u05e0\u05d4 \u05e2\u05d6\u05d5\u05e8\u05d9', review2_loc: '\u05de\u05d0\u05d5\u05de\u05ea \u2014 Crystal Veil',
    review3_text: '\u201cEncens Noir \u05de\u05e8\u05d9\u05d7 \u05db\u05de\u05d5 \u05de\u05d9\u05dc\u05d9\u05d0\u05e8\u05d3\u05e8 \u05de\u05d3\u05d5\u05d1\u05d0\u05d9. \u05d7\u05d6\u05e7, \u05e2\u05e9\u05d9\u05e8, \u05de\u05e1\u05e2\u05d9\u05e8 \u05d4\u05d4\u05de\u05d5\u05df. \u05e1\u05d5\u05d2 \u05e8\u05d9\u05d7 \u05e9\u05d0\u05e0\u05e9\u05d9\u05dd \u05e2\u05d5\u05e6\u05e8\u05d9\u05dd \u05d5\u05e9\u05d5\u05d0\u05dc\u05d9\u05dd.\u201d',
    review3_name: '\u05d8\u05d0\u05e8\u05e7 \u05e2\u05dc\u05d9', review3_loc: '\u05de\u05d0\u05d5\u05de\u05ea \u2014 Encens Noir',
    wa_eyebrow: '\u05e6\u05d5\u05e8 \u05e7\u05e9\u05e8', wa_title: '\u05e9\u05d0\u05dc\u05d5\u05ea?', wa_sub: '\u05d4\u05e6\u05d5\u05d5\u05ea \u05e9\u05dc\u05e0\u05d5 \u05de\u05d2\u05d9\u05d1 \u05de\u05d4\u05e8.',
    wa_cta: '\u05e6\u05d5\u05e8 \u05e7\u05e9\u05e8 \u05d3\u05e8\u05da \u05d5\u05d5\u05d0\u05d8\u05e1\u05d0\u05e4', os_eyebrow: '\u05e1\u05d9\u05db\u05d5\u05dd \u05d4\u05d6\u05de\u05e0\u05d4',
    os_confirm: '\u05d0\u05e9\u05e8 \u05d4\u05d6\u05de\u05e0\u05d4 \u2190', os_oos_label: '\u05d0\u05d6\u05dc \u05de\u05d4\u05de\u05dc\u05d0\u05d9 \u2014 \u05d4\u05d3\u05d5\u05d0\u05d5',
    email_eyebrow: '\u05d1\u05d9\u05ea KALON', email_title: '\u05d4\u05e6\u05d8\u05e8\u05e3 \u05dc\u05d1\u05d9\u05ea KALON',
    email_sub: '\u05d4\u05d5\u05e6\u05d0\u05d5\u05ea \u05d7\u05d3\u05e9\u05d5\u05ea. \u05ea\u05d5\u05e6\u05d0\u05d5\u05ea \u05d1\u05d3\u05d9\u05e7\u05d5\u05ea. \u05e2\u05d3\u05db\u05d5\u05e0\u05d9 \u05d1\u05d9\u05e6\u05d5\u05e2\u05d9\u05dd. \u05e8\u05d0\u05e9\u05d5\u05df.',
    email_btn: '\u05d4\u05e6\u05d8\u05e8\u05e3 \u05e2\u05db\u05e9\u05d9\u05d5', email_note: '\u05dc\u05dc\u05d0 \u05e1\u05e4\u05d0\u05dd. \u05d1\u05d9\u05d8\u05d5\u05dc \u05d1\u05db\u05dc \u05e2\u05ea.',
    email_ph: '\u05db\u05ea\u05d5\u05d1\u05ea \u05d4\u05d0\u05d9\u05de\u05d9\u05d9\u05dc \u05e9\u05dc\u05da',
    email_joined: '\u2713 \u05d4\u05e6\u05d8\u05e8\u05e4\u05ea. \u05ea\u05e9\u05de\u05e2 \u05de\u05d0\u05d9\u05ea\u05e0\u05d5 \u05e8\u05d0\u05e9\u05d5\u05df.',
    email_popup_done: '\u2713 \u05e1\u05d9\u05d5\u05dd. \u05d1\u05d3\u05d5\u05e7 \u05d0\u05ea \u05ea\u05d9\u05d1\u05ea \u05d4\u05d3\u05d5\u05d0\u05e8 \u05e9\u05dc\u05da.',
    ind_title: '\u05d0\u05d5 \u05d4\u05d6\u05de\u05df \u05d1\u05e0\u05e4\u05e8\u05d3', ind_sub: '\u05d1\u05e7\u05d1\u05d5\u05e7 \u05d0\u05d7\u05d3 \u00b7 \u05dc\u05dc\u05d0 \u05d4\u05e0\u05d7\u05d5\u05ea',
    cv_ind_sub: '\u20aa379 \u00b7 \u05e0\u05e7\u05d9 \u00b7 \u05d0\u05d5\u05d5\u05e8\u05d9\u05e8\u05d9', en_ind_sub: '\u20aa399 \u00b7 \u05db\u05d4\u05d4 \u00b7 \u05de\u05d2\u05e0\u05d8\u05d9',
    ind_order: '\u05d4\u05d6\u05de\u05df', ind_oos_sm: '\u05d0\u05d6\u05dc \u05de\u05d4\u05de\u05dc\u05d0\u05d9',
    form_eyebrow: '\u05d4\u05d6\u05de\u05e0\u05ea KALON', form_title: '\u05e4\u05e8\u05d8\u05d9 \u05d4\u05d4\u05d6\u05de\u05e0\u05d4',
    form_sub: '\u05d4\u05db\u05e0\u05e1 \u05d0\u05ea \u05d4\u05e4\u05e8\u05d8\u05d9\u05dd \u05e9\u05dc\u05da. \u05e0\u05d9\u05e6\u05d5\u05e8 \u05d0\u05d9\u05ea\u05da \u05e7\u05e9\u05e8 \u05ea\u05d5\u05da 24 \u05e9\u05e2\u05d5\u05ea \u05dc\u05d0\u05d9\u05e9\u05d5\u05e8 \u05d5\u05e1\u05d9\u05d3\u05d5\u05e8 \u05d4\u05de\u05e9\u05dc\u05d5\u05d7.',
    form_name: '\u05e9\u05dd \u05de\u05dc\u05d0', form_phone: '\u05d8\u05dc\u05e4\u05d5\u05df', form_email: '\u05d0\u05d9\u05de\u05d9\u05d9\u05dc',
    form_optional: '(\u05d0\u05d5\u05e4\u05e6\u05d9\u05d5\u05e0\u05dc\u05d9)', form_city: '\u05e2\u05d9\u05e8', form_address: '\u05db\u05ea\u05d5\u05d1\u05ea', form_notes: '\u05d4\u05e2\u05e8\u05d5\u05ea \u05d4\u05d6\u05de\u05e0\u05d4',
    form_name_ph: '\u05e9\u05de\u05da \u05d4\u05de\u05dc\u05d0', form_phone_ph: '05XXXXXXXX', form_email_ph: 'example@email.com',
    form_city_ph: '\u05d4\u05e2\u05d9\u05e8 \u05e9\u05dc\u05da', form_address_ph: '\u05e8\u05d7\u05d5\u05d1, \u05d1\u05e0\u05d9\u05d9\u05df, \u05d3\u05d9\u05e8\u05d4',
    form_notes_ph: '\u05e4\u05e8\u05d8\u05d9\u05dd \u05e0\u05d5\u05e1\u05e4\u05d9\u05dd \u05d0\u05d5 \u05d1\u05e7\u05e9\u05d5\u05ea \u05de\u05d9\u05d5\u05d7\u05d3\u05d5\u05ea...',
    form_submit: '\u05d1\u05e6\u05e2 \u05d4\u05d6\u05de\u05e0\u05d4 \u2190',
    form_note: '\u05e0\u05d9\u05e6\u05d5\u05e8 \u05d0\u05d9\u05ea\u05da \u05e7\u05e9\u05e8 \u05ea\u05d5\u05da 24 \u05e9\u05e2\u05d5\u05ea \u05dc\u05d0\u05d9\u05e9\u05d5\u05e8 \u05d4\u05d4\u05d6\u05de\u05e0\u05d4 \u05d5\u05e1\u05d9\u05d3\u05d5\u05e8 \u05d4\u05de\u05e9\u05dc\u05d5\u05d7.',
    form_validation: '\u05d0\u05e0\u05d0 \u05de\u05dc\u05d0 \u05d0\u05ea \u05db\u05dc \u05d4\u05e9\u05d3\u05d5\u05ea \u05d4\u05e0\u05d3\u05e8\u05e9\u05d9\u05dd.',
    form_sending: '\u05e9\u05d5\u05dc\u05d7...', form_oos_error: '\u05d4\u05d3\u05d5\u05d0\u05d5 \u05d0\u05d6\u05dc \u05de\u05d4\u05de\u05dc\u05d0\u05d9 \u05db\u05e8\u05d2\u05e2.',
    form_error: '\u05de\u05e9\u05d4\u05d5 \u05d4\u05e9\u05ea\u05d1\u05e9. \u05d0\u05e0\u05d0 \u05e0\u05e1\u05d4 \u05e9\u05d5\u05d1.', form_oos_single: '\u05de\u05d5\u05e6\u05e8 \u05d6\u05d4 \u05d0\u05d6\u05dc \u05de\u05d4\u05de\u05dc\u05d0\u05d9 \u05db\u05e8\u05d2\u05e2.',
    success_title: '\u05d4\u05d4\u05d6\u05de\u05e0\u05d4 \u05e0\u05e9\u05dc\u05d7\u05d4.', success_sub: '\u05e0\u05d9\u05e6\u05d5\u05e8 \u05d0\u05d9\u05ea\u05da \u05e7\u05e9\u05e8 \u05ea\u05d5\u05da 24 \u05e9\u05e2\u05d5\u05ea \u05dc\u05d0\u05d9\u05e9\u05d5\u05e8 \u05d5\u05e1\u05d9\u05d3\u05d5\u05e8 \u05d4\u05de\u05e9\u05dc\u05d5\u05d7.',
    floating_cta: '\u05d4\u05d6\u05de\u05df \u05d0\u05ea \u05d4\u05d3\u05d5\u05d0\u05d5 \u2014 \u20aa649',
    footer_tagline: '\u05d4\u05d1\u05d9\u05e6\u05d5\u05e2\u05d9\u05dd \u05d4\u05dd \u05d4\u05e4\u05d9\u05e0\u05d5\u05e7 \u05d4\u05d9\u05d7\u05d9\u05d3 \u05e9\u05d7\u05e9\u05d5\u05d1.', footer_copy: '\u00a9 2025 KALON. \u05db\u05dc \u05d4\u05d6\u05db\u05d5\u05d9\u05d5\u05ea \u05e9\u05de\u05d5\u05e8\u05d5\u05ea.',
    hero_headline_html: '\u05d4\u05d1\u05d9\u05e6\u05d5\u05e2\u05d9\u05dd \u05d4\u05dd \u05d4\u05e4\u05d9\u05e0\u05d5\u05e7<br />\u05d4\u05d9\u05d7\u05d9\u05d3 \u05e9\u05d7\u05e9\u05d5\u05d1.',
    hero_sub_html: '\u05d4\u05e8\u05d9\u05d7 \u05e9\u05d4\u05d0\u05e3 \u05e9\u05dc\u05da \u05db\u05d1\u05e8 \u05de\u05db\u05d9\u05e8.<br />\u05e2\u05db\u05e9\u05d9\u05d5 \u05d4\u05d5\u05d0 \u05e1\u05d5\u05e3 \u05e1\u05d5\u05e3 \u05e0\u05e9\u05d0\u05e8.',
    cv_desc_html: '\u05de\u05ea\u05d9\u05e7\u05d5\u05ea \u05d0\u05d5\u05d5\u05e8\u05d9\u05e8\u05d9\u05ea \u05d5\u05d1\u05d4\u05d9\u05e8\u05d5\u05ea \u05e7\u05e8\u05d9\u05e1\u05d8\u05dc\u05d9\u05ea \u2014 \u05d6\u05e2\u05e4\u05e8\u05df, \u05e2\u05e0\u05d1\u05e8 \u05e9\u05e7\u05d5\u05e3, \u05e2\u05e6\u05d9\u05dd \u05e8\u05db\u05d9\u05dd.<br />\u05e7\u05dc \u05d0\u05da \u05e2\u05de\u05d9\u05d3. \u05d4\u05e7\u05e8\u05e0\u05d4 \u05e2\u05d3\u05d9\u05e0\u05d4 \u05e9\u05e0\u05de\u05e9\u05db\u05ea \u05db\u05dc \u05d4\u05d9\u05d5\u05dd.<br />\u05dc\u05de\u05d9 \u05e9\u05ea\u05de\u05d9\u05d3 \u05d6\u05d5\u05db\u05e8\u05d9\u05dd \u05d0\u05d5\u05ea\u05d5, \u05d1\u05dc\u05d9 \u05dc\u05e0\u05e1\u05d5\u05ea.',
    en_desc_html: '\u05e7\u05d8\u05d5\u05e8\u05ea \u05db\u05d4\u05d4, \u05e2\u05d5\u05d3 \u05e1\u05de\u05d9\u05da, \u05ea\u05d1\u05dc\u05d9\u05e0\u05d9\u05dd \u05d7\u05de\u05d9\u05dd \u2014 \u05d4\u05d5\u05d0 \u05e0\u05db\u05e0\u05e1 \u05dc\u05d7\u05d3\u05e8 \u05dc\u05e4\u05e0\u05d9\u05da.<br />\u05e2\u05e6\u05d9\u05dd \u05de\u05e2\u05d5\u05e9\u05e0\u05d9\u05dd \u05d5\u05e2\u05d5\u05de\u05e7 \u05e2\u05d5\u05e8 \u05e9\u05de\u05ea\u05e2\u05e6\u05dd \u05dc\u05d0\u05d5\u05e8\u05da \u05d4\u05dc\u05d9\u05dc\u05d4.<br />\u05db\u05d1\u05d3, \u05d9\u05e7\u05e8, \u05de\u05db\u05d5\u05d5\u05df. \u05dc\u05d0 \u05dc\u05e4\u05d7\u05d3\u05e0\u05d9\u05dd.',
  },
};

function t(key) {
  return (translations[currentLang] && translations[currentLang][key]) ||
         translations.en[key] || key;
}

function applyLanguage(lang) {
  currentLang = lang;
  localStorage.setItem('kalon_lang', lang);
  var isRtl = (lang === 'ar' || lang === 'he');
  document.documentElement.dir  = isRtl ? 'rtl' : 'ltr';
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n], [data-i18n-html]').forEach(function(el) {
    var htmlKey = el.getAttribute('data-i18n-html');
    var key = htmlKey || el.getAttribute('data-i18n');
    if (htmlKey) { el.innerHTML = t(key); } else { el.textContent = t(key); }
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(function(el) {
    el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
  });
  document.querySelectorAll('.lang-btn').forEach(function(btn) {
    btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
  });
}

function initLanguageSwitcher() {
  document.querySelectorAll('.lang-btn').forEach(function(btn) {
    btn.addEventListener('click', function() { applyLanguage(btn.getAttribute('data-lang')); });
  });
  applyLanguage(localStorage.getItem('kalon_lang') || 'en');
}

initLanguageSwitcher();
