const express  = require('express');
const router   = express.Router();
const supabase = require('../supabase');
const { sendOrderEmails } = require('../mailer');

// POST /api/orders
router.post('/', async (req, res) => {
  console.log('\n──────────────────────────────────');
  console.log('[ORDER] Request received at', new Date().toISOString());
  console.log('[ORDER] Body:', JSON.stringify(req.body, null, 2));

  const { full_name, phone, email, city, address, notes } = req.body;

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
  };
  console.log('[ORDER] Insert payload:', JSON.stringify(payload, null, 2));

  const { data, error } = await supabase
    .from('orders')
    .insert([payload])
    .select();

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
