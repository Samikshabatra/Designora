// server.js — Decoryx Backend
// Auth:    /api/register, /api/login, /api/me  (SQLite + bcryptjs + JWT)
// History: /api/history (GET/POST/DELETE)
// Images:  /api/replicate/predictions
// Chat:    /api/chat → Llama 3 70B via Replicate

const { createServer } = require('http');
const { readFileSync, writeFileSync, existsSync, mkdirSync } = require('fs');
const { join } = require('path');
const crypto = require('crypto');

// ── Load .env.local ───────────────────────────────────────────────────────
try {
  const envFile = readFileSync(join(__dirname, '.env.local'), 'utf8');
  envFile.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) return;
    process.env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
  });
  console.log('✅  Loaded .env.local');
} catch (_) { console.log('ℹ️   Using system env vars'); }

const TOKEN = process.env.REPLICATE_API_TOKEN;
if (!TOKEN) { console.error('❌  REPLICATE_API_TOKEN not set'); process.exit(1); }

const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');

// Razorpay config
const RZP_KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const RZP_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
if (RZP_KEY_ID) console.log('✅  Razorpay Key:', RZP_KEY_ID.slice(0, 12) + '...');
console.log(`✅  Token: ${TOKEN.slice(0, 8)}...`);

// ── sql.js Setup (pure-JS SQLite — no C++ compiler needed!) ───────────────
const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');

const DB_PATH = join(__dirname, 'designora.db');
let db;

async function initDB() {
  const SQL = await initSqlJs();

  // Load existing DB from file or create new
  if (existsSync(DB_PATH)) {
    const fileBuffer = readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
    console.log('✅  Loaded existing database (designora.db)');
  } else {
    db = new SQL.Database();
    console.log('✅  Created new database (designora.db)');
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      credits INTEGER DEFAULT 10,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS designs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      image_url TEXT NOT NULL,
      prompt TEXT,
      room_type TEXT,
      style TEXT,
      budget TEXT,
      budget_value INTEGER,
      original_image TEXT,
      breakdown TEXT,
      total_estimated_cost INTEGER,
      scanned_products TEXT,
      rating INTEGER DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Migrate: add rating column if missing (for existing DBs)
  try { db.run('ALTER TABLE designs ADD COLUMN rating INTEGER DEFAULT NULL'); } catch (_) {}
  saveDB();
  console.log('✅  Tables ready');
}

// Persist DB to disk
function saveDB() {
  const data = db.export();
  const buffer = Buffer.from(data);
  writeFileSync(DB_PATH, buffer);
}

// ── Image Storage ─────────────────────────────────────────────────────────
const UPLOADS_DIR = join(__dirname, 'uploads');
if (!existsSync(UPLOADS_DIR)) mkdirSync(UPLOADS_DIR, { recursive: true });

// Download image from URL and save locally, returns local path
async function downloadImage(imageUrl, prefix) {
  if (!imageUrl || !imageUrl.startsWith('http')) return imageUrl;
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) return imageUrl; // fallback to original URL
    const buffer = Buffer.from(await res.arrayBuffer());

    // Determine extension from content-type
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const ext = contentType.includes('png') ? '.png' : contentType.includes('webp') ? '.webp' : '.jpg';
    const filename = prefix + '_' + Date.now() + ext;

    writeFileSync(join(UPLOADS_DIR, filename), buffer);
    console.log('  📸 Saved image:', filename, '(' + Math.round(buffer.length / 1024) + 'KB)');
    return '/api/images/' + filename;
  } catch (err) {
    console.error('  ⚠️  Image download failed:', err.message);
    return imageUrl; // fallback to original URL if download fails
  }
}

// ── Helper: query rows ────────────────────────────────────────────────────
function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function queryOne(sql, params = []) {
  const rows = queryAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

function runSQL(sql, params = []) {
  db.run(sql, params);
  saveDB();
  return { lastId: db.exec("SELECT last_insert_rowid()")[0]?.values[0]?.[0] || 0 };
}

// ── JWT ────────────────────────────────────────────────────────────────────
function createJWT(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 7 * 24 * 3600
  })).toString('base64url');
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

