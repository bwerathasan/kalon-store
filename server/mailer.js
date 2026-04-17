const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const PRODUCTS = {
  'duo': {
    label: 'The Duo — Crystal Veil + Encens Noir',
    lines: [
      { name: 'Crystal Veil — No.01', price: '₪379' },
      { name: 'Encens Noir — No.02',  price: '₪399' },
      { name: 'Duo Bundle Saving',    price: '−₪129' },
    ],
    total: '₪649',
  },
  'crystal-veil': {
    label: 'Crystal Veil — No.01',
    lines: [
      { name: 'Crystal Veil — No.01', price: '₪379' },
    ],
    total: '₪379',
  },
  'encens-noir': {
    label: 'Encens Noir — No.02',
    lines: [
      { name: 'Encens Noir — No.02', price: '₪399' },
    ],
    total: '₪399',
  },
  'discovery': {
    label: 'Discovery Vial — Both scents · 5ml each',
    lines: [
      { name: 'Discovery Vial (Crystal Veil + Encens Noir · 5ml each)', price: '₪79' },
    ],
    total: '₪79',
  },
};

function getProduct(order) {
  return PRODUCTS[order.product] || PRODUCTS['duo'];
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function sendAdminNotification(order) {
  const prod = getProduct(order);
  await transporter.sendMail({
    from: `"KALON Orders" <${process.env.EMAIL_USER}>`,
    to: process.env.EMAIL_USER,
    subject: `New Order — ${prod.label} — KALON`,
    text: [
      'New order received:',
      '',
      `Name:     ${order.full_name}`,
      `Phone:    ${order.phone}`,
      `Email:    ${order.email || '—'}`,
      `City:     ${order.city}`,
      `Address:  ${order.address}`,
      `Product:  ${prod.label}`,
      `Total:    ${prod.total}`,
      `Notes:    ${order.notes || '—'}`,
      `Time:     ${formatDate(order.created_at)}`,
    ].join('\n'),
  });
}

async function sendCustomerConfirmation(order) {
  if (!order.email) return;

  const prod   = getProduct(order);
  const first  = order.full_name ? order.full_name.split(' ')[0] : '';

  const lineRows = prod.lines.map(l =>
    `<tr>
       <td style="padding:7px 0;color:#555;font-size:14px;">${esc(l.name)}</td>
       <td style="padding:7px 0;text-align:right;font-size:14px;font-weight:600;color:#1a1a1a;">${esc(l.price)}</td>
     </tr>`
  ).join('');

  await transporter.sendMail({
    from: `"KALON" <${process.env.EMAIL_USER}>`,
    to: order.email,
    subject: 'Order received — KALON',
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
</head>
<body style="margin:0;padding:0;background:#f2f2f0;font-family:Georgia,serif;">

  <div style="max-width:520px;margin:40px auto;background:#ffffff;border:1px solid #e0e0dc;">

    <!-- Header -->
    <div style="background:#080808;padding:28px 32px;text-align:center;">
      <p style="margin:0;color:#C9A84C;font-size:22px;font-weight:400;letter-spacing:8px;font-family:Georgia,serif;">KALON</p>
    </div>

    <!-- Body -->
    <div style="padding:36px 40px;">

      <p style="margin:0 0 6px;font-size:16px;font-weight:400;color:#1a1a1a;font-family:Georgia,serif;">
        ${esc(first)},
      </p>
      <p style="margin:0 0 28px;font-size:15px;color:#555;line-height:1.6;font-family:Arial,sans-serif;">
        Your order has been received.<br/>
        We will contact you shortly to confirm delivery.
      </p>

      <!-- Order summary -->
      <div style="border:1px solid #e8e8e4;border-radius:4px;padding:20px 24px;margin-bottom:28px;">
        <p style="margin:0 0 14px;font-size:11px;font-weight:600;letter-spacing:3px;color:#999;text-transform:uppercase;font-family:Arial,sans-serif;">
          Order Summary
        </p>
        <table style="width:100%;border-collapse:collapse;">
          ${lineRows}
          <tr style="border-top:1px solid #e8e8e4;">
            <td style="padding:12px 0 0;font-size:15px;font-weight:600;color:#1a1a1a;font-family:Arial,sans-serif;">Total</td>
            <td style="padding:12px 0 0;text-align:right;font-size:16px;font-weight:700;color:#1a1a1a;font-family:Arial,sans-serif;">${esc(prod.total)}</td>
          </tr>
        </table>
        <p style="margin:14px 0 0;font-size:12px;color:#999;font-family:Arial,sans-serif;">
          Payment: Cash on delivery
        </p>
      </div>

      <!-- Delivery note -->
      <p style="margin:0 0 32px;font-size:13px;color:#888;line-height:1.6;font-family:Arial,sans-serif;">
        Our team will reach out within 24 hours to confirm your order and arrange delivery.
        For any questions, contact us via WhatsApp.
      </p>

      <!-- Brand line -->
      <p style="margin:0;font-size:13px;color:#999;font-style:italic;font-family:Georgia,serif;border-top:1px solid #f0f0ee;padding-top:20px;">
        Performance is the only luxury that matters.
      </p>

    </div>

    <!-- Footer -->
    <div style="background:#f8f8f6;padding:16px 32px;text-align:center;border-top:1px solid #e8e8e4;">
      <p style="margin:0;font-size:11px;color:#bbb;letter-spacing:1px;font-family:Arial,sans-serif;">
        © ${new Date().getFullYear()} KALON
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

  results.forEach((r, i) => {
    const label = i === 0 ? 'admin' : 'customer';
    if (r.status === 'fulfilled') {
      console.log(`[EMAIL] ${label} email sent OK`);
    } else {
      console.error(`[EMAIL] ${label} email FAILED:`, r.reason?.message);
    }
  });
}

module.exports = { sendOrderEmails };
