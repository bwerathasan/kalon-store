const express  = require('express');
const router   = express.Router();
const supabase = require('../supabase');
const { sendOrderEmails } = require('../mailer');

// ── Valid product keys ──
const VALID_PRODUCTS = new Set(['duo', 'crystal-veil', 'encens-noir']);

// ── In-memory rate limiter: 5 submissions per IP per 15 minutes ──
const _ratemap = new Map();
function orderRateLimit(req, res, next) {
  const ip  = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  const rec = _ratemap.get(ip) || { count: 0, resetAt: now + 15 * 60 * 1000 };
  if (now > rec.resetAt) { rec.count = 0; rec.resetAt = now + 15 * 60 * 1000; }
  if (rec.count >= 5) {
    console.warn('[RATE LIMIT] blocked:', ip);
    return res.status(429).json({ success: false, error: 'Too many requests. Please try again later.' });
  }
  rec.count++;
  _ratemap.set(ip, rec);
  next();
}

// POST /api/orders
router.post('/', orderRateLimit, async (req, res) => {
  console.log('\n──────────────────────────────────');
  console.log('[ORDER] Request received at', new Date().toISOString());
  console.log('[ORDER] Body:', JSON.stringify(req.body, null, 2));

  const { full_name, phone, email, city, address, notes, product } = req.body;

  // Validate required fields
  const missing = [];
  if (!full_name || !full_name.trim()) missing.push('full_name');
  if (!phone     || !phone.trim())     missing.push('phone');
  if (!city      || !city.trim())      missing.push('city');
  if (!address   || !address.trim())   missing.push('address');

  if (missing.length > 0) {
    console.warn('[ORDER] Validation failed — missing fields:', missing);
    return res.status(400).json({
      success: false,
      error: `Missing required fields: ${missing.join(', ')}`,
    });
  }

  // Validate product value
  if (product && !VALID_PRODUCTS.has(product)) {
    console.warn('[ORDER] Invalid product value:', product);
    return res.status(400).json({ success: false, error: 'Invalid product.' });
  }

  // ── Stock check + atomic decrement ──
  const skusNeeded = product === 'duo'
    ? ['crystal-veil', 'encens-noir']
    : (product ? [product] : []);

  if (skusNeeded.length > 0) {
    const { data: stockRows, error: stockErr } = await supabase
      .from('inventory')
      .select('product, stock')
      .in('product', skusNeeded);

    if (!stockErr && stockRows) {
      const stockMap = {};
      stockRows.forEach(r => { stockMap[r.product] = r.stock; });

      const oos = skusNeeded.filter(p => (stockMap[p] || 0) < 1);
      if (oos.length > 0) {
        console.warn('[ORDER] Out of stock:', oos);
        return res.status(409).json({
          success: false,
          outOfStock: true,
          error: 'This product is currently out of stock.',
        });
      }

      // Decrement each SKU using optimistic lock (eq on current stock value)
      for (const sku of skusNeeded) {
        const currentStock = stockMap[sku];
        const { data: decremented } = await supabase
          .from('inventory')
          .update({ stock: currentStock - 1, updated_at: new Date().toISOString() })
          .eq('product', sku)
          .eq('stock', currentStock)
          .select('product');

        if (!decremented || decremented.length === 0) {
          console.warn('[ORDER] Stock race condition — treating as OOS:', sku);
          return res.status(409).json({
            success: false,
            outOfStock: true,
            error: 'This product is currently out of stock.',
          });
        }
      }

      console.log('[ORDER] Stock decremented for:', skusNeeded.join(', '));
    } else if (stockErr) {
      console.warn('[ORDER] Stock check failed, proceeding without it:', stockErr.message);
    }
  }

  console.log('[ORDER] Validation passed — inserting into Supabase...');
  console.log('[ORDER] SUPABASE_URL present:', !!process.env.SUPABASE_URL);
  console.log('[ORDER] SUPABASE_KEY present:', !!process.env.SUPABASE_KEY);

  // Insert into Supabase
  const payload = {
    full_name: full_name.trim(),
    phone:     phone.trim(),
    email:     email    ? email.trim()   : null,
    city:      city.trim(),
    address:   address.trim(),
    notes:     notes    ? notes.trim()   : null,
    product:   product  ? product.trim() : null,
  };
  console.log('[ORDER] Insert payload:', JSON.stringify(payload, null, 2));

  let { data, error } = await supabase
    .from('orders')
    .insert([payload])
    .select();

  // If product column doesn't exist yet in DB, retry without it
  if (error && error.code === '42703' && error.message.includes('product')) {
    console.warn('[ORDER] product column missing — retrying without it');
    const { product: _dropped, ...payloadWithoutProduct } = payload;
    ({ data, error } = await supabase
      .from('orders')
      .insert([payloadWithoutProduct])
      .select());
  }

  if (error) {
    console.error('[ORDER] Supabase insert FAILED');
    console.error('[ORDER] Error code:   ', error.code);
    console.error('[ORDER] Error message:', error.message);
    console.error('[ORDER] Error details:', error.details);
    console.error('[ORDER] Error hint:   ', error.hint);
    console.error('[ORDER] Error status: ', error.status);
    console.error('[ORDER] Full error object:');
    console.dir(error, { depth: null });
    console.error('[ORDER] Full error JSON:', JSON.stringify(error, null, 2));
    return res.status(500).json({
      success: false,
      error: 'Failed to save order.',
      debug: { code: error.code, message: error.message, hint: error.hint },
    });
  }

  console.log('[ORDER] Supabase insert SUCCESS');
  console.log('[ORDER] Inserted row:', JSON.stringify(data, null, 2));
  console.log('──────────────────────────────────\n');

  // Send emails — must not crash the request if it fails
  sendOrderEmails(data[0]).catch((err) =>
    console.error('[EMAIL] Unexpected error:', err.message)
  );

  return res.status(201).json({ success: true });
});

// GET /api/orders
router.get('/', async (req, res) => {
  console.log('[ADMIN] Fetching all orders...');

  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[ADMIN] Supabase fetch FAILED:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }

  console.log('[ADMIN] Fetched', data.length, 'orders');
  return res.json({ success: true, orders: data });
});

module.exports = router;
