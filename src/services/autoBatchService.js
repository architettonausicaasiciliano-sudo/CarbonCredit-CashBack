const crypto = require('crypto');
const db = require('../../db'); // Importa db.js dalla radice del progetto

/**
 * Servizio di automazione per l'aggregazione, sigillatura dMRV e certificazione Batch B2B
 */
const autoBatchService = {

    /**
     * Verifica se ci sono abbastanza crediti/CO2 per chiudere automaticamente un Batch
     * @param {number} thresholdCo2Kg - Soglia in kg di CO2 per chiudere il batch (default: 1000 kg)
     */
    async checkAndSealBatch(thresholdCo2Kg = 1000) {
        return new Promise((resolve, reject) => {
            // 1. Recupera tutte le azioni eco non ancora assegnate a un batch sigillato
            const queryPending = `
                SELECT * FROM eco_actions 
                WHERE status = 'in_review_batch' OR batch_id IS NULL OR batch_id = ''
            `;

            db.all(queryPending, [], (err, rows) => {
                if (err) return reject(err);
                if (!rows || rows.length === 0) {
                    return resolve({ status: 'NO_PENDING_DATA', message: 'Nessuna azione in attesa di aggregazione.' });
                }

                // Calcolo totale CO2 accumulata nel pool non sigillato
                const totalCo2 = rows.reduce((sum, item) => sum + (parseFloat(item.co2_saved_kg || item.co2Saved || 0)), 0);

                // Se la soglia non è ancora raggiunta, restituisce lo stato attuale
                if (totalCo2 < thresholdCo2Kg) {
                    return resolve({
                        status: 'THRESHOLD_NOT_MET',
                        currentCo2Kg: totalCo2,
                        requiredCo2Kg: thresholdCo2Kg,
                        progressPercentage: ((totalCo2 / thresholdCo2Kg) * 100).toFixed(1)
                    });
                }

                // 2. Soglia Raggiunta: Generazione Batch ID e Hash SHA-256 di Garanzia
                const batchTimestamp = Date.now();
                const batchId = `BATCH-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

                // Calcolo Hash del payload completo per immutabilità dMRV
                const payloadString = JSON.stringify(rows) + batchTimestamp;
                const batchHash = crypto.createHash('sha256').update(payloadString).digest('hex');

                const totalCredits = rows.reduce((sum, item) => sum + (parseFloat(item.credits_earned || item.credits || 0)), 0);
                const estimatedB2bEurValue = (totalCo2 / 1000) * 25.00; // Valore stimato 25€/ton di CO2

                // 3. Aggiorna le azioni nel Database con il nuovo Batch ID e lo stato 'sealed'
                const actionIds = rows.map(r => r.id);
                const placeholders = actionIds.map(() => '?').join(',');
                const updateQuery = `
                    UPDATE eco_actions 
                    SET batch_id = ?, status = 'sealed_in_batch' 
                    WHERE id IN (${placeholders})
                `;

                db.run(updateQuery, [batchId, ...actionIds], function(updateErr) {
                    if (updateErr) return reject(updateErr);

                    const resultSummary = {
                        status: 'BATCH_SEALED_SUCCESSFULLY',
                        batchId: batchId,
                        batchHash: batchHash,
                        totalItemsSealed: rows.length,
                        totalCo2Kg: totalCo2,
                        totalCredits: totalCredits,
                        estimatedB2bEurValue: estimatedB2bEurValue.toFixed(2),
                        sealedAt: new Date().toISOString()
                    };

                    console.log(`✅ AUTO-BATCH CHIUSO CON SUCCESSO: ${batchId} [Hash: ${batchHash.substring(0, 12)}...]`);
                    resolve(resultSummary);
                });
            });
        });
    },

    /**
     * Esporta il report JSON/CSV pronto per essere consegnato all'acquirente B2B
     */
    async exportBatchReport(batchId) {
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