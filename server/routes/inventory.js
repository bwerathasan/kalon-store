const express  = require('express');
const router   = express.Router();
const supabase = require('../supabase');
const { sendBackInStockEmail } = require('../mailer');

const PHYSICAL_SKUS = ['citrus', 'rouge', 'sweet'];

// ── GET /api/inventory — public: returns per-SKU availability booleans ──
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('inventory')
    .select('product, stock');

  if (error) {
    console.error('[INVENTORY] fetch error:', error.message);
    // Fail open so the storefront is never broken by an inventory error
    return res.json({
      success:      true,
      availability: { citrus: true, rouge: true, sweet: true },
    });
  }

  const inv = {};
  (data || []).forEach(function(r) { inv[r.product] = r.stock; });

  return res.json({
    success:      true,
    availability: {
      citrus: (inv['citrus'] || 0) > 0,
      rouge:  (inv['rouge']  || 0) > 0,
      sweet:  (inv['sweet']  || 0) > 0,
    },
  });
});

// ── GET /api/inventory/stock — admin only: returns actual counts + waitlist counts ──
router.get('/stock', async (req, res) => {
  if (!req.session || !req.session.adminAuthenticated) {
    return res.status(401).json({ success: false, error: 'Unauthorized.' });
  }

  const [{ data: invData, error: invErr }, { data: wlData }] = await Promise.all([
    supabase.from('inventory').select('product, stock'),
    supabase.from('waitlist').select('product').eq('notified', false),
  ]);

  if (invErr) return res.status(500).json({ success: false, error: invErr.message });

  const stock = {};
  (invData || []).forEach(function(r) { stock[r.product] = r.stock; });

  const waitlist = { citrus: 0, rouge: 0, sweet: 0 };
  (wlData || []).forEach(function(r) {
    if (waitlist[r.product] !== undefined) waitlist[r.product]++;
  });

  return res.json({ success: true, stock, waitlist });
});

// ── POST /api/inventory/restock — admin only ──
router.post('/restock', async (req, res) => {
  if (!req.session || !req.session.adminAuthenticated) {
    return res.status(401).json({ success: false, error: 'Unauthorized.' });
  }

  const { product, quantity } = req.body;

  if (!PHYSICAL_SKUS.includes(product)) {
    return res.status(400).json({ success: false, error: 'Invalid product. Must be citrus, rouge, or sweet.' });
  }

  const qty = parseInt(quantity, 10);
  if (!qty || qty < 1 || qty > 10000) {
    return res.status(400).json({ success: false, error: 'Quantity must be 1–10000.' });
  }

  const { data: before, error: fetchErr } = await supabase
    .from('inventory').select('stock').eq('product', product).single();
  if (fetchErr) return res.status(500).json({ success: false, error: fetchErr.message });

  const prevStock = before ? before.stock : 0;
  const newStock  = prevStock + qty;

  const { error: updateErr } = await supabase
    .from('inventory')
    .update({ stock: newStock, updated_at: new Date().toISOString() })
    .eq('product', product);
  if (updateErr) return res.status(500).json({ success: false, error: updateErr.message });

  console.log(`[RESTOCK] ${product}: ${prevStock} → ${newStock}`);

  if (prevStock === 0) {
    _notifyWaitlist(product).catch(function(err) {
      console.error(`[WAITLIST] notify error for ${product}:`, err.message);
    });
  }

  return res.json({ success: true, product, newStock });
});

// ── POST /api/inventory/set — admin only ──
router.post('/set', async (req, res) => {
  if (!req.session || !req.session.adminAuthenticated) {
    return res.status(401).json({ success: false, error: 'Unauthorized.' });
  }

  const { product, stock } = req.body;

  if (!PHYSICAL_SKUS.includes(product)) {
    return res.status(400).json({ success: false, error: 'Invalid product.' });
  }

  const value = parseInt(stock, 10);
  if (isNaN(value) || value < 0 || value > 10000) {
    return res.status(400).json({ success: false, error: 'Stock must be 0–10000.' });
  }

  const { data: before, error: fetchErr } = await supabase
    .from('inventory').select('stock').eq('product', product).single();
  if (fetchErr) return res.status(500).json({ success: false, error: fetchErr.message });

  const prevStock = before ? before.stock : 0;

  const { error: updateErr } = await supabase
    .from('inventory')
    .update({ stock: value, updated_at: new Date().toISOString() })
    .eq('product', product);
  if (updateErr) return res.status(500).json({ success: false, error: updateErr.message });

  console.log(`[SET] ${product}: ${prevStock} → ${value}`);

  if (prevStock === 0 && value > 0) {
    _notifyWaitlist(product).catch(function(err) {
      console.error(`[WAITLIST] notify error for ${product}:`, err.message);
    });
  }

  return res.json({ success: true, product, newStock: value });
});

// ── POST /api/inventory/reduce — admin only ──
router.post('/reduce', async (req, res) => {
  if (!req.session || !req.session.adminAuthenticated) {
    return res.status(401).json({ success: false, error: 'Unauthorized.' });
  }

  const { product, amount } = req.body;

  if (!PHYSICAL_SKUS.includes(product)) {
    return res.status(400).json({ success: false, error: 'Invalid product.' });
  }

  const qty = parseInt(amount, 10);
  if (isNaN(qty) || qty < 1 || qty > 10000) {
    return res.status(400).json({ success: false, error: 'Amount must be 1–10000.' });
  }

  const { data: before, error: fetchErr } = await supabase
    .from('inventory').select('stock').eq('product', product).single();
  if (fetchErr) return res.status(500).json({ success: false, error: fetchErr.message });

  const prevStock = before ? before.stock : 0;
  const newStock  = Math.max(prevStock - qty, 0);

  const { error: updateErr } = await supabase
    .from('inventory')
    .update({ stock: newStock, updated_at: new Date().toISOString() })
    .eq('product', product);
  if (updateErr) return res.status(500).json({ success: false, error: updateErr.message });

  console.log(`[REDUCE] ${product}: ${prevStock} → ${newStock}`);

  return res.json({ success: true, product, newStock });
});

async function _notifyWaitlist(product) {
  const { data: entries, error } = await supabase
    .from('waitlist')
    .select('id, email')
    .eq('product', product)
    .eq('notified', false);

  if (error || !entries?.length) return;

  await Promise.allSettled(entries.map(function(e) { return sendBackInStockEmail(e.email, product); }));

  const ids = entries.map(function(e) { return e.id; });
  await supabase.from('waitlist').update({ notified: true }).in('id', ids);

  console.log(`[WAITLIST] Notified ${ids.length} users for ${product}`);
}

module.exports = router;