function verifyJWT(token) {
  try {
    const [header, body, sig] = token.split('.');
    const expected = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
    if (sig !== expected) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
}

function getUserFromRequest(req) {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const payload = verifyJWT(auth.slice(7));
  if (!payload) return null;
  return queryOne('SELECT id, email, name, credits FROM users WHERE id = ?', [payload.userId]);
}

// ── HTTP Helpers ───────────────────────────────────────────────────────────
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > 50e6) reject(new Error('Body too large')); });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : null); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

function jsonRes(res, code, data) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

async function replicateFetch(path, method, body) {
  const opts = {
    method,
    headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json', 'Prefer': 'wait=25' },
  };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`https://api.replicate.com${path}`, opts);
  const j = await r.json();
  return { status: r.status, json: j };
}

// ── Llama 3 chat ──────────────────────────────────────────────────────────
async function llamaChat(systemPrompt, messages) {
  let prompt = `<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\n${systemPrompt}<|eot_id|>`;
  for (const m of messages) {
    const role = m.role === 'assistant' ? 'assistant' : 'user';
    prompt += `<|start_header_id|>${role}<|end_header_id|>\n\n${m.content}<|eot_id|>`;
  }
  prompt += '<|start_header_id|>assistant<|end_header_id|>\n\n';

  const res = await fetch('https://api.replicate.com/v1/models/meta/meta-llama-3-70b-instruct/predictions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json', 'Prefer': 'wait=60' },
    body: JSON.stringify({
      input: { prompt, max_new_tokens: 600, temperature: 0.7, top_p: 0.9, stop_sequences: '<|eot_id|>' },
    }),
  });

  const pred = await res.json();
  if (!res.ok) throw new Error(pred.detail || `Llama error: ${res.status}`);

  if (pred.status !== 'succeeded') {
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 3000));
      const poll = await fetch(`https://api.replicate.com/v1/predictions/${pred.id}`, {
        headers: { 'Authorization': `Bearer ${TOKEN}` },
      });
      const p = await poll.json();
      if (p.status === 'succeeded') return Array.isArray(p.output) ? p.output.join('') : p.output;
      if (p.status === 'failed') throw new Error(p.error || 'Llama generation failed');
    }
    throw new Error('Chat timed out');
  }
  return Array.isArray(pred.output) ? pred.output.join('') : pred.output;
}

