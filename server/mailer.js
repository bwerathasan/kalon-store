const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const FROM     = `"SILLAGE" <${process.env.EMAIL_USER}>`;
const ADMIN_TO = process.env.EMAIL_USER;

const SKU_LABELS = {
  citrus: 'Sillage Citrus',
  rouge:  'Sillage Rouge',
  sweet:  'Sillage Sweet',
};

const SKU_PRICES = {
  rouge:  200,
  citrus: 269,
  sweet:  285,
};

// Flat-price overrides for specific SKU combos, checked before the naive
// per-unit sum below. Key is the SKU parts sorted + comma-joined, so order
// in the submitted "product" string doesn't matter.
const BUNDLE_PRICES = {
  'rouge,rouge,rouge': 400, // Rouge 3-pack (Maram offer): pay for 2 at 200 each, 3rd is a free gift
};
const BUNDLE_LABELS = {
  'rouge,rouge,rouge': 'Sillage Rouge × 3 (قنينتين + هدية مجاناً — عرض مرام)',
};

// Single source of truth for order totals — used by both the email total
// below and Olivery's COD collection amount (server/courier.js), so the
// two can never drift apart.
function computeTotal(parts) {
  var key = parts.slice().sort().join(',');
  if (Object.prototype.hasOwnProperty.call(BUNDLE_PRICES, key)) return BUNDLE_PRICES[key];
  return parts.reduce(function(sum, sku) { return sum + (SKU_PRICES[sku] || 0); }, 0);
}

