CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password TEXT,
  premium INTEGER DEFAULT 0,
  stripe_customer_id TEXT,
  carbon_credits REAL DEFAULT 0.0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS eco_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_email TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  credits_earned REAL DEFAULT 0.0,
  co2_saved_kg REAL DEFAULT 0.0,
  source TEXT DEFAULT 'manual',
  image_hash TEXT,
  tier TEXT DEFAULT 'COMMUNITY',
  confidence_score REAL DEFAULT 0.0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_email TEXT NOT NULL,
  type TEXT NOT NULL,
  credits REAL NOT NULL,
  amount_eur REAL DEFAULT 0.0,
  status TEXT DEFAULT 'completed',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);