// ══════════════════════════════════════════════════════════════════════════
// START SERVER AFTER DB INIT
// ══════════════════════════════════════════════════════════════════════════
initDB().then(() => {

  createServer(async (req, res) => {
    cors(res);
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    const url = req.url || '';

    try {

      // ── AUTH ───────────────────────────────────────────────────────────

      if (req.method === 'POST' && url === '/api/register') {
        const body = await readBody(req);
        const { email, password, name } = body || {};
        if (!email || !email.includes('@'))
          return jsonRes(res, 400, { error: 'Valid email is required.' });
        if (!password || password.length < 6)
          return jsonRes(res, 400, { error: 'Password must be at least 6 characters.' });

        const existing = queryOne('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
        if (existing)
          return jsonRes(res, 409, { error: 'An account with this email already exists.' });

        const hash = await bcrypt.hash(password, 10);
        const displayName = name || email.split('@')[0];
        const { lastId } = runSQL(
          'INSERT INTO users (email, name, password_hash, credits) VALUES (?, ?, ?, 10)',
          [email.toLowerCase(), displayName, hash]
        );

        const token = createJWT({ userId: lastId });
        return jsonRes(res, 201, {
          token,
          user: { id: lastId, email: email.toLowerCase(), name: displayName, credits: 10 }
        });
      }

      if (req.method === 'POST' && url === '/api/login') {
        const body = await readBody(req);
        const { email, password } = body || {};
        if (!email || !password)
          return jsonRes(res, 400, { error: 'Email and password are required.' });

        const user = queryOne('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
        if (!user) return jsonRes(res, 401, { error: 'Invalid email or password.' });

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return jsonRes(res, 401, { error: 'Invalid email or password.' });

        const token = createJWT({ userId: user.id });
        return jsonRes(res, 200, {
          token,
          user: { id: user.id, email: user.email, name: user.name, credits: user.credits }
        });
      }

      if (req.method === 'GET' && url === '/api/me') {
        const user = getUserFromRequest(req);
        if (!user) return jsonRes(res, 401, { error: 'Not authenticated.' });
        return jsonRes(res, 200, { user });
      }

      if (req.method === 'PUT' && url === '/api/me/credits') {
        const user = getUserFromRequest(req);
        if (!user) return jsonRes(res, 401, { error: 'Not authenticated.' });
        const body = await readBody(req);
        if (typeof body?.credits !== 'number')
          return jsonRes(res, 400, { error: 'credits must be a number.' });
        runSQL('UPDATE users SET credits = ? WHERE id = ?', [body.credits, user.id]);
        return jsonRes(res, 200, { credits: body.credits });
      }

      // ── DESIGN HISTORY ────────────────────────────────────────────────

      if (req.method === 'POST' && url === '/api/history') {
        const user = getUserFromRequest(req);
        if (!user) return jsonRes(res, 401, { error: 'Not authenticated.' });

        const b = await readBody(req);

        // Download image to local storage so it never expires
        const localImageUrl = await downloadImage(b.imageUrl, 'design_' + user.id);

        const { lastId } = runSQL(`
          INSERT INTO designs (user_id, image_url, prompt, room_type, style, budget, budget_value,
            original_image, breakdown, total_estimated_cost, scanned_products)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          user.id, localImageUrl || '', b.prompt || '', b.roomType || '', b.style || '',
          b.budget || '', b.budgetValue || 0, b.originalImage || null,
          b.breakdown ? JSON.stringify(b.breakdown) : null,
          b.totalEstimatedCost || 0,
          b.scannedProducts ? JSON.stringify(b.scannedProducts) : null
        ]);
        return jsonRes(res, 201, { id: lastId, imageUrl: localImageUrl });
      }

      if (req.method === 'GET' && url.startsWith('/api/history')) {
        const user = getUserFromRequest(req);
        if (!user) return jsonRes(res, 401, { error: 'Not authenticated.' });

        const designs = queryAll(
          'SELECT * FROM designs WHERE user_id = ? ORDER BY created_at DESC LIMIT 100', [user.id]
        );

        return jsonRes(res, 200, {
          designs: designs.map(d => ({
            id: d.id.toString(),
            imageUrl: d.image_url,
            prompt: d.prompt,
            timestamp: d.created_at ? new Date(d.created_at).getTime() : Date.now(),
            roomType: d.room_type,
            style: d.style,
            budget: d.budget,
            budgetValue: d.budget_value,
            originalImage: d.original_image,
            breakdown: d.breakdown ? JSON.parse(d.breakdown) : null,
            totalEstimatedCost: d.total_estimated_cost,
            scannedProducts: d.scanned_products ? JSON.parse(d.scanned_products) : null,
            rating: d.rating || null,
          }))
        });
      }

      const delMatch = url.match(/^\/api\/history\/(\d+)$/);
      if (req.method === 'DELETE' && delMatch) {
        const user = getUserFromRequest(req);
        if (!user) return jsonRes(res, 401, { error: 'Not authenticated.' });
        runSQL('DELETE FROM designs WHERE id = ? AND user_id = ?', [+delMatch[1], user.id]);
        return jsonRes(res, 200, { deleted: true });
      }

      // ── DESIGN RATING ─────────────────────────────────────────────────
      const ratingMatch = url.match(/^\/api\/designs\/(\d+)\/rating$/);
      if (req.method === 'PATCH' && ratingMatch) {
        const user = getUserFromRequest(req);
        if (!user) return jsonRes(res, 401, { error: 'Not authenticated.' });
        const body = await readBody(req);
        const rating = parseInt(body?.rating);
        if (!rating || rating < 1 || rating > 5)
          return jsonRes(res, 400, { error: 'rating must be 1-5.' });
        runSQL('UPDATE designs SET rating = ? WHERE id = ? AND user_id = ?', [rating, +ratingMatch[1], user.id]);
        return jsonRes(res, 200, { id: +ratingMatch[1], rating });
      }

      // ── RAZORPAY PAYMENTS ─────────────────────────────────────────

      // POST /api/create-order — create Razorpay order
      if (req.method === 'POST' && url === '/api/create-order') {
        const user = getUserFromRequest(req);
        if (!user) return jsonRes(res, 401, { error: 'Not authenticated.' });

        const body = await readBody(req);
        const { plan, amount, credits } = body || {};
        if (!amount || !credits) return jsonRes(res, 400, { error: 'amount and credits required.' });

        // Create order via Razorpay Orders API
        const auth = Buffer.from(RZP_KEY_ID + ':' + RZP_KEY_SECRET).toString('base64');
        const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
          method: 'POST',
          headers: { 'Authorization': 'Basic ' + auth, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: amount * 100, // Razorpay wants paise
            currency: 'INR',
            receipt: 'designora_' + user.id + '_' + Date.now(),
            notes: { plan: plan || '', userId: user.id.toString(), credits: credits.toString() },
          }),
        });
        const order = await rzpRes.json();
        if (!rzpRes.ok) return jsonRes(res, 500, { error: order.error?.description || 'Failed to create order' });

        return jsonRes(res, 200, {
          orderId: order.id,
          amount: order.amount,
          currency: order.currency,
          keyId: RZP_KEY_ID,
        });
      }

      // POST /api/verify-payment — verify and add credits
      if (req.method === 'POST' && url === '/api/verify-payment') {
        const user = getUserFromRequest(req);
        if (!user) return jsonRes(res, 401, { error: 'Not authenticated.' });

        const body = await readBody(req);
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, credits } = body || {};

        // Verify signature
        const expectedSig = crypto.createHmac('sha256', RZP_KEY_SECRET)
          .update(razorpay_order_id + '|' + razorpay_payment_id)
          .digest('hex');

        if (expectedSig !== razorpay_signature) {
          return jsonRes(res, 400, { error: 'Payment verification failed. Invalid signature.' });
        }

        // Add credits to user
        const newCredits = (user.credits || 0) + (credits || 0);
        runSQL('UPDATE users SET credits = ? WHERE id = ?', [newCredits, user.id]);

        return jsonRes(res, 200, {
          success: true,
          credits: newCredits,
          paymentId: razorpay_payment_id,
        });
      }

      // ── SERVE STORED IMAGES ──────────────────────────────────────────

      const imgMatch = url.match(/^\/api\/images\/([^/?]+)$/);
      if (req.method === 'GET' && imgMatch) {
        const filename = imgMatch[1];
        // Security: prevent path traversal
        if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
          res.writeHead(400); res.end('Bad request'); return;
        }
        const filePath = join(UPLOADS_DIR, filename);
        if (!existsSync(filePath)) { res.writeHead(404); res.end('Not found'); return; }

        const ext = filename.split('.').pop().toLowerCase();
        const mimeTypes = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
        const contentType = mimeTypes[ext] || 'application/octet-stream';

        const data = readFileSync(filePath);
        res.writeHead(200, {
          'Content-Type': contentType,
          'Content-Length': data.length,
          'Cache-Control': 'public, max-age=31536000', // cache 1 year — images don't change
        });
        res.end(data);
        return;
      }

      // ── REPLICATE PROXY ───────────────────────────────────────────────

      if (req.method === 'POST' && url === '/api/replicate/predictions') {
        const body = await readBody(req);
        let endpoint = '/v1/predictions';
        if (body.model) {
          endpoint = `/v1/models/${body.model}/predictions`;
          delete body.model;
        }
        const { status, json: j } = await replicateFetch(endpoint, 'POST', body);
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(j));
        return;
      }

      const pollMatch = url.match(/^\/api\/replicate\/predictions\/([^/?]+)$/);
      if (req.method === 'GET' && pollMatch) {
        const { status, json: j } = await replicateFetch(`/v1/predictions/${pollMatch[1]}`, 'GET', null);
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(j));
        return;
      }

      // ── CHAT ──────────────────────────────────────────────────────────

      if (req.method === 'POST' && url === '/api/chat') {
        const body = await readBody(req);
        const { messages, designContext } = body;

        const lastUserMsg = [...(messages || [])].reverse().find(m => m.role === 'user');
        const changeKeywords = ['change', 'make it', 'add', 'remove', 'replace', 'swap', 'update',
          'modify', 'different color', 'darker', 'lighter', 'more plants', 'less', 'put', 'use',
          'switch', 'turn', 'paint', 'move', 'redesign', 'redo', 'regenerate', 'new look'];
        const userText = (lastUserMsg?.content || '').toLowerCase();
        const isChangeRequest = designContext.isChangeRequest ||
          changeKeywords.some(kw => userText.includes(kw));

        const systemPrompt = `You are an expert Indian interior designer and product advisor for Designora.
The user has a ${designContext.style} ${designContext.roomType} design with a budget of ${designContext.budget}.

Your ONLY role is to give advice and product recommendations. You do NOT change or regenerate designs.
When asked to change the design, politely explain that to change the design they should use the Generate button, and instead offer specific product alternatives.

Guidelines:
- Give specific, actionable advice tailored to Indian homes and Indian market products
- Always suggest 2-3 specific products with estimated price ranges in Indian Rupees
- Mention where to find them: Amazon India, Flipkart, or IKEA India
- Keep responses concise — max 3 short paragraphs
- Budget tier: ${designContext.budget}
- Style: ${designContext.style}
- Focus on what will actually look great in a ${designContext.roomType}

Format product suggestions clearly like:
**Product Name** (₹XX,XXX – ₹XX,XXX) — available on Amazon, Flipkart`;

        const reply = await llamaChat(systemPrompt, messages);
        return jsonRes(res, 200, {
          reply: reply.trim(),
          changeDetected: false,
          changePrompt: undefined,
        });
      }

      // ── IMAGE PROXY — server-side fetch to avoid CORS on external URLs ──
      if (req.method === 'GET' && url.startsWith('/api/proxy-image?')) {
        const qs = url.split('?')[1] || '';
        const params = new URLSearchParams(qs);
        const imgUrl = params.get('url');
        if (!imgUrl) { res.writeHead(400); res.end('Missing url param'); return; }
        try {
          const upstream = await fetch(imgUrl);
          if (!upstream.ok) { res.writeHead(502); res.end('Upstream failed'); return; }
          const contentType = upstream.headers.get('content-type') || 'image/jpeg';
          const buffer = Buffer.from(await upstream.arrayBuffer());
          res.writeHead(200, {
            'Content-Type': contentType,
            'Content-Length': buffer.length,
            'Cache-Control': 'public, max-age=3600',
          });
          res.end(buffer);
        } catch(err) {
          res.writeHead(500); res.end('Proxy error: ' + err.message);
        }
        return;
      }

      // ── HEALTH ────────────────────────────────────────────────────────

      if (url === '/api/health') {
        const users = queryOne('SELECT COUNT(*) as c FROM users');
        const designCount = queryOne('SELECT COUNT(*) as c FROM designs');
        return jsonRes(res, 200, {
          status: 'ok',
          auth: 'sql.js + bcryptjs + jwt',
          chat: 'llama-3-70b',
          images: 'flux-1.1-pro + adirik/interior-design',
          users: users?.c || 0,
          designs: designCount?.c || 0,
        });
      }

      res.writeHead(404); res.end('Not found');
    } catch (err) {
      console.error('Server error:', err.message);
      jsonRes(res, 500, { detail: err.message });
    }
  }).listen(3001, () => {
    console.log('✅  Backend at http://localhost:3001');
    console.log('    /api/register, /api/login — Auth');
    console.log('    /api/me                   — Current user');
    console.log('    /api/history              — Design history');
    console.log('    /api/replicate/*          — Image generation');
    console.log('    /api/chat                 — Llama 3 70B');
  });

}).catch(err => {
  console.error('❌  Failed to initialize database:', err);
  process.exit(1);
});

