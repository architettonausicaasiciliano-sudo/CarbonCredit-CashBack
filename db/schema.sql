-- Tabella per tracciare le singole azioni certificate
CREATE TABLE IF NOT EXISTS eco_actions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    image_hash TEXT UNIQUE NOT NULL,
    tier TEXT NOT NULL,
    co2_kg REAL NOT NULL,
    confidence INTEGER NOT NULL,
    batch_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (batch_id) REFERENCES credit_batches(id)
);

-- Tabella per i Lotti B2B (Smart Pool)
CREATE TABLE IF NOT EXISTS credit_batches (
    id TEXT PRIMARY KEY,
    batch_code TEXT UNIQUE NOT NULL,
    total_co2_kg REAL DEFAULT 0.0,
    target_co2_kg REAL DEFAULT 50000.0, -- Soglia 50 Tonnellate
    status TEXT DEFAULT 'OPEN',          -- OPEN, LOCKED, SOLD
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);