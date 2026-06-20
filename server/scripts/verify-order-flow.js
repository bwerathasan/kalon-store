// Verifies the full order flow: check stock → submit order → confirm stock decremented
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const supabase = require('../supabase');

async function getStock() {
  const { data, error } = await supabase.from('inventory').select('product, stock').order('product');
  if (error) { console.error('Stock read failed:', error.message); return null; }
  const out = {};
  data.forEach(function(r) { out[r.product] = r.stock; });
  return out;
}

async function submitOrder(payload) {
  const res = await fetch('http://localhost:5000/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

(async () => {
  console.log('\n══════════════════════════════════');
  console.log(' SILLAGE — Order Flow Verification');
  console.log('══════════════════════════════════\n');

  // 1. Stock before
  const before = await getStock();
  console.log('Stock BEFORE order:');
  console.log('  citrus:', before.citrus);
  console.log('  rouge: ', before.rouge);
  console.log('  sweet: ', before.sweet);

  // 2. Submit test order: citrus x2 + rouge x1
  const payload = {
    full_name: 'Test User',
    phone:     '0501234567',
    email:     'test@sillage.store',
    city:      'Ramallah',
    address:   'Test Street 1',
    notes:     'Automated verification order',
    product:   'citrus,citrus,rouge',   // citrus x2 + rouge x1
  };

  console.log('\nSubmitting test order:', payload.product);
  const result = await submitOrder(payload);
  console.log('API response:', JSON.stringify(result));

  if (!result.success) {
    console.error('\nOrder failed — cannot verify stock change.');
    process.exit(1);
  }

  // 3. Stock after
  const after = await getStock();
  console.log('\nStock AFTER order:');
  console.log('  citrus:', after.citrus, '  (expected', before.citrus - 2, ')');
  console.log('  rouge: ', after.rouge,  '  (expected', before.rouge  - 1, ')');
  console.log('  sweet: ', after.sweet,  '  (no change expected)');

  // 4. Assert
  const ok =
    after.citrus === before.citrus - 2 &&
    after.rouge  === before.rouge  - 1 &&
    after.sweet  === before.sweet;

  console.log('\nResult:', ok ? '✓ PASS — inventory decremented correctly' : '✗ FAIL — mismatch');

  console.log('\n══════════════════════════════════\n');
  process.exit(ok ? 0 : 1);
})();
