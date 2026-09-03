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
  // 1. Tabella Utenti (Stripe & Saldi)
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT,
      premium INTEGER DEFAULT 0,
      stripe_customer_id TEXT,
      stripe_connect_id TEXT,
      carbon_credits REAL DEFAULT 0.0,
      cashback_balance REAL DEFAULT 0.0,
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

  // 3. Tabella Credit Batches
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

  // 4. Tabella Data Pools
  db.run(`
    CREATE TABLE IF NOT EXISTS data_pools (
      id TEXT PRIMARY KEY,
      category TEXT,
      status TEXT DEFAULT 'OPEN',
      total_co2_kg REAL DEFAULT 0.0,
      item_count INTEGER DEFAULT 0,
      block_hash TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 5. Tabella Transazioni
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

  // 6. Tabella B2B Buyers
  db.run(`
    CREATE TABLE IF NOT EXISTS b2b_buyers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_name TEXT NOT NULL,
      vat_number TEXT,
      email TEXT NOT NULL UNIQUE,
      webhook_url TEXT,
      macro_category TEXT NOT NULL,
      price_per_kg_co2 REAL NOT NULL DEFAULT 0.10,
      monthly_budget_limit REAL DEFAULT 0.00,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      auto_invoice BOOLEAN NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (!err) seedB2bBuyers();
  });

  // 7. Tabella Payout Requests (Riscatto Guadagni / Stripe Connect)
  db.run(`
    CREATE TABLE IF NOT EXISTS payout_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      email TEXT NOT NULL,
      amount REAL NOT NULL,
      payout_method TEXT DEFAULT 'STRIPE_CONNECT',
      destination TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      processed_at DATETIME
    )
  `, (err) => {
    if (!err) console.log("✅ Tabella payout_requests pronta.");
  });

  // Migrazione automatica colonne per eco_actions
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
          db.run(`ALTER TABLE eco_actions ADD COLUMN ${col.name} ${col.type}`);
        }
      });
    }
  });

  // Migrazione automatica colonne per users
  db.all("PRAGMA table_info(users)", [], (err, rows) => {
    if (!err && rows) {
      const existing = rows.map((r) => r.name);
      if (!existing.includes("cashback_balance")) {
        db.run("ALTER TABLE users ADD COLUMN cashback_balance REAL DEFAULT 0.0");
      }
      if (!existing.includes("stripe_connect_id")) {
        db.run("ALTER TABLE users ADD COLUMN stripe_connect_id TEXT");
      }
    }
  });
});

function seedB2bBuyers() {
  db.get(`SELECT COUNT(*) AS count FROM b2b_buyers`, [], (err, row) => {
    if (err || !row) return;
    if (row.count === 0) {
      const insertQuery = `
        INSERT INTO b2b_buyers (company_name, vat_number, email, webhook_url, macro_category, price_per_kg_co2)
        VALUES 
        ('Green Mobility Corp', 'IT12345678901', 'mobility-buyer@test.com', 'https://webhook.site/mobility-demo', 'MOBILITY', 0.12),
        ('EcoEnergy Global Ltd', 'IT98765432109', 'energy-buyer@test.com', 'https://webhook.site/energy-demo', 'ENERGY', 0.10)
      `;
      db.run(insertQuery);
    }
  });
}

module.exports = db;