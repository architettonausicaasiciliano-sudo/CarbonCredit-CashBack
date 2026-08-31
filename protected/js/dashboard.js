document.addEventListener('DOMContentLoaded', async () => {
    // Recupera l'email dell'utente registrata nel localStorage
    const userEmail = localStorage.getItem('email') || localStorage.getItem('userEmail');

    // Elementi DOM della Dashboard
    const userCreditsEl = document.getElementById('userCredits');
    const totalCo2El = document.getElementById('totalCo2');
    const totalTreesEl = document.getElementById('totalTrees');
    const batchIdEl = document.getElementById('batchId');
    const pendingEurEl = document.getElementById('pendingEur');
    const batchStatusEl = document.getElementById('batchStatus');
    const treeBannerTextEl = document.getElementById('treeBannerText');
    const tranchesContainerEl = document.getElementById('tranchesContainer');
    const btnRedeem = document.getElementById('btnRedeem');
    const assetsList = document.getElementById('assetsList');

    if (!userEmail) {
        console.warn("User email non trovata in localStorage.");
    }

    /* =====================================================
       1. RECUPERO STATISTICHE E DATI UTENTE
    ===================================================== */
    async function loadUserData() {
        if (!userEmail) return;

        try {
            const res = await fetch(`/api/user?email=${encodeURIComponent(userEmail)}`);
            const data = await res.json();

            if (data && !data.error) {
                // Saldo Crediti e CO2
                if (userCreditsEl) userCreditsEl.textContent = `${(data.carbon_credits || 0).toFixed(1)} CC`;
                if (totalCo2El) totalCo2El.textContent = `${(data.totalCo2Kg || 0).toFixed(1)} kg`;
                if (totalTreesEl) totalTreesEl.textContent = `${data.treesEquivalent || 0} 🌳`;
                
                // Dati Batch B2B
                if (batchIdEl) batchIdEl.textContent = data.batchId || "BATCH-2026-104";
                if (pendingEurEl) pendingEurEl.textContent = `€ ${(data.pendingB2bEur || 0).toFixed(2)}`;
                if (batchStatusEl) batchStatusEl.textContent = data.batchStatus || "⏳ In aggregazione per Payout Cashback";
                
                // Impatto Simbolico (Alberi)
                if (treeBannerTextEl) {
                    treeBannerTextEl.textContent = `${data.treesEquivalent || 0} Trees Planted Equivalent`;
                }

                // Render Tranches (se presente l'elemento nel DOM)
                if (tranchesContainerEl && data.tranches) {
                    renderTranches(data.tranches);
                }

                // Controllo automatico soglia €1000
                checkThousandThreshold();
            }
        } catch (err) {
            console.error("Errore durante il recupero dei dati utente:", err);
        }
    }

    /* =====================================================
       2. RENDER TRANCHES IMPATTO / SBLOCCO CASHBACK
    ===================================================== */
    function renderTranches(tranches) {
        if (!tranchesContainerEl || !Array.isArray(tranches)) return;
        tranchesContainerEl.innerHTML = tranches.map(t => `
            <div class="tranche-item ${t.unlocked ? 'unlocked' : 'locked'}" style="padding: 10px; margin: 5px 0; border-radius: 6px; background: ${t.unlocked ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.03)'}; border: 1px solid ${t.unlocked ? '#10b981' : 'rgba(255,255,255,0.1)'};">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span>Tranche ${t.id} (€${t.targetEur})</span>
                    <strong style="color: ${t.unlocked ? '#10b981' : '#a0aec0'};">${t.unlocked ? '✓ Sbloccata' : '🔒 In Corso'}</strong>
                </div>
            </div>
        `).join('');
    }

    /* =====================================================
       3. VERIFICA SOGLIA €1000 E GENERAZIONE TICKET
    ===================================================== */
    async function checkThousandThreshold() {
        if (!userEmail) return;
        try {
            const res = await fetch('/api/check-thousand-threshold', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: userEmail })
            });
            const data = await res.json();
            if (data.thresholdReached && data.ticketCode) {
                console.log(`🎯 Soglia €1000 raggiunta! Ticket generato: ${data.ticketCode}`);
            }
        } catch (err) {
            console.error("Errore verifica soglia €1000:", err);
        }
    }

    /* =====================================================
       4. RECUPERO BENI ED AZIONI ECO REGISTRATE
    ===================================================== */
    async function loadEcoActions() {
        if (!userEmail) return;

        try {
            const res = await fetch(`/api/eco-actions?email=${encodeURIComponent(userEmail)}`);
            const data = await res.json();
            const actions = data.ecoActions || [];

            if (!assetsList) return;

            if (actions.length === 0) {
                assetsList.innerHTML = `
                    <p class="empty-msg" style="text-align: center; color: #a0aec0; padding: 20px;">
                        Nessun bene green o acquisto registrato. Clicca sul pulsante in alto per registrare la tua prima azione!
                    </p>`;
                return;
            }

            assetsList.innerHTML = '';
            actions.forEach(action => {
                const co2Kg = action.co2_saved_kg || 0;
                const estB2bValue = ((co2Kg / 1000) * 25.00).toFixed(2);
                const isB2B = action.tier === 'B2B_INSTITUTIONAL';
                const statusBadge = action.status === 'in_review_batch' ? '⏳ In Valutazione Batch' : '✓ Attivo';

                const card = document.createElement('div');
                card.className = 'asset-item';
                card.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 15px; border-bottom: 1px solid rgba(255,255,255,0.08); margin-bottom: 10px; background: rgba(255,255,255,0.02); border-radius: 8px;';
                
                card.innerHTML = `
                    <div class="asset-info" style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                            <h4 style="margin: 0; color: #00ff88; font-size: 1.1em;">${action.title}</h4>
                            <span style="font-size: 0.7em; padding: 2px 8px; border-radius: 4px; font-weight: bold; background: ${isB2B ? 'rgba(56, 189, 248, 0.2)' : 'rgba(234, 179, 8, 0.2)'}; color: ${isB2B ? '#38bdf8' : '#eab308'}; border: 1px solid ${isB2B ? '#38bdf8' : '#eab308'};">
                                ${isB2B ? 'TIER 2 B2B' : 'TIER 1 COMMUNITY'}
                            </span>
                        </div>
                        <p style="margin: 0; font-size: 0.85em; color: #a0aec0;">
                            Categoria: <strong>${action.category}</strong> | Fonte: ${action.source || 'Inserimento Manuale'} | Stato: <em>${statusBadge}</em>
                        </p>
                        <p style="margin: 6px 0 0 0; font-size: 0.9em; color: #e2e8f0;">
                            CO₂ Evitata: <strong>${co2Kg} kg</strong> | 
                            Crediti: <strong>+${action.credits_earned} CC</strong> | 
                            Valore B2B Stimato: <strong style="color: #ffb703;">€ ${estB2bValue}</strong>
                        </p>
                        <div style="margin-top: 8px; display: flex; gap: 12px; align-items: center;">
                            <a href="/verify/${action.id}" target="_blank" style="color: #38bdf8; font-size: 0.8em; text-decoration: underline;">🔍 Audit dMRV</a>
                            <button class="btn-delete-asset" data-id="${action.id}" style="background: transparent; border: none; color: #ef4444; font-size: 0.8em; cursor: pointer; padding: 0;">🗑 Rimuovi</button>
                        </div>
                    </div>
                    ${action.photo_url ? `<img src="${action.photo_url}" class="asset-thumb" alt="Allegato" style="width: 55px; height: 55px; object-fit: cover; border-radius: 6px; margin-left: 12px; border: 1px solid #00ff88;">` : ''}
                `;

                // Event listener per la rimozione dell'azione
                const deleteBtn = card.querySelector('.btn-delete-asset');
                if (deleteBtn) {
                    deleteBtn.addEventListener('click', async (e) => {
                        const actionId = e.target.getAttribute('data-id');
                        if (confirm("Sei sicuro di voler eliminare questo bene registrato? I crediti accumulati verranno stornati dal saldo.")) {
                            await deleteEcoAction(actionId);
                        }
                    });
                }

                assetsList.appendChild(card);
            });
        } catch (err) {
            console.error("Errore durante il recupero delle azioni eco:", err);
        }
    }

    /* =====================================================
       5. ELIMINAZIONE AZIONE ECO / BENE
    ===================================================== */
    async function deleteEcoAction(actionId) {
        try {
            const res = await fetch(`/api/eco-actions/${actionId}?email=${encodeURIComponent(userEmail)}`, {
                method: 'DELETE'
            });
            const result = await res.json();
            if (result.success) {
                await loadUserData();
                await loadEcoActions();
            } else {
                alert(`Errore nella rimozione: ${result.message || result.error}`);
            }
        } catch (err) {
            console.error("Errore durante l'eliminazione:", err);
            alert("Si è verificato un errore durante l'eliminazione del bene.");
        }
    }

    /* =====================================================
       6. GESTIONE RICHIESTA CASHBACK (MONETIZZAZIONE)
    ===================================================== */
    if (btnRedeem) {
        btnRedeem.addEventListener('click', async () => {
            if (!userEmail) {
                alert("Effettua prima l'accesso con la tua email.");
                return;
            }

            const creditsInput = prompt("Inserisci la quantità di Carbon Credits (CC) da convertire in Cashback B2B:");
            if (!creditsInput || isNaN(creditsInput) || parseFloat(creditsInput) <= 0) {
                return;
            }

            const creditsToRedeem = parseFloat(creditsInput);
            const amountEur = (creditsToRedeem * 0.25).toFixed(2);

            try {
                const res = await fetch('/api/redeem-cashback', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: userEmail,
                        creditsToRedeem: creditsToRedeem,
                        amountEur: amountEur
                    })
                });

                const result = await res.json();
                if (result.success) {
                    alert(`Richiesta di riscatto registrata!\n\nImporto Cashback: €${amountEur}\nStato: La richiesta è stata accodata nel Batch B2B corrente. Riceverai notifica dell'accredito a completamento.`);
                    await loadUserData();
                    await loadEcoActions();
                } else {
                    alert(`Errore richiesta: ${result.error || 'Saldo crediti insufficiente.'}`);
                }
            } catch (err) {
                console.error("Errore riscatto cashback:", err);
                alert("Si è verificato un errore durante l'invio della richiesta di riscatto.");
            }
        });
    }

    // Esecuzione caricamento iniziale
    await loadUserData();
    await loadEcoActions();
});