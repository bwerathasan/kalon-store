const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_KEY;

// Log key identity on startup so we know exactly which key is loaded
console.log('[SUPABASE] URL:', url || '*** MISSING ***');
console.log('[SUPABASE] KEY prefix (first 40 chars):', key ? key.slice(0, 40) : '*** MISSING ***');
console.log('[SUPABASE] KEY role (decoded):', key ? JSON.parse(Buffer.from(key.split('.')[1], 'base64').toString()).role : '*** MISSING ***');

const supabase = createClient(url, key);

module.exports = supabase;
