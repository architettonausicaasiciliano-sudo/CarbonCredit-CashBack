const db = require("../../db");
const crypto = require("crypto");

// Helper promisificati per gestire SQLite in modo sincrono con async/await
const dbGet = (sql, params = []) => new Promise((res, rej) => db.get(sql, params, (err, row) => err ? rej(err) : res(row)));
const dbAll = (sql, params = []) => new Promise((res, rej) => db.all(sql, params, (err, rows) => err ? rej(err) : res(rows)));
const dbRun = (sql, params = []) => new Promise((res, rej) => db.run(sql, params, function(err) { err ? rej(err) : res(this); }));

/**
 * Processa un'azione di classe Tier 2 / B2B e aggiorna il batch
 */
async function processTier2Action(userId, co2Kg, imageHash, auditResult) {
  try {
    let currentBatch = await dbGet("SELECT * FROM credit_batches WHERE status = 'OPEN' LIMIT 1");
    let batchId;

    // 1. Creazione Batch se non esistente (con await prima di procedere)
    if (!currentBatch) {
      batchId = 'BATCH-' + Date.now();
      const batchCode = `BATCH-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;
      await dbRun(
        "INSERT INTO credit_batches (id, batch_code, target_co2_kg, total_co2_kg, status) VALUES (?, ?, 50000.0, 0.0, 'OPEN')",
        [batchId, batchCode]
      );
    } else {
      batchId = currentBatch.id;
    }

    // 2. Inserimento Azione Eco dMRV
    const actionId = 'ACT-' + crypto.randomUUID();
    const confidence = auditResult.confidence_score || auditResult.confidence || 0.95;
    const tier = auditResult.tier || 'B2B_INSTITUTIONAL';

    await dbRun(
      `INSERT INTO eco_actions (id, user_email, image_hash, tier, co2_saved_kg, confidence_score, batch_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
      [actionId, userId, imageHash, tier, co2Kg, confidence, batchId]
    );

    // 3. Aggiornamento totali del Batch
    await dbRun(
      `UPDATE credit_batches 
       SET total_co2_kg = total_co2_kg + ? 
       WHERE id = ?`,
      [co2Kg, batchId]
    );

    // 4. Verifico se il Batch ha raggiunto il target per il blocco
    const updatedBatch = await dbGet("SELECT * FROM credit_batches WHERE id = ?", [batchId]);

    if (updatedBatch && updatedBatch.total_co2_kg >= updatedBatch.target_co2_kg) {
      await dbRun("UPDATE credit_batches SET status = 'LOCKED' WHERE id = ?", [batchId]);
      updatedBatch.status = 'LOCKED';
      console.log(`🚀 BATCH ${batchId} COMPLETATO E BLOCCATO PER VENDITA B2B!`);
    }

    return updatedBatch;
  } catch (err) {
    console.error("❌ Errore processTier2Action:", err);
    throw err;
  }
}

/**
 * Sigilla un data pool B2B calcolando l'hash di blocco crittografico SHA-256
 */
async function sealPool(poolId) {
  try {
    const pool = await dbGet("SELECT * FROM data_pools WHERE id = ?", [poolId]);
    if (!pool) throw new Error("Data pool non trovato");

    const actions = await dbAll("SELECT * FROM eco_actions WHERE pool_id = ?", [poolId]);
    const rawContent = actions.map(a => `${a.id}:${a.image_hash || ''}:${a.co2_saved_kg || 0}`).join("|");
    const blockHash = crypto.createHash("sha256").update(`${pool.id}:${pool.category}:${rawContent}:${Date.now()}`).digest("hex");

    await dbRun(
      "UPDATE data_pools SET status = 'SEALED', block_hash = ? WHERE id = ?",
      [blockHash, poolId]
    );

    return { ...pool, status: "SEALED", block_hash: blockHash, items_count: actions.length };
  } catch (err) {
    console.error("❌ Errore sealPool:", err);
    throw err;
  }
}

/**
 * Genera il dossier dMRV strutturato JSON per l'audit ESG B2B
 */
async function generateDmrvDossier(poolId) {
  try {
    const pool = await dbGet("SELECT * FROM data_pools WHERE id = ?", [poolId]);
    if (!pool) throw new Error("Data pool non trovato");

    const actions = await dbAll("SELECT * FROM eco_actions WHERE pool_id = ?", [poolId]);

    return {
      dMRV_version: "2.0-ESG",
      pool_info: {
        id: pool.id,
        category: pool.category,
        status: pool.status,
        total_co2_kg: pool.total_co2_kg,
        block_hash: pool.block_hash || "NOT_SEALED",
        created_at: pool.created_at
      },
      audit_summary: {
        total_records: actions.length,
        verification_engine: "Gemini Vision Forensics AI",
        compliance_standard: "GHG Protocol Scope 3"
      },
      records: (actions || []).map(a => ({
        action_id: a.id,
        user_email: a.user_email || a.user_id,
        co2_saved_kg: a.co2_saved_kg,
        tier: a.tier,
        confidence_score: a.confidence_score,
        image_hash: a.image_hash,
        receipt_hash: a.receipt_hash,
        ticket_id: a.ticket_id,
        timestamp: a.created_at
      }))
    };
  } catch (err) {
    console.error("❌ Errore generateDmrvDossier:", err);
    throw err;
  }
}

module.exports = {
  processTier2Action,
  sealPool,
  generateDmrvDossier
};