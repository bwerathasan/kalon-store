// Run once to set initial stock in Supabase:
//   node server/scripts/seed-stock.js
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const supabase = require('../supabase');

const INITIAL = [
  { product: 'citrus', stock: 40  },
  { product: 'rouge',  stock: 130 },
  { product: 'sweet',  stock: 40  },
];

(async () => {
  for (const row of INITIAL) {
    const { error } = await supabase
      .from('inventory')
      .upsert({ product: row.product, stock: row.stock, updated_at: new Date().toISOString() },
               { onConflict: 'product' });
    if (error) {
      console.error(`[SEED] FAILED ${row.product}:`, error.message);
    } else {
      console.log(`[SEED] ${row.product} → ${row.stock} units`);
    }
  }
  console.log('[SEED] Done.');
})();
