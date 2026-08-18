const sqlite3 = require("sqlite3").verbose();
const path = require("path");

// Utilizza path.join per evitare problemi di percorso relativo su server come Render
const dbPath = path.join(__dirname, "users.db");

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("DATABASE CONNECTION ERROR:", err.message);
  } else {
    console.log("Connected to SQLite database.");
  }
});

db.serialize(() => {
  // 1. Tabella Utenti (Abbonamento Stripe, Saldo Crediti Carbonio)
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

  // 2. Tabella Azioni Eco & Abitudini Sostenibili
  db.run(`
    CREATE TABLE IF NOT EXISTS eco_actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_email TEXT NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      credits_earned REAL DEFAULT 0.0,
      co2_saved_kg REAL DEFAULT 0.0,
      source TEXT DEFAULT 'manual',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 3. Tabella Transazioni / Cashback & Monetizzazione Crediti
  db.run(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_email TEXT NOT NULL,
      type TEXT NOT NULL, -- 'earn' (guadagno), 'cashback' (riscatto/cashback), 'payout'
      credits REAL NOT NULL,
      amount_eur REAL DEFAULT 0.0,
      status TEXT DEFAULT 'completed',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

module.exports = db;