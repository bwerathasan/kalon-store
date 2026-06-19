require('dotenv').config();

// ── Env check on startup ──
console.log('[STARTUP] SUPABASE_URL:', process.env.SUPABASE_URL || '*** MISSING ***');
console.log('[STARTUP] SUPABASE_KEY:', process.env.SUPABASE_KEY ? '*** set (hidden) ***' : '*** MISSING ***');
console.log('[STARTUP] PORT:', process.env.PORT || '5000 (default)');
console.log('[STARTUP] ADMIN_PASSWORD:', process.env.ADMIN_PASSWORD ? '*** set ***' : '*** MISSING ***');
console.log('[STARTUP] SESSION_SECRET:', process.env.SESSION_SECRET ? '*** set ***' : '*** MISSING ***');

const path         = require('path');
const express      = require('express');
const cors         = require('cors');
const bodyParser   = require('body-parser');
const session      = require('express-session');
const ordersRouter    = require('./routes/orders');
const inventoryRouter = require('./routes/inventory');
const waitlistRouter  = require('./routes/waitlist');

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Trust proxy (nginx terminates SSL on Hostinger) ──
app.set('trust proxy', 1);

// ── Core middleware ──
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ── Session ──
app.use(session({
  secret:            process.env.SESSION_SECRET || 'kalon-fallback-secret',
  resave:            false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'strict',
    maxAge:   8 * 60 * 60 * 1000, // 8 hours
  },
}));

// ── Admin auth helper ──
function requireAdminAuth(req, res, next) {
  if (req.session && req.session.adminAuthenticated) return next();
  res.redirect('/admin/login');
}

// ── Admin login page (public — no auth required) ──
app.get('/admin/login', (req, res) => {
  if (req.session && req.session.adminAuthenticated) return res.redirect('/admin/');
  res.sendFile(path.join(__dirname, '..', 'admin', 'login.html'));
});

// ── Admin login handler ──
app.post('/admin/login', (req, res) => {
  const { password } = req.body;
  const expected     = process.env.ADMIN_PASSWORD;

  if (!expected) {
    console.error('[ADMIN AUTH] ADMIN_PASSWORD env var is not set');
    return res.status(500).send('Server configuration error.');
  }

  if (password === expected) {
    req.session.adminAuthenticated = true;
    return res.redirect('/admin/');
  }

  res.redirect('/admin/login?error=1');
});

// ── Admin logout ──
app.get('/admin/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/admin/login'));
});

// ── Admin pages — protected ──
app.use('/admin', requireAdminAuth);
app.use('/admin', express.static(path.join(__dirname, '..', 'admin')));

// ── Public storefront static assets ──
// NOTE: this comes AFTER admin auth middleware so /admin is never served directly here
app.use(express.static(path.join(__dirname, '..'), {
  index: false, // prevent static from auto-serving admin/index.html for /admin
}));

// ── Root → storefront index.html ──
app.get('/', (_, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

app.get('/ar', (_, res) => {
  res.sendFile(path.join(__dirname, '..', 'ar', 'index.html'));
});

// ── GET /api/orders — must be registered BEFORE the router ──
const supabase = require('./supabase');
app.get('/api/orders', async (req, res) => {
  if (!req.session || !req.session.adminAuthenticated) {
    return res.status(401).json({ success: false, error: 'Unauthorized.' });
  }
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
app.use('/api/orders',    ordersRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/waitlist',  waitlistRouter);

// ── Health check ──
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'sillage-server' });
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
  console.log(`SILLAGE server running on http://localhost:${PORT}`);
});
