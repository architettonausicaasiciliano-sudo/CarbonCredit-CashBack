const sqlite3 = require("sqlite3").verbose();
const path = require("path");

// Percorso assoluto al file del database SQLite
const dbPath = path.join(__dirname, "users.db");

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("❌ ERRORE CONNESSIONE DATABASE:", err.message);
  } else {
    console.log("⚡ Connesso al database SQLite (users.db).");
  }
});

db.serialize(() => {
  // 1. Tabella Utenti (Stripe & Saldo Crediti Carbonio)
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT,
      premium INTEGER DEFAULT 0,
      stripe_customer_id TEXT,
      carbon_credits REAL DEFAULT 0.0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 2. Tabella Azioni Eco & dMRV Verification Engine
  db.run(`
    CREATE TABLE IF NOT EXISTS eco_actions (
      id TEXT PRIMARY KEY,
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
      pool_id TEXT,
      receipt_hash TEXT,
      ticket_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 3. Tabella Credit Batches (gestione lotti CO2 Tier 2 / B2B)
  db.run(`
    CREATE TABLE IF NOT EXISTS credit_batches (
      id TEXT PRIMARY KEY,
      batch_code TEXT,
      target_co2_kg REAL DEFAULT 50000.0,
      total_co2_kg REAL DEFAULT 0.0,
      status TEXT DEFAULT 'OPEN',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 4. Tabella Data Pools (sigillatura crittografica SHA-256 e dossier dMRV)
  db.run(`
    CREATE TABLE IF NOT EXISTS data_pools (
      id TEXT PRIMARY KEY,
      category TEXT,
      status TEXT DEFAULT 'OPEN',
      total_co2_kg REAL DEFAULT 0.0,
      block_hash TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 5. Tabella Transazioni & Payout Cashback
  db.run(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_email TEXT NOT NULL,
      type TEXT NOT NULL,
      credits REAL NOT NULL,
      amount_eur REAL DEFAULT 0.0,
      status TEXT DEFAULT 'completed',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Migrazione automatica colonne dMRV e B2B per database esistenti
  const dMrvColumns = [
    { name: "image_hash", type: "TEXT" },
    { name: "tier", type: "TEXT DEFAULT 'COMMUNITY'" },
    { name: "confidence_score", type: "REAL DEFAULT 0.0" },
    { name: "amount_spend", type: "REAL DEFAULT 0.0" },
    { name: "cashback_credit", type: "REAL DEFAULT 0.0" },
    { name: "batch_id", type: "TEXT" },
    { name: "pool_id", type: "TEXT" },
    { name: "receipt_hash", type: "TEXT" },
    { name: "ticket_id", type: "TEXT" }
  ];

  db.all("PRAGMA table_info(eco_actions)", [], (err, rows) => {
    if (!err && rows) {
      const existingColumns = rows.map((r) => r.name);
      dMrvColumns.forEach((col) => {
        if (!existingColumns.includes(col.name)) {
          db.run(`ALTER TABLE eco_actions ADD COLUMN ${col.name} ${col.type}`, (alterErr) => {
            if (alterErr) {
              console.error(`⚠️ Errore aggiunta colonna ${col.name}:`, alterErr.message);
            } else {
              console.log(`✅ Colonna '${col.name}' aggiunta a eco_actions.`);
            }
          });
        }
      });
    }
  });
});

module.exports = db;