const db = require("../../db");
const crypto = require("crypto");

/**
 * Processa un'azione di classe Tier 2 / B2B e aggiorna il batch
 */
async function processTier2Action(userId, co2Kg, imageHash, auditResult) {
  return new Promise((resolve, reject) => {
    db.get("SELECT * FROM credit_batches WHERE status = 'OPEN' LIMIT 1", [], (err, currentBatch) => {
      if (err) return reject(err);

      let batchId;
      if (!currentBatch) {
        batchId = 'BATCH-' + Date.now();
        const batchCode = `BATCH-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;
        db.run(
          "INSERT INTO credit_batches (id, batch_code, target_co2_kg) VALUES (?, ?, 50000.0)",
          [batchId, batchCode],
          (insertErr) => {
            if (insertErr) console.error("Errore creazione nuovo batch:", insertErr);
          }
        );
      } else {
        batchId = currentBatch.id;
      }

      const actionId = 'ACT-' + crypto.randomUUID();
      db.run(
        `INSERT INTO eco_actions (id, user_id, image_hash, tier, co2_kg, confidence, batch_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [actionId, userId, imageHash, auditResult.tier, co2Kg, auditResult.confidence_score, batchId],
        (actionErr) => {
          if (actionErr) console.error("Errore inserimento eco_action:", actionErr);
        }
      );

      db.run(
        `UPDATE credit_batches 
         SET total_co2_kg = total_co2_kg + ? 
         WHERE id = ?`,
        [co2Kg, batchId],
        function (err) {
          if (err) return reject(err);

          db.get("SELECT * FROM credit_batches WHERE id = ?", [batchId], (err, updatedBatch) => {
            if (err) return reject(err);

            if (updatedBatch && updatedBatch.total_co2_kg >= updatedBatch.target_co2_kg) {
              db.run("UPDATE credit_batches SET status = 'LOCKED' WHERE id = ?", [batchId]);
              console.log(`🚀 BATCH ${batchId} COMPLETATO E BLOCCATO PER VENDITA B2B!`);
            }
            resolve(updatedBatch);
          });
        }
      );
    });
  });
}

/**
 * Sigilla un data pool B2B calcolando l'hash di blocco crittografico SHA-256
 */
function sealPool(poolId) {
  return new Promise((resolve, reject) => {
    db.get("SELECT * FROM data_pools WHERE id = ?", [poolId], (err, pool) => {
      if (err || !pool) return reject(err || new Error("Pool non trovato"));

      db.all("SELECT * FROM eco_actions WHERE pool_id = ?", [poolId], (actionsErr, actions) => {
        if (actionsErr) return reject(actionsErr);

        const rawContent = actions.map(a => `${a.id}:${a.image_hash || ''}:${a.co2_saved_kg}`).join("|");
        const blockHash = crypto.createHash("sha256").update(`${pool.id}:${pool.category}:${rawContent}:${Date.now()}`).digest("hex");

        db.run(
          "UPDATE data_pools SET status = 'SEALED', block_hash = ? WHERE id = ?",
          [blockHash, poolId],
          (updateErr) => {
            if (updateErr) return reject(updateErr);
            resolve({ ...pool, status: "SEALED", block_hash: blockHash, items_count: actions.length });
          }
        );
      });
    });
  });
}

/**
 * Genera il dossier dMRV strutturato JSON per l'audit ESG B2B
 */
function generateDmrvDossier(poolId) {
  return new Promise((resolve, reject) => {
    db.get("SELECT * FROM data_pools WHERE id = ?", [poolId], (err, pool) => {
      if (err || !pool) return reject(err || new Error("Data pool non trovato"));

      db.all("SELECT * FROM eco_actions WHERE pool_id = ?", [poolId], (actionsErr, actions) => {
        if (actionsErr) return reject(actionsErr);

        const dossier = {
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
            user_email: a.user_email,
            co2_saved_kg: a.co2_saved_kg,
            tier: a.tier,
            confidence_score: a.confidence_score,
            image_hash: a.image_hash,
            receipt_hash: a.receipt_hash,
            ticket_id: a.ticket_id,
            timestamp: a.created_at
          }))
        };

        resolve(dossier);
      });
    });
  });
}

module.exports = {
  processTier2Action,
  sealPool,
  generateDmrvDossier
};