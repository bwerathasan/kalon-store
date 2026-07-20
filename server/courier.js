const { getProduct, UNIT_PRICE } = require('./mailer');

const OLIVERY_URL      = process.env.OLIVERY_URL;
const OLIVERY_LOGIN    = process.env.OLIVERY_LOGIN;
const OLIVERY_PASSWORD = process.env.OLIVERY_PASSWORD;
const OLIVERY_DB       = process.env.OLIVERY_DB;

// Normalize "+972501234567" / "972501234567" -> "0501234567"
function normalizeMobile(phone) {
  var digits = String(phone || '').replace(/\D/g, '');
  if (digits.indexOf('972') === 0) digits = '0' + digits.slice(3);
  if (digits.length && digits[0] !== '0') digits = '0' + digits;
  return digits;
}

// order.product is "citrus,rouge,sweet" style; reuse mailer's parsing for a
// consistent cost/label instead of re-deriving it here.
function computeCost(order) {
  var raw   = String(order.product || '');
  var count = raw.split(',').map(function(s) { return s.trim(); }).filter(Boolean).length || 1;
  return count * UNIT_PRICE;
}

async function createShipment(order) {
  if (!OLIVERY_URL || !OLIVERY_LOGIN || !OLIVERY_PASSWORD || !OLIVERY_DB) {
    throw new Error('Olivery env vars missing (OLIVERY_URL/LOGIN/PASSWORD/DB)');
  }

  var prod = getProduct(order);

  var payload = {
    jsonrpc: '2.0',
    params: {
      login:            OLIVERY_LOGIN,
      password:         OLIVERY_PASSWORD,
      db:               OLIVERY_DB,
      customer_name:    order.full_name,
      customer_mobile:  normalizeMobile(order.phone),
      customer_area:    order.city,
      customer_address: order.address,
      reference_id:     String(new Date(order.created_at).getTime() || Date.now()),
      cost:             computeCost(order),
      order_type_id:    '1',
      note:             order.notes || '',
      product_note:     prod.label,
    },
  };

  var res = await fetch(OLIVERY_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  });

  var rawText = await res.text();
  console.log('[OLIVERY] HTTP status:', res.status);
  console.log('[OLIVERY] Raw response:', rawText);

  var data;
  try {
    data = JSON.parse(rawText);
  } catch (e) {
    throw new Error('Olivery response was not valid JSON: ' + rawText.slice(0, 300));
  }

  if (data.error) {
    throw new Error('Olivery returned an error: ' + JSON.stringify(data.error));
  }

  // Olivery replies with HTTP 200 even on business-logic failures - the real
  // outcome is nested in result.fail / result.message, not a top-level error.
  if (data.result && data.result.fail) {
    throw new Error('Olivery rejected the order: ' + (data.result.message || JSON.stringify(data.result)));
  }

  return data;
}

module.exports = { createShipment };
