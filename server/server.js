require('dotenv').config();

// ── Env check on startup ──
console.log('[STARTUP] SUPABASE_URL:', process.env.SUPABASE_URL || '*** MISSING ***');
console.log('[STARTUP] SUPABASE_KEY:', process.env.SUPABASE_KEY ? '*** set (hidden) ***' : '*** MISSING ***');
console.log('[STARTUP] PORT:', process.env.PORT || '5000 (default)');

const path       = require('path');
const express    = require('express');
const cors       = require('cors');
const bodyParser = require('body-parser');
const ordersRouter = require('./routes/orders');

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ──
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ── Serve storefront static assets (css, js, images) ──
app.use(express.static(path.join(__dirname, '..')));

// ── Serve admin page at /admin ──
app.use('/admin', express.static(path.join(__dirname, '..', 'admin')));

// ── Root → storefront index.html ──
app.get('/', (_, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// ── GET /api/orders — must be registered BEFORE the router ──
const supabase = require('./supabase');
app.get('/api/orders', async (req, res) => {
  console.log('[GET /api/orders] hit');
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[GET /api/orders] error:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
  console.log('[GET /api/orders] returning', data.length, 'rows');
  return res.json({ success: true, orders: data });
});

// ── Routes ──
app.use('/api/orders', ordersRouter);

// ── Health check ──
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'kalon-server' });
});

// ── 404 handler ──
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Route not found.' });
});

// ── Global error handler ──
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ success: false, error: 'Internal server error.' });
});

// ── Start ──
app.listen(PORT, () => {
  console.log(`KALON server running on http://localhost:${PORT}`);
});
