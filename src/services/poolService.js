import db from '../../db.js';
import crypto from 'crypto';

export async function processTier2Action(userId, co2Kg, imageHash, auditResult) {
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