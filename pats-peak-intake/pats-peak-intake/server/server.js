import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import axios from 'axios';
import { lookupSchema, intakeSchema } from './validators.js';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "default-src": ["'self'"],
      "script-src": ["'self'"],
      "style-src": ["'self'", "'unsafe-inline'"],
      "img-src": ["'self'", 'data:']
    }
  }
}));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '200kb' }));
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') || true, credentials: false }));

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', limiter);

app.use(express.static(path.join(__dirname, '../public')));

// ---------- API: Lookup (Step 1) ----------
app.post('/api/lookup', async (req, res) => {
  const { error, value } = lookupSchema.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(400).json({ error: error.details.map(d => d.message).join('; ') });
  }

  // MOCK mode for testing without upstream
  if (String(process.env.MOCK_MODE).toLowerCase() === 'true') {
    const mockMatches = mockLookup(value);
    return res.json({ matches: mockMatches });
  }

  try {
    // Use POST body for lookup to avoid leaking PII in URLs
    const url = process.env.TARGET_API_SEARCH_URL;
    const outbound = {
      first_name: value.firstName,
      last_name: value.lastName,
      dob: value.dob,
      zip: value.zip,
      phone: value.phone
    };

    const response = await axios.post(url, outbound, {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.TARGET_API_KEY}`
      }
    });

    const matchesRaw = Array.isArray(response.data) ? response.data
                     : Array.isArray(response.data?.results) ? response.data.results
                     : [];
    const matches = matchesRaw.map(normalizeGuest);

    return res.json({ matches });
  } catch (err) {
    const code = err.response?.status || 502;
    const msg = err.response?.data?.error || err.message || 'Upstream error';
    return res.status(code).json({ error: `Upstream error: ${msg}` });
  }
});

// ---------- API: Intake (Step 2) ----------
app.post('/api/intake', async (req, res) => {
  const { error, value } = intakeSchema.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(400).json({ error: error.details.map(d => d.message).join('; ') });
  }

  // MOCK mode: short-circuit with success
  if (String(process.env.MOCK_MODE).toLowerCase() === 'true') {
    return res.status(200).json({ ok: true, ref: `MOCK-${Date.now()}` });
  }

  const outboundPayload = {
    guest_id: value.guestId || null,
    first_name: value.firstName,
    last_name: value.lastName,
    dob: value.dob,
    zip: value.zip,
    phone: value.phone,
    skier_type: value.skierType,
    weight_lbs: value.weightLbs,
    height_in: value.heightIn,
    shoe_size_us: value.shoeSize,
    email: value.email,
    source: 'pats-peak-web',
    site: process.env.SITE_LABEL || 'PatsPeak'
  };

  try {
    const response = await axios.post(process.env.TARGET_API_URL, outboundPayload, {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.TARGET_API_KEY}`
      }
    });

    return res.status(200).json({ ok: true, ref: response.data?.id ?? null });
  } catch (err) {
    const code = err.response?.status || 502;
    const msg = err.response?.data?.error || err.message || 'Upstream error';
    return res.status(code).json({ error: `Upstream error: ${msg}` });
  }
});

// ---------- Health & Fallback ----------
app.get('/api/health', (req, res) => res.json({ ok: true, ts: new Date().toISOString() }));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server listening on http://localhost:${port}`));

// ---------- Helpers ----------
function normalizeGuest(g) {
  return {
    id: g.id ?? g.guest_id ?? null,
    firstName: g.first_name ?? g.firstName ?? '',
    lastName: g.last_name ?? g.lastName ?? '',
    dob: g.dob ?? '',
    zip: g.zip ?? '',
    phone: g.phone ?? '',
    email: g.email ?? ''
  };
}

function mockLookup(value) {
  const base = {
    firstName: value.firstName,
    lastName: value.lastName,
    dob: value.dob,
    zip: value.zip,
    phone: value.phone,
    email: 'guest@example.com'
  };
  if ((value.lastName || '').toLowerCase() === 'test') {
    return [
      { id: 'G-1001', ...base, email: 'test1@example.com' },
      { id: 'G-1002', ...base, email: 'test2@example.com' }
    ];
  }
  return [{ id: 'G-9999', ...base }];
}
