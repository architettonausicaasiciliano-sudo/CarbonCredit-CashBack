-- 1. Tabella Utenti
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password TEXT,
  premium INTEGER DEFAULT 0,
  stripe_customer_id TEXT,
  carbon_credits REAL DEFAULT 0.0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabella Azioni Eco & Motore Forensics dMRV
CREATE TABLE IF NOT EXISTS eco_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_email TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  credits_earned REAL DEFAULT 0.0,
  co2_saved_kg REAL DEFAULT 0.0,
  amount_spend REAL DEFAULT 0.0,
  cashback_credit REAL DEFAULT 0.0,
  source TEXT DEFAULT 'manual',
  image_hash TEXT,
  tier TEXT DEFAULT 'COMMUNITY',
  confidence_score REAL DEFAULT 0.0,
  batch_id TEXT,
  pool_id INTEGER,
  receipt_hash TEXT,
  ticket_id TEXT,
  status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabella Data Pools B2B
CREATE TABLE IF NOT EXISTS data_pools (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  status TEXT DEFAULT 'BUILDING',
  total_co2_kg REAL DEFAULT 0.0,
  item_count INTEGER DEFAULT 0,
  block_hash TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. Tabella Credit Batches
CREATE TABLE IF NOT EXISTS credit_batches (
  id TEXT PRIMARY KEY,
  batch_code TEXT,
  target_co2_kg REAL DEFAULT 50000.0,
  total_co2_kg REAL DEFAULT 0.0,
  status TEXT DEFAULT 'OPEN',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5. Tabella Transazioni & Payout
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_email TEXT NOT NULL,
  type TEXT NOT NULL,
  credits REAL NOT NULL,
  amount_eur REAL DEFAULT 0.0,
  status TEXT DEFAULT 'completed',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);