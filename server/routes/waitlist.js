const express  = require('express');
const router   = express.Router();
const supabase = require('../supabase');

const VALID_PRODUCTS = new Set(['citrus', 'rouge', 'sweet']);

// POST /api/waitlist
router.post('/', async (req, res) => {
  const { email, product } = req.body;

  if (!email || !email.includes('@') || email.trim().length > 254) {
    return res.status(400).json({ success: false, error: 'Valid email required.' });
  }

  if (!VALID_PRODUCTS.has(product)) {
    return res.status(400).json({ success: false, error: 'Invalid product.' });
  }

  const { error } = await supabase
    .from('waitlist')
    .insert([{ email: email.trim().toLowerCase(), product }]);

  if (error) {
    // Unique constraint violation = already on active waitlist for this product
    if (error.code === '23505') {
      return res.json({ success: true, already: true });
    }
    console.error('[WAITLIST] insert error:', error.message);
    return res.status(500).json({ success: false, error: 'Could not save. Please try again.' });
  }

  console.log(`[WAITLIST] ${email} added for ${product}`);
  return res.json({ success: true });
});

module.exports = router;