function esc(str) {
  return String(str || '')
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;');
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// Parse "citrus,rouge,sweet" into { label, lines, total }
function getProduct(order) {
  var raw = order.product || '';
  var parts = raw.split(',').map(function(s) { return s.trim().toLowerCase(); })
                            .filter(function(s) { return SKU_LABELS[s]; });

  if (!parts.length) {
    return { label: raw || 'Sillage Collection', lines: [], total: '₪—' };
  }

  // Count per SKU
  var counts = {};
  parts.forEach(function(s) { counts[s] = (counts[s] || 0) + 1; });

  var lines = Object.keys(counts).map(function(sku) {
    var count = counts[sku];
    return { name: SKU_LABELS[sku] + (count > 1 ? ' × ' + count : ''), price: '' };
  });

  var bundleKey = parts.slice().sort().join(',');
  var label = BUNDLE_LABELS[bundleKey] || Object.keys(counts).map(function(sku) {
    var count = counts[sku];
    return SKU_LABELS[sku] + (count > 1 ? ' × ' + count : '');
  }).join(' + ');

  var price = computeTotal(parts);

  return { label: label, lines: lines, total: '₪' + price };
}

async function sendAdminNotification(order) {
  const prod = getProduct(order);
  await transporter.sendMail({
    from:    FROM,
    to:      ADMIN_TO,
    subject: `New Order — ${prod.label} — SILLAGE`,
    text: [
      'New order received:',
      '',
      `Name:      ${order.full_name}`,
      `Phone:     ${order.phone}`,
      `Email:     ${order.email || '—'}`,
      `City:      ${order.city}`,
      `Address:   ${order.address}`,
      `Selection: ${prod.label}`,
      `Total:     ${prod.total}`,
      `Notes:     ${order.notes || '—'}`,
      `Time:      ${formatDate(order.created_at)}`,
    ].join('\n'),
  });
}

async function sendCustomerConfirmation(order) {
  if (!order.email) return;

  const prod  = getProduct(order);
  const first = order.full_name ? order.full_name.split(' ')[0] : '';

  const lineRows = prod.lines.map(function(l) {
    return `<tr>
      <td style="padding:7px 0;color:#555;font-size:14px;">${esc(l.name)}</td>
      <td style="padding:7px 0;text-align:right;font-size:14px;font-weight:600;color:#1a1a1a;"></td>
    </tr>`;
  }).join('');

  await transporter.sendMail({
    from:    FROM,
    to:      order.email,
    subject: 'Order received — SILLAGE',
    html: `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
</head>
<body style="margin:0;padding:0;background:#f2f2f0;font-family:Arial,sans-serif;">

  <div style="max-width:520px;margin:40px auto;background:#ffffff;border:1px solid #e0e0dc;">

    <div style="background:#080808;padding:28px 32px;text-align:center;">
      <p style="margin:0;color:#C9A84C;font-size:22px;font-weight:400;letter-spacing:8px;font-family:Georgia,serif;">SILLAGE</p>
    </div>

    <div style="padding:36px 40px;">

      <p style="margin:0 0 6px;font-size:16px;font-weight:400;color:#1a1a1a;font-family:Arial,sans-serif;">
        ${esc(first)},
      </p>
      <p style="margin:0 0 28px;font-size:15px;color:#555;line-height:1.6;font-family:Arial,sans-serif;">
        تم استلام طلبك.<br/>سنتواصل معك قريباً لترتيب التوصيل.
      </p>

      <div style="border:1px solid #e8e8e4;border-radius:4px;padding:20px 24px;margin-bottom:28px;">
        <p style="margin:0 0 14px;font-size:11px;font-weight:600;letter-spacing:2px;color:#999;text-transform:uppercase;font-family:Arial,sans-serif;">
          ملخص الطلب
        </p>
        <table style="width:100%;border-collapse:collapse;">
          ${lineRows}
          <tr style="border-top:1px solid #e8e8e4;">
            <td style="padding:12px 0 0;font-size:15px;font-weight:600;color:#1a1a1a;font-family:Arial,sans-serif;">المجموع</td>
            <td style="padding:12px 0 0;text-align:right;font-size:16px;font-weight:700;color:#1a1a1a;font-family:Arial,sans-serif;">${esc(prod.total)}</td>
          </tr>
        </table>
        <p style="margin:14px 0 0;font-size:12px;color:#999;font-family:Arial,sans-serif;">
          الدفع عند الاستلام &nbsp;•&nbsp; توصيل مجاني
        </p>
      </div>

      <p style="margin:0 0 32px;font-size:13px;color:#888;line-height:1.6;font-family:Arial,sans-serif;">
        سيتواصل معك فريقنا خلال ٢٤ ساعة لتأكيد الطلب وترتيب التوصيل.
      </p>

    </div>

    <div style="background:#f8f8f6;padding:16px 32px;text-align:center;border-top:1px solid #e8e8e4;">
      <p style="margin:0;font-size:11px;color:#bbb;letter-spacing:1px;font-family:Arial,sans-serif;">
        © ${new Date().getFullYear()} SILLAGE
      </p>
    </div>

  </div>

</body>
</html>`,
  });
}

async function sendOrderEmails(order) {
  const results = await Promise.allSettled([
    sendAdminNotification(order),
    sendCustomerConfirmation(order),
  ]);

  results.forEach(function(r, i) {
    const label = i === 0 ? 'admin' : 'customer';
    if (r.status === 'fulfilled') {
      console.log(`[EMAIL] ${label} email sent OK`);
    } else {
      console.error(`[EMAIL] ${label} email FAILED:`, r.reason && r.reason.message);
    }
  });
}

const BACK_IN_STOCK_LABELS = {
  citrus: { name: 'Sillage Citrus', url: 'https://sillagescentt.com' },
  rouge:  { name: 'Sillage Rouge',  url: 'https://sillagescentt.com' },
  sweet:  { name: 'Sillage Sweet',  url: 'https://sillagescentt.com' },
};

async function sendBackInStockEmail(email, product) {
  const p = BACK_IN_STOCK_LABELS[product];
  if (!p) return;

  await transporter.sendMail({
    from:    FROM,
    to:      email,
    subject: `Back in stock — ${p.name} — SILLAGE`,
    html: `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f2f2f0;font-family:Arial,sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#ffffff;border:1px solid #e0e0dc;">

    <div style="background:#080808;padding:28px 32px;text-align:center;">
      <p style="margin:0;color:#C9A84C;font-size:22px;font-weight:400;letter-spacing:8px;font-family:Georgia,serif;">SILLAGE</p>
    </div>

    <div style="padding:36px 40px;">
      <p style="margin:0 0 20px;font-size:15px;color:#1a1a1a;line-height:1.6;font-family:Arial,sans-serif;">
        <strong>${esc(p.name)}</strong> متوفر مجدداً.
      </p>
      <p style="margin:0 0 28px;font-size:14px;color:#555;line-height:1.6;font-family:Arial,sans-serif;">
        طلبت أن نُبلغك. الكمية محدودة — اطلب الآن لتضمن حصتك.
      </p>

      <a href="${p.url}"
         style="display:inline-block;padding:14px 32px;background:#080808;color:#ffffff;text-decoration:none;font-family:Arial,sans-serif;font-size:13px;font-weight:600;letter-spacing:1px;">
        اطلب الآن — ₪${SKU_PRICES[product] || ''}
      </a>
    </div>

    <div style="background:#f8f8f6;padding:16px 32px;text-align:center;border-top:1px solid #e8e8e4;">
      <p style="margin:0;font-size:11px;color:#bbb;letter-spacing:1px;font-family:Arial,sans-serif;">
        © ${new Date().getFullYear()} SILLAGE — تلقيت هذا البريد لأنك طلبت التنبيه عند التوفر.
      </p>
    </div>

  </div>
</body>
</html>`,
  });
}

module.exports = { sendOrderEmails, sendBackInStockEmail, getProduct, SKU_PRICES, computeTotal };
