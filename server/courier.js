const { getProduct, SKU_PRICES } = require('./mailer');

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
  var parts = raw.split(',').map(function(s) { return s.trim().toLowerCase(); }).filter(Boolean);
  var total = parts.reduce(function(sum, sku) { return sum + (SKU_PRICES[sku] || 0); }, 0);
  return total || SKU_PRICES.rouge;
}

var REQUEST_TIMEOUT_MS = 15000;
var MAX_ATTEMPTS       = 3;
var RETRY_DELAY_MS     = 1500;

function sleep(ms) {
  return new Promise(function(resolve) { setTimeout(resolve, ms); });
}

// One HTTP round-trip to Olivery. Throws OliveryHttpError (transient, worth
// retrying — network failure, timeout, 5xx) or a plain Error (permanent —
// bad payload, business-logic rejection) so the retry loop below can tell
// the two apart instead of retrying a rejection that will never succeed.
async function attemptShipment(payload) {
  var controller = new AbortController();
  var timer = setTimeout(function() { controller.abort(); }, REQUEST_TIMEOUT_MS);

  var res;
  try {
    res = await fetch(OLIVERY_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
      signal:  controller.signal,
    });
  } catch (e) {
    var netErr = new Error('Olivery request failed: ' + e.message);
    netErr.transient = true;
    throw netErr;
  } finally {
    clearTimeout(timer);
  }

  var rawText = await res.text();
  console.log('[OLIVERY] HTTP status:', res.status);
  console.log('[OLIVERY] Raw response:', rawText);

  if (res.status >= 500) {
    var httpErr = new Error('Olivery server error (HTTP ' + res.status + '): ' + rawText.slice(0, 300));
    httpErr.transient = true;
    throw httpErr;
  }

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

async function createShipment(order) {
  if (!OLIVERY_URL || !OLIVERY_LOGIN || !OLIVERY_PASSWORD || !OLIVERY_DB) {
    throw new Error('Olivery env vars missing (OLIVERY_URL/LOGIN/PASSWORD/DB)');
  }

  var prod = getProduct(order);

  // reference_id is unique per order row (real DB timestamp, not just Date.now()),
  // so retrying with the same payload is safe — Olivery sees the same reference_id
  // on every attempt rather than creating duplicate shipments per retry.
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

  var lastErr;
  for (var attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await attemptShipment(payload);
    } catch (e) {
      lastErr = e;
      var willRetry = e.transient && attempt < MAX_ATTEMPTS;
      console.warn('[OLIVERY] attempt ' + attempt + '/' + MAX_ATTEMPTS + ' failed for order ' + order.id + ':', e.message, willRetry ? '- retrying' : '- giving up');
      if (!willRetry) break;
      await sleep(RETRY_DELAY_MS * attempt);
    }
  }
  throw lastErr;
}

module.exports = { createShipment };
