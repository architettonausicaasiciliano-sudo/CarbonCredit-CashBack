const crypto = require('crypto');
const db = require('../../db');

// Assicura che le colonne status e batch_id esistano nella tabella
const ensureColumnsExist = () => {
    return new Promise((resolve) => {
        db.run("ALTER TABLE eco_actions ADD COLUMN status TEXT DEFAULT 'in_review_batch'", () => {
            db.run("ALTER TABLE eco_actions ADD COLUMN batch_id TEXT", () => {
                resolve();
            });
        });
    });
};

const autoBatchService = {

    /**
     * Verifica e sigilla il Batch se la soglia viene raggiunta
     */
    async checkAndSealBatch(thresholdCo2Kg = 1000) {
        await ensureColumnsExist(); // Crea le colonne nel DB se non esistono

        return new Promise((resolve, reject) => {
            const queryPending = `
                SELECT * FROM eco_actions 
                WHERE status IS NULL OR status = 'in_review_batch' OR batch_id IS NULL OR batch_id = ''
            `;

            db.all(queryPending, [], (err, rows) => {
                if (err) return reject(err);
                if (!rows || rows.length === 0) {
                    return resolve({ status: 'NO_PENDING_DATA', message: 'Nessuna azione in attesa di aggregazione.' });
                }

                // Calcolo totale CO2
                const totalCo2 = rows.reduce((sum, item) => sum + (parseFloat(item.co2_saved_kg || item.co2Saved || 0)), 0);

                if (totalCo2 < thresholdCo2Kg) {
                    return resolve({
                        status: 'THRESHOLD_NOT_MET',
                        currentCo2Kg: totalCo2,
                        requiredCo2Kg: thresholdCo2Kg,
                        progressPercentage: ((totalCo2 / thresholdCo2Kg) * 100).toFixed(1)
                    });
                }

                // Soglia raggiunta
                const batchTimestamp = Date.now();
                const batchId = `BATCH-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
                const payloadString = JSON.stringify(rows) + batchTimestamp;
                const batchHash = crypto.createHash('sha256').update(payloadString).digest('hex');

                const totalCredits = rows.reduce((sum, item) => sum + (parseFloat(item.credits_earned || item.credits || 0)), 0);
                const estimatedB2bEurValue = (totalCo2 / 1000) * 25.00;

                const actionIds = rows.map(r => r.id);
                const placeholders = actionIds.map(() => '?').join(',');
                const updateQuery = `
                    UPDATE eco_actions 
                    SET batch_id = ?, status = 'sealed_in_batch' 
                    WHERE id IN (${placeholders})
                `;

                db.run(updateQuery, [batchId, ...actionIds], function(updateErr) {
                    if (updateErr) return reject(updateErr);

                    resolve({
                        status: 'BATCH_SEALED_SUCCESSFULLY',
                        batchId: batchId,
                        batchHash: batchHash,
                        totalItemsSealed: rows.length,
                        totalCo2Kg: totalCo2,
                        totalCredits: totalCredits,
                        estimatedB2bEurValue: estimatedB2bEurValue.toFixed(2),
                        sealedAt: new Date().toISOString()
                    });
                });
            });
        });
    },

    async exportBatchReport(batchId) {
        await ensureColumnsExist();
        return new Promise((resolve, reject) => {
            const query = `SELECT id, user_email, category, co2_saved_kg, credits_earned, timestamp, status FROM eco_actions WHERE batch_id = ?`;
            
            db.all(query, [batchId], (err, rows) => {
                if (err) return reject(err);
                if (!rows || rows.length === 0) return reject(new Error('Batch non trovato.'));

                const totalCo2 = rows.reduce((sum, item) => sum + (item.co2_saved_kg || 0), 0);
                const totalCredits = rows.reduce((sum, item) => sum + (item.credits_earned || 0), 0);
                const batchHash = crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex');

                resolve({
                    metadata: {
                        batchId: batchId,
                        certificateType: "dMRV Sealed Carbon Credit Pool",
                        sha256VerificationHash: batchHash,
                        totalCo2OffsetKg: totalCo2,
                        totalCo2OffsetTons: (totalCo2 / 1000).toFixed(3),
                        totalCredits: totalCredits,
                        recordsCount: rows.length,
                        generatedAt: new Date().toISOString()
                    },
                    records: rows
                });
            });
        });
    }
};

module.exports = autoBatchService;