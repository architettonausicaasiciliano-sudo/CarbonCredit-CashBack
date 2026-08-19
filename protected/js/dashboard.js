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
    const btnRedeem = document.getElementById('btnRedeem');
    const assetsList = document.getElementById('assetsList');

    if (!userEmail) {
        console.warn("User email not found in localStorage. Showing default views.");
    }

    /* =====================================================
       1. RECUPERO STATISTICHE E DATI UTENTE
    ===================================================== */
    async function loadUserData() {
        if (!userEmail) return;

        try {
            const res = await fetch(`/api/user?email=${encodeURIComponent(userEmail)}`);
            const data = await res.json();

            if (data) {
                // Saldo Crediti e CO2
                if (userCreditsEl) userCreditsEl.textContent = `${(data.carbon_credits || 0).toFixed(1)} CC`;
                if (totalCo2El) totalCo2El.textContent = `${(data.totalCo2Kg || 0).toFixed(1)} kg`;
                if (totalTreesEl) totalTreesEl.textContent = `${data.treesEquivalent || 0} 🌳`;
                
                // Dati Batch B2B
                if (batchIdEl) batchIdEl.textContent = data.batchId || "BATCH-2026-104";
                if (pendingEurEl) pendingEurEl.textContent = `€ ${(data.pendingB2bEur || 0).toFixed(2)}`;
                if (batchStatusEl) batchStatusEl.textContent = "⏳ B2B Aggregation Pending";
                
                // Impatto Simbolico (Alberi)
                if (treeBannerTextEl) {
                    treeBannerTextEl.textContent = `${data.treesEquivalent || 0} Trees Planted Equivalent`;
                }
            }
        } catch (err) {
            console.error("Error fetching user data:", err);
        }
    }

    /* =====================================================
       2. RECUPERO BENI ED AZIONI ECO REGISTRATE
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
                        No green assets or purchases registered yet. Click the button above to register your first item!
                    </p>`;
                return;
            }

            assetsList.innerHTML = '';
            actions.forEach(action => {
                // Calcolo stima del valore B2B per singola azione (€25/ton)
                const co2Kg = action.co2_saved_kg || 0;
                const estB2bValue = ((co2Kg / 1000) * 25.00).toFixed(2);

                const card = document.createElement('div');
                card.className = 'asset-item';
                card.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 15px; border-bottom: 1px solid rgba(255,255,255,0.08); margin-bottom: 10px; background: rgba(255,255,255,0.02); border-radius: 8px;';
                
                card.innerHTML = `
                    <div class="asset-info">
                        <h4 style="margin: 0 0 5px 0; color: #00ff88; font-size: 1.1em;">${action.title}</h4>
                        <p style="margin: 0; font-size: 0.85em; color: #a0aec0;">
                            Category: <strong>${action.category}</strong> | Source: ${action.source || 'Manual Input'}
                        </p>
                        <p style="margin: 6px 0 0 0; font-size: 0.9em; color: #e2e8f0;">
                            CO₂ Saved: <strong>${co2Kg} kg</strong> | 
                            Credits Earned: <strong>+${action.credits_earned} CC</strong> | 
                            Est. B2B Value: <strong style="color: #ffb703;">€ ${estB2bValue}</strong>
                        </p>
                    </div>
                    ${action.photo_url ? `<img src="${action.photo_url}" class="asset-thumb" alt="Receipt" style="width: 55px; height: 55px; object-fit: cover; border-radius: 6px; margin-left: 12px; border: 1px solid #00ff88;">` : ''}
                `;
                assetsList.appendChild(card);
            });
        } catch (err) {
            console.error("Error fetching eco actions:", err);
        }
    }

    /* =====================================================
       3. GESTIONE RICHIESTA CASHBACK (MONETIZZAZIONE)
    ===================================================== */
    if (btnRedeem) {
        btnRedeem.addEventListener('click', async () => {
            if (!userEmail) {
                alert("Please log in or register your email first.");
                return;
            }

            const creditsInput = prompt("Enter the amount of Carbon Credits (CC) you wish to submit for B2B Cashback conversion:");
            if (!creditsInput || isNaN(creditsInput) || parseFloat(creditsInput) <= 0) {
                return;
            }

            const creditsToRedeem = parseFloat(creditsInput);
            // Valore stimato di conversione
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
                    alert(`Cashback request submitted successfully!\n\nRequested Amount: €${amountEur}\nStatus: Your request has been queued into the current B2B Batch. Funds will be released upon corporate liquidation.`);
                    loadUserData();
                    loadEcoActions();
                } else {
                    alert(`Request Error: ${result.error || 'Failed to submit cashback request. Check your credits balance.'}`);
                }
            } catch (err) {
                console.error("Error redeeming cashback:", err);
                alert("An error occurred while submitting your cashback request.");
            }
        });
    }

    // Caricamento Iniziale
    await loadUserData();
    await loadEcoActions();
});