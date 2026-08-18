const sqlite3 = require("sqlite3").verbose();

// database locale file-based
const db = new sqlite3.Database("./users.db");

// crea tabella utenti
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE,
      premium INTEGER DEFAULT 0
    )
  `);
});

module.exports = db;