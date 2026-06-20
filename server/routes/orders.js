const express  = require('express');
const router   = express.Router();
const supabase = require('../supabase');
const { sendOrderEmails } = require('../mailer');

// ── Valid individual SKUs ──
const VALID_SKUS = new Set(['citrus', 'rouge', 'sweet']);

// ── Parse and validate product string ("citrus" / "citrus,rouge" / "citrus,rouge,sweet") ──
function parseSelections(product) {
  if (!product || typeof product !== 'string') return null;
  var parts = product.split(',').map(function(s) { return s.trim().toLowerCase(); });
  if (parts.length < 1 || parts.length > 3) return null;
  if (!parts.every(function(p) { return VALID_SKUS.has(p); })) return null;
  return parts;
}

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

  // Validate product: must be comma-separated string of exactly 3 valid SKUs
  const selections = parseSelections(product);
  if (!selections) {
    console.warn('[ORDER] Invalid product selection:', product);
    return res.status(400).json({ success: false, error: 'Invalid product selection. Must be 1–3 items from: citrus, rouge, sweet.' });
  }

  // Count needed per SKU (e.g. citrus×2, rouge×1)
  const skuCounts = {};
  selections.forEach(function(sku) { skuCounts[sku] = (skuCounts[sku] || 0) + 1; });
  const skusNeeded = Object.keys(skuCounts);

  console.log('[ORDER] Selection:', skuCounts);

  // ── Stock check + atomic decrement ──
  const { data: stockRows, error: stockErr } = await supabase
    .from('inventory')
    .select('product, stock')
    .in('product', skusNeeded);

  if (!stockErr && stockRows) {
    const stockMap = {};
    stockRows.forEach(function(r) { stockMap[r.product] = r.stock; });

    // Check sufficient stock for each SKU
    const oos = skusNeeded.filter(function(sku) { return (stockMap[sku] || 0) < skuCounts[sku]; });
    if (oos.length > 0) {
      console.warn('[ORDER] Out of stock:', oos);
      return res.status(409).json({
        success:    false,
        outOfStock: true,
        error:      'This product is currently out of stock.',
      });
    }

    // Decrement each SKU by its count using optimistic lock
    for (const sku of skusNeeded) {
      const count        = skuCounts[sku];
      const currentStock = stockMap[sku];
      const { data: decremented } = await supabase
        .from('inventory')
        .update({ stock: currentStock - count, updated_at: new Date().toISOString() })
        .eq('product', sku)
        .eq('stock', currentStock)   // optimistic lock: fail if changed concurrently
        .select('product');

      if (!decremented || decremented.length === 0) {
        console.warn('[ORDER] Stock race condition — treating as OOS:', sku);
        return res.status(409).json({
          success:    false,
          outOfStock: true,
          error:      'This product is currently out of stock.',
        });
      }
    }

    console.log('[ORDER] Stock decremented for:', JSON.stringify(skuCounts));
  } else if (stockErr) {
    console.warn('[ORDER] Stock check failed, proceeding without it:', stockErr.message);
  }

  console.log('[ORDER] Validation passed — inserting into Supabase...');

  // Insert order — product field stores the full selection string ("citrus,rouge,sweet")
  const payload = {
    full_name: full_name.trim(),
    phone:     phone.trim(),
    email:     email   ? email.trim()   : null,
    city:      city.trim(),
    address:   address.trim(),
    notes:     notes   ? notes.trim()   : null,
    product:   product.trim(),
  };

  const { data, error } = await supabase
    .from('orders')
    .insert([payload])
    .select();

  if (error) {
    console.error('[ORDER] Supabase insert FAILED:', error.message);
    return res.status(500).json({
      success: false,
      error:   'Failed to save order.',
      debug:   { code: error.code, message: error.message },
    });
  }

  console.log('[ORDER] Supabase insert SUCCESS:', JSON.stringify(data));
  console.log('──────────────────────────────────\n');

  sendOrderEmails(data[0]).catch(function(err) {
    console.error('[EMAIL] Unexpected error:', err.message);
  });

  return res.status(201).json({ success: true });
});

// GET /api/orders — admin only (handled in server.js before this router)
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[ADMIN] Supabase fetch FAILED:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }

  return res.json({ success: true, orders: data });
});

module.exports = router;
