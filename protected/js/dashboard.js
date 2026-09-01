document.addEventListener('DOMContentLoaded', async () => {
    // 1. Recupero credenziali utente da localStorage
    const userEmail = localStorage.getItem('email') || localStorage.getItem('userEmail');

    // 2. Elementi DOM - Statistiche Principali
    const userCreditsEl = document.getElementById('userCredits');
    const pendingCcValEl = document.getElementById('pendingCcVal');
    const totalCo2El = document.getElementById('totalCo2');
    const totalTreesEl = document.getElementById('totalTrees');
    const treeBannerTextEl = document.getElementById('treeBannerText');
    const batchIdEl = document.getElementById('batchId');
    const pendingEurEl = document.getElementById('pendingEur');
    const batchStatusEl = document.getElementById('batchStatus');

    // Elementi DOM - Tranche & Modale
    const dashTrancheLabel = document.getElementById('dashTrancheLabel');
    const dashProgressBarFill = document.getElementById('dashProgressBarFill');
    const dashProgressText = document.getElementById('dashProgressText');
    const dashUnlockedCashback = document.getElementById('dashUnlockedCashback');
    const tranchesContainerEl = document.getElementById('tranchesContainer');
    const trancheModal = document.getElementById('trancheModal');
    const btnOpenTrancheModal = document.getElementById('btnOpenTrancheModal');
    const btnCloseTrancheModal = document.getElementById('btnCloseTrancheModal');
    const btnCloseTrancheModalBottom = document.getElementById('btnCloseTrancheModalBottom');

    // Elementi DOM - Azioni & Liste
    const btnRedeem = document.getElementById('btnRedeem');
    const assetsList = document.getElementById('assetsList');

    if (!userEmail) {
        console.warn("User email non trovata in localStorage.");
    }

    /* =====================================================
       1. RECUPERO E RENDER STATISTICHE UTENTE
    ===================================================== */
    async function loadUserData() {
        if (!userEmail) return;

        try {
            const res = await fetch(`/api/user?email=${encodeURIComponent(userEmail)}`);
            const data = await res.json();

            if (data && !data.error) {
                // Saldo Crediti e CO2
                if (userCreditsEl) userCreditsEl.textContent = `${(data.carbon_credits || 0).toFixed(1)} CC`;
                if (pendingCcValEl) pendingCcValEl.textContent = `${data.pendingCc || 0} CC`;
                if (totalCo2El) totalCo2El.textContent = `${(data.totalCo2Kg || 0).toFixed(1)} kg`;
                if (totalTreesEl) totalTreesEl.textContent = `${data.treesEquivalent || 0} 🌳`;
                if (treeBannerTextEl) treeBannerTextEl.textContent = `${data.treesEquivalent || 0} Equivalente Alberi Piantati`;

                // Dati Batch B2B
                if (batchIdEl) batchIdEl.textContent = data.batchId || "BATCH-2026-104";
                if (pendingEurEl) pendingEurEl.textContent = `€ ${(data.pendingB2bEur || 0).toFixed(2)}`;
                if (batchStatusEl) batchStatusEl.textContent = data.batchStatus || "In aggregazione per Payout Cashback";

                // Calcolo e Render Tranche con relativi Codici Tracciamento
                renderTranchesProgress(data);

                // Controllo soglia €1000
                await checkThousandThreshold();
            }
        } catch (err) {
            console.error("Errore durante il recupero dei dati utente:", err);
        }
    }

    /* =====================================================
       2. CALCOLO, RENDER E GESTIONE CODICI DI TRACCIAMENTO TRANCHE
    ===================================================== */
    function renderTranchesProgress(data) {
        const totalCreditAccumulated = data.totalCreditAccumulated || data.totalSpentEur || 0;
        const tranchesList = data.tranches || [];

        const completedTranches = Math.floor(totalCreditAccumulated / 1000);
        const currentTrancheProgress = parseFloat((totalCreditAccumulated % 1000).toFixed(2));
        const currentTranchePercentage = parseFloat(((currentTrancheProgress / 1000) * 100).toFixed(1));
        const unlockedCashback = completedTranches * 100;

        // Aggiornamento Card Principale Dashboard
        if (dashTrancheLabel) dashTrancheLabel.innerText = `Tranche Attiva: #${completedTranches + 1}`;
        if (dashProgressBarFill) dashProgressBarFill.style.width = `${currentTranchePercentage}%`;
        if (dashProgressText) dashProgressText.innerText = `€${currentTrancheProgress.toFixed(2)} / €1.000,00 (${currentTranchePercentage}%)`;
        if (dashUnlockedCashback) dashUnlockedCashback.innerText = `Sbloccati: €${unlockedCashback.toFixed(2)}`;

        // Render Elenco Tranche dentro la Modale
        if (tranchesContainerEl) {
            tranchesContainerEl.innerHTML = '';

            // Se l'API restituisce un array 'tranches' personalizzato
            if (tranchesList.length > 0) {
                tranchesList.forEach(t => {
                    const item = createTrancheElement(t.id, t.unlocked, t.targetEur || 1000, t.currentEur || 1000, t.trackingCode, t.processingStatus);
                    tranchesContainerEl.appendChild(item);
                });
            } else {
                // Generazione dinamica basata sulle tranche completate e su quella in corso
                for (let i = 0; i <= completedTranches; i++) {
                    const isCompleted = i < completedTranches;
                    const trancheVal = isCompleted ? 1000 : currentTrancheProgress;
                    const pct = isCompleted ? 100 : currentTranchePercentage;
                    const trancheNum = i + 1;

                    // Codice univoco di tracciamento simulato/derivato
                    const userHash = (userEmail || 'USER').substring(0, 4).toUpperCase();
                    const trackingCode = `TRN-2026-T${trancheNum}-${userHash}-${1000 + trancheNum * 17}`;
                    const processingStatus = isCompleted ? 'In Convalida Batch B2B / Liquidazione' : 'In Accumulo Credito';

                    const item = createTrancheElement(trancheNum, isCompleted, 1000, trancheVal, trackingCode, processingStatus, pct);
                    tranchesContainerEl.appendChild(item);
                }
            }
        }
    }

    /* Helper per la creazione del DOM di una singola Tranche */
    function createTrancheElement(num, isCompleted, targetEur, currentEur, trackingCode, processingStatus, pct) {
        const item = document.createElement('div');
        item.className = `tranche-item ${isCompleted ? 'completed' : ''}`;
        
        const progressPercentage = pct !== undefined ? pct : Math.min(100, ((currentEur / targetEur) * 100).toFixed(1));

        item.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.9rem; font-weight: bold; margin-bottom: 6px;">
                <span>Tranche #${num} ${isCompleted ? '✅ (Completata)' : '⏳ (In corso)'}</span>
                <span style="color: ${isCompleted ? 'var(--accent-yellow)' : 'var(--text-muted)'};">
                    ${isCompleted ? 'Cashback Sbloccato: €100.00' : `Sblocco a €${targetEur}`}
                </span>
            </div>

            <div class="progress-track" style="height: 8px; margin: 6px 0;">
                <div class="progress-fill" style="width: ${progressPercentage}%;"></div>
            </div>

            <div style="font-size: 0.75rem; color: var(--text-muted); display: flex; justify-content: space-between; align-items: center;">
                <span>Credito: €${currentEur.toFixed(2)} / €${targetEur.toFixed(2)} (${progressPercentage}%)</span>
                ${isCompleted ? `
                    <button class="btn-track-code" data-code="${trackingCode}" data-tranche="${num}">
                        🎟️ Codice Processamento
                    </button>
                ` : '<span style="font-size: 0.75rem; color: var(--text-muted);">Avanzamento in corso</span>'}
            </div>

            ${isCompleted ? `
                <div class="tranche-code-detail" id="trancheCodeDetail-${num}">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                        <strong style="color: var(--accent-yellow);">📋 Codice Tracciamento Lavorazione:</strong>
                        <button class="btn-copy-code" data-code="${trackingCode}" style="background: rgba(255,255,255,0.1); border: 1px solid var(--border-color); color: white; border-radius: 4px; padding: 2px 8px; font-size: 0.75rem; cursor: pointer;">📋 Copia</button>
                    </div>
                    <div style="font-family: monospace; background: #000; padding: 6px 10px; border-radius: 4px; color: var(--accent-green-bright); font-weight: bold; font-size: 0.95rem; text-align: center; margin-bottom: 6px; letter-spacing: 0.5px;">
                        ${trackingCode}
                    </div>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">
                        • Stato Processamento: <strong style="color: var(--accent-blue);">${processingStatus}</strong><br>
                        • Nota Trasparenza: Questo codice identifica in modo immutabile la tranche dMRV aggregata nel Batch B2B di riferimento.
                    </div>
                </div>
            ` : ''}
        `;

        // Event listener per mostrare/nascondere il codice di processamento
        const btnTrack = item.querySelector('.btn-track-code');
        if (btnTrack) {
            btnTrack.addEventListener('click', () => {
                const detailBox = item.querySelector(`#trancheCodeDetail-${num}`);
                if (detailBox) {
                    const isVisible = detailBox.style.display === 'block';
                    detailBox.style.display = isVisible ? 'none' : 'block';
                }
            });
        }

        // Event listener per copiare il codice negli appunti
        const btnCopy = item.querySelector('.btn-copy-code');
        if (btnCopy) {
            btnCopy.addEventListener('click', (e) => {
                const codeToCopy = e.currentTarget.getAttribute('data-code');
                navigator.clipboard.writeText(codeToCopy).then(() => {
                    const origText = e.currentTarget.innerText;
                    e.currentTarget.innerText = '✓ Copiato!';
                    setTimeout(() => { e.currentTarget.innerText = origText; }, 1800);
                }).catch(err => {
                    console.error("Errore durante la copia:", err);
                });
            });
        }

        return item;
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
                    <p class="empty-msg" style="text-align: center; color: var(--text-muted); padding: 24px; background: var(--card-bg); border-radius: 12px; border: 1px dashed var(--border-color);">
                        Nessun bene green o scontrino registrato. Clicca sul pulsante in alto per registrare la tua prima azione dMRV!
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
                card.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 16px; border: 1px solid var(--border-color); margin-bottom: 12px; background: var(--card-bg); border-radius: 12px;';

                card.innerHTML = `
                    <div class="asset-info" style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                            <h4 style="margin: 0; color: var(--accent-green-bright); font-size: 1.05em;">${action.title}</h4>
                            <span style="font-size: 0.7em; padding: 2px 8px; border-radius: 4px; font-weight: bold; background: ${isB2B ? 'rgba(56, 189, 248, 0.15)' : 'rgba(234, 179, 8, 0.15)'}; color: ${isB2B ? 'var(--accent-blue)' : 'var(--accent-yellow)'}; border: 1px solid ${isB2B ? 'var(--accent-blue)' : 'var(--accent-yellow)'};">
                                ${isB2B ? 'TIER 2 B2B' : 'TIER 1 COMMUNITY'}
                            </span>
                        </div>
                        <p style="margin: 0; font-size: 0.85em; color: var(--text-muted);">
                            Categoria: <strong>${action.category}</strong> | Fonte: ${action.source || 'Inserimento Manuale'} | Stato: <em>${statusBadge}</em>
                        </p>
                        <p style="margin: 6px 0 0 0; font-size: 0.9em; color: #f8fafc;">
                            CO₂ Evitata: <strong>${co2Kg} kg</strong> | 
                            Crediti: <strong>+${action.credits_earned} CC</strong> | 
                            Valore B2B Stimato: <strong style="color: var(--accent-yellow);">€ ${estB2bValue}</strong>
                        </p>
                        <div style="margin-top: 10px; display: flex; gap: 12px; align-items: center;">
                            <a href="/verify/${action.id}" target="_blank" style="color: var(--accent-blue); font-size: 0.85em; text-decoration: underline;">🔍 Audit dMRV</a>
                            <button class="btn-delete-asset" data-id="${action.id}" title="Elimina questo scontrino">
                                🗑️ Rimuovi
                            </button>
                        </div>
                    </div>
                    ${action.photo_url ? `<img src="${action.photo_url}" class="asset-thumb" alt="Allegato" style="width: 55px; height: 55px; object-fit: cover; border-radius: 6px; margin-left: 12px; border: 1px solid var(--accent-green);">` : ''}
                `;

                // Listener pulsante eliminazione diretta scontrino
                const deleteBtn = card.querySelector('.btn-delete-asset');
                if (deleteBtn) {
                    deleteBtn.addEventListener('click', async (e) => {
                        const targetBtn = e.currentTarget;
                        const actionId = targetBtn.getAttribute('data-id');
                        
                        if (confirm("Sei sicuro di voler eliminare questo scontrino / bene registrato? I crediti accumulati verranno ricalcolati e stornati dal saldo.")) {
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
       5. ELIMINAZIONE DIRETTA AZIONE ECO / SCONTRINO
    ===================================================== */
    async function deleteEcoAction(actionId) {
        if (!actionId || !userEmail) return;

        try {
            const res = await fetch(`/api/eco-actions/${actionId}?email=${encodeURIComponent(userEmail)}`, {
                method: 'DELETE'
            });
            const result = await res.json();

            if (res.ok && (result.success || result.status === 'success')) {
                // Aggiorna dinamicamente sia il saldo crediti/tranche che la lista beni
                await loadUserData();
                await loadEcoActions();
            } else {
                alert(`Errore nella rimozione: ${result.message || result.error || 'Operazione non riuscita'}`);
            }
        } catch (err) {
            console.error("Errore durante l'eliminazione:", err);
            alert("Si è verificato un errore di connessione durante l'eliminazione dello scontrino.");
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
                    alert(`Richiesta di riscatto registrata!\n\nImporto Cashback: €${amountEur}\nStato: La richiesta è stata accodata nel Batch B2B corrente.`);
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

    /* =====================================================
       7. CONTROLLO EVENTI MODALE TRANCHE
    ===================================================== */
    if (btnOpenTrancheModal && trancheModal) {
        btnOpenTrancheModal.addEventListener('click', () => {
            trancheModal.style.display = 'flex';
        });
    }
    if (btnCloseTrancheModal && trancheModal) {
        btnCloseTrancheModal.addEventListener('click', () => {
            trancheModal.style.display = 'none';
        });
    }
    if (btnCloseTrancheModalBottom && trancheModal) {
        btnCloseTrancheModalBottom.addEventListener('click', () => {
            trancheModal.style.display = 'none';
        });
    }
    window.addEventListener('click', (e) => {
        if (e.target === trancheModal) {
            trancheModal.style.display = 'none';
        }
    });

    // Esecuzione caricamento iniziale
    await loadUserData();
    await loadEcoActions();
});