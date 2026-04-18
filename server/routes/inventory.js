const express  = require('express');
const router   = express.Router();
const supabase = require('../supabase');
const { sendBackInStockEmail } = require('../mailer');

const PHYSICAL_SKUS = ['crystal-veil', 'encens-noir'];

// ── GET /api/inventory — public: returns availability booleans only ──
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('inventory')
    .select('product, stock');

  if (error) {
    console.error('[INVENTORY] fetch error:', error.message);
    // Fail open so the public site is never broken by an inventory error
    return res.json({
      success: true,
      availability: { 'crystal-veil': true, 'encens-noir': true, 'duo': true },
    });
  }

  const inv = {};
  (data || []).forEach(r => { inv[r.product] = r.stock; });

  const cv  = (inv['crystal-veil'] || 0) > 0;
  const en  = (inv['encens-noir']  || 0) > 0;

  return res.json({
    success: true,
    availability: { 'crystal-veil': cv, 'encens-noir': en, 'duo': cv && en },
  });
});

// ── GET /api/inventory/stock — admin only: returns actual numbers + waitlist counts ──
router.get('/stock', async (req, res) => {
  if (!req.session || !req.session.adminAuthenticated) {
    return res.status(401).json({ success: false, error: 'Unauthorized.' });
  }

  const [{ data: invData, error: invErr }, { data: wlData, error: wlErr }] = await Promise.all([
    supabase.from('inventory').select('product, stock'),
    supabase.from('waitlist').select('product').eq('notified', false),
  ]);

  if (invErr) return res.status(500).json({ success: false, error: invErr.message });

  const stock = {};
  (invData || []).forEach(r => { stock[r.product] = r.stock; });

  const waitlist = { 'crystal-veil': 0, 'encens-noir': 0, 'duo': 0 };
  (wlData || []).forEach(r => { if (waitlist[r.product] !== undefined) waitlist[r.product]++; });

  return res.json({ success: true, stock, waitlist });
});

// ── POST /api/inventory/restock — admin only ──
router.post('/restock', async (req, res) => {
  if (!req.session || !req.session.adminAuthenticated) {
    return res.status(401).json({ success: false, error: 'Unauthorized.' });
  }

  const { product, quantity } = req.body;

  if (!PHYSICAL_SKUS.includes(product)) {
    return res.status(400).json({ success: false, error: 'Invalid product. Must be crystal-veil or encens-noir.' });
  }

  const qty = parseInt(quantity, 10);
  if (!qty || qty < 1 || qty > 10000) {
    return res.status(400).json({ success: false, error: 'Quantity must be 1–10000.' });
  }

  // Get current stock
  const { data: before, error: fetchErr } = await supabase
    .from('inventory')
    .select('stock')
    .eq('product', product)
    .single();

  if (fetchErr) return res.status(500).json({ success: false, error: fetchErr.message });

  const prevStock = before ? before.stock : 0;
  const newStock  = prevStock + qty;

  // Update stock
  const { error: updateErr } = await supabase
    .from('inventory')
    .update({ stock: newStock, updated_at: new Date().toISOString() })
    .eq('product', product);

  if (updateErr) return res.status(500).json({ success: false, error: updateErr.message });

  console.log(`[RESTOCK] ${product}: ${prevStock} → ${newStock}`);

  // If this product was OOS before, notify its waitlist
  if (prevStock === 0) {
    _notifyWaitlist(product).catch(err =>
      console.error(`[WAITLIST] notify error for ${product}:`, err.message)
    );

    // If duo is now available (other product already in stock), notify duo waitlist too
    const other = product === 'crystal-veil' ? 'encens-noir' : 'crystal-veil';
    const { data: otherRow } = await supabase
      .from('inventory').select('stock').eq('product', other).single();

    if (otherRow && otherRow.stock > 0) {
      _notifyWaitlist('duo').catch(err =>
        console.error('[WAITLIST] duo notify error:', err.message)
      );
    }
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
    _notifyWaitlist(product).catch(err =>
      console.error(`[WAITLIST] notify error for ${product}:`, err.message)
    );
    const other = product === 'crystal-veil' ? 'encens-noir' : 'crystal-veil';
    const { data: otherRow } = await supabase
      .from('inventory').select('stock').eq('product', other).single();
    if (otherRow && otherRow.stock > 0) {
      _notifyWaitlist('duo').catch(err =>
        console.error('[WAITLIST] duo notify error:', err.message)
      );
    }
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

  await Promise.allSettled(entries.map(e => sendBackInStockEmail(e.email, product)));

  const ids = entries.map(e => e.id);
  await supabase.from('waitlist').update({ notified: true }).in('id', ids);

  console.log(`[WAITLIST] Notified ${ids.length} users for ${product}`);
}

module.exports = router;
