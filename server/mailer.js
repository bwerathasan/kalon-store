const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('ar-EG', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

async function sendAdminNotification(order) {
  await transporter.sendMail({
    from: `"KALON Orders" <${process.env.EMAIL_USER}>`,
    to: process.env.EMAIL_USER,
    subject: '🚀 طلب جديد - KALON',
    text: [
      'طلب جديد وصل:',
      '',
      `الاسم:     ${order.full_name}`,
      `الهاتف:    ${order.phone}`,
      `البريد:    ${order.email || '—'}`,
      `المدينة:   ${order.city}`,
      `العنوان:   ${order.address}`,
      `ملاحظات:  ${order.notes || '—'}`,
      `الوقت:     ${formatDate(order.created_at)}`,
    ].join('\n'),
  });
}

async function sendCustomerConfirmation(order) {
  if (!order.email) return; // skip if no email provided

  await transporter.sendMail({
    from: `"KALON | فن العطر الفاخر" <${process.env.EMAIL_USER}>`,
    to: order.email,
    subject: 'تم استلام طلبك - KALON',
    html: `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head><meta charset="UTF-8"/></head>
<body style="font-family:Arial,sans-serif;background:#f9f9f9;padding:32px;direction:rtl;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;">

    <div style="background:#1a1a1a;padding:24px;text-align:center;">
      <p style="color:#C9A84C;font-size:26px;font-weight:700;letter-spacing:4px;margin:0;">KALON</p>
      <p style="color:#aaa;font-size:12px;margin:6px 0 0;">فن العطر الفاخر</p>
    </div>

    <div style="padding:28px 32px;">
      <p style="font-size:18px;font-weight:700;margin:0 0 8px;">أهلاً ${order.full_name ? order.full_name.split(' ')[0] : ''} 👋</p>
      <p style="color:#555;margin:0 0 24px;">شكراً لطلبكِ من KALON. تم استلام طلبك وسنتواصل معكِ قريباً لتأكيد الطلب وترتيب التوصيل.</p>

      <div style="background:#f4f4f5;border-radius:8px;padding:20px;margin-bottom:24px;">
        <p style="font-weight:700;margin:0 0 12px;font-size:14px;">تفاصيل طلبك:</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="padding:6px 0;color:#555;">SILLAG NOIR — No.01</td><td style="text-align:left;font-weight:600;">199₪</td></tr>
          <tr><td style="padding:6px 0;color:#555;">OMBRE CLAIR — No.02</td><td style="text-align:left;font-weight:600;">249₪</td></tr>
          <tr><td style="padding:6px 0;color:#888;font-style:italic;">Rouge Musk 🎁 هدية مجانية</td><td style="text-align:left;color:#888;">—</td></tr>
          <tr style="border-top:1px dashed #ccc;">
            <td style="padding:10px 0 0;font-weight:700;">السعر النهائي</td>
            <td style="padding:10px 0 0;text-align:left;font-weight:700;font-size:16px;">399₪</td>
          </tr>
        </table>
        <p style="margin:12px 0 0;font-size:13px;color:#555;">طريقة الدفع: <strong>الدفع عند الاستلام</strong></p>
      </div>

      <p style="color:#888;font-size:13px;margin:0;">للاستفسار تواصلي معنا عبر واتساب.<br/>نتمنى لكِ تجربة مميزة مع KALON ✨</p>
    </div>

    <div style="background:#f4f4f5;padding:16px;text-align:center;">
      <p style="color:#aaa;font-size:12px;margin:0;">© 2025 KALON. جميع الحقوق محفوظة.</p>
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
