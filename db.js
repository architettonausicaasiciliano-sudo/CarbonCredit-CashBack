const sqlite3 = require("sqlite3").verbose();
const path = path = require("path");

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
  // Tabella Utenti (Gestione Stripe e Abbonamenti)
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE,
      premium INTEGER DEFAULT 0
    )
  `);

  // Tabella Asset (Registrazione manuale e scansionata)
  db.run(`
    CREATE TABLE IF NOT EXISTS assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_email TEXT NOT NULL,
      item_name TEXT NOT NULL,
      category TEXT NOT NULL,
      source TEXT DEFAULT 'manual',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

module.exports = db;