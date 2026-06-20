require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const supabase = require('../supabase');

(async () => {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) { console.error('Failed:', error.message); return; }

  console.log('\nLatest order in Supabase:');
  console.log('  ID:        ', data.id);
  console.log('  Name:      ', data.full_name);
  console.log('  Phone:     ', data.phone);
  console.log('  City:      ', data.city);
  console.log('  Product:   ', data.product);
  console.log('  Created:   ', data.created_at);
})();
