document.addEventListener('DOMContentLoaded', async () => {
    // 1. Recupero credenziali utente con fallback sicuro
    let userEmail = localStorage.getItem('email') || localStorage.getItem('userEmail') || sessionStorage.getItem('userEmail') || 'nausicaa.siciliano@40virgilio.it';

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
            const res = await fetch(`/api/users/profile/${encodeURIComponent(userEmail)}`);
            const data = await res.json();

            if (data && !data.error) {
                const credits = data.carbon_credits ?? data.credits ?? data.totalCreditAccumulated ?? 0;
                const pendingCc = data.pendingCc ?? data.pending_cc ?? 0;
                const co2Kg = data.totalCo2Kg ?? data.co2_saved_kg ?? data.total_co2 ?? 0;
                const trees = data.treesEquivalent ?? data.trees ?? Math.floor(co2Kg / 25) ?? 0;

                if (userCreditsEl) userCreditsEl.textContent = `${Number(credits).toFixed(1)} CC`;
                if (pendingCcValEl) pendingCcValEl.textContent = `${Number(pendingCc).toFixed(1)} CC`;
                if (totalCo2El) totalCo2El.textContent = `${Number(co2Kg).toFixed(1)} kg`;
                if (totalTreesEl) totalTreesEl.textContent = `${trees} 🌳`;
                if (treeBannerTextEl) treeBannerTextEl.textContent = `${trees} Tree Equivalent`;

                if (batchIdEl) batchIdEl.textContent = data.batchId || "BATCH-2026-104";
                if (pendingEurEl) pendingEurEl.textContent = `€ ${(data.pendingB2bEur || 0).toFixed(2)}`;
                if (batchStatusEl) batchStatusEl.textContent = data.batchStatus || "Aggregating for Cashback Payout";

/* 
                renderTranchesProgress({
                    ...data,
                    totalCreditAccumulated: credits
                });
                */

                await checkThousandThreshold();
            }
        } catch (err) {
            console.error("Errore durante il recupero dei dati utente:", err);
        }
    }

    /* =====================================================
        2. CALCOLO E RENDER AVANZAMENTO TRANCHE (PROGRESS BAR & MODAL)
    ===================================================== */
function renderTranchesProgress(data) {
        const totalAccumulated = Number(data.totalCreditAccumulated || 0);
        const completedTranches = Math.floor(totalAccumulated / 1000);
        const currentProgress = parseFloat((totalAccumulated % 1000).toFixed(2));
        const currentPercentage = parseFloat(((currentProgress / 1000) * 100).toFixed(1));
        
        if (dashTrancheLabel) dashTrancheLabel.innerText = `Active Tranche: #${completedTranches + 1}`;
        if (dashProgressBarFill) dashProgressBarFill.style.width = `${currentPercentage}%`;
        if (dashProgressText) dashProgressText.innerText = `€${currentProgress.toFixed(2)} / €1,000.00 (${currentPercentage}%)`;
        if (dashUnlockedCashback) dashUnlockedCashback.innerText = `Unlocked Tranches: ${completedTranches}`;
        
        if (tranchesContainerEl) {
            tranchesContainerEl.innerHTML = '';
            for (let i = 0; i <= completedTranches; i++) {
                const isCompleted = i < completedTranches;
                const trancheVal = isCompleted ? 1000 : currentProgress;
                const pct = isCompleted ? 100 : currentPercentage;
                const item = document.createElement('div');
                item.className = `tranche-item ${isCompleted ? 'completed' : ''}`;
                item.style.cssText = 'background: rgba(15, 23, 42, 0.6); padding: 12px; border-radius: 10px; border: 1px solid var(--border-color); margin-bottom: 10px;';
                
                item.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.9rem; font-weight: bold; margin-bottom: 6px;">
                        <span style="color: var(--accent-green-bright);">Tranche #${i + 1} ${isCompleted ? '✅ Unlocked' : '⏳ In Progress'}</span>
                        <span style="color: ${isCompleted ? 'var(--accent-yellow)' : 'var(--text-muted)'};">
                            ${isCompleted ? '🎉 Milestone €1,000 Reached!' : 'Target: €1,000.00'}
                        </span>
                    </div>
                    <div class="progress-track" style="height: 8px; margin: 6px 0; background: rgba(255,255,255,0.08); border-radius: 4px; overflow: hidden;">
                        <div class="progress-fill" style="width: ${pct}%; background: ${isCompleted ? 'var(--accent-yellow)' : 'var(--accent-green-bright)'}; height: 100%;"></div>
                    </div>
                    <div style="font-size: 0.75rem; color: var(--text-muted); display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
                        <span>Progress: €${trancheVal.toFixed(2)} / €1,000.00</span>
                        <span>${pct}%</span>
                    </div>
                    ${isCompleted ? `
                        <div style="margin-top: 10px; padding: 10px; background: rgba(234, 179, 8, 0.1); border: 1px solid var(--accent-yellow); border-radius: 8px; text-align: center;">
                            <p style="margin: 0 0 6px 0; font-size: 0.8em; color: var(--accent-yellow); font-weight: bold;">
                                <span style="font-size: 1.2em; animation: blink 1.5s infinite; display: inline-block;">🪙</span> Tranche #${i + 1} Reward Ticket & QR Code Ready
                            </p>
                            <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=TRANCHE-${i+1}-${userEmail}" alt="Tranche QR Code" style="width: 80px; height: 80px; border-radius: 6px; border: 1px solid var(--accent-yellow); padding: 4px; background: white;" />
                            <p style="margin: 4px 0 0 0; font-size: 0.7em; color: var(--text-muted);">Present QR code for B2B pool payout validation</p>
                        </div>
                    ` : ''}
                `;
                tranchesContainerEl.appendChild(item);
            }
        }
    }

    /* =====================================================
        3. VERIFICA SOGLIA €1000 E GENERAZIONE TICKET
    ===================================================== */
    async function checkThousandThreshold() {
        if (!userEmail) return;
        try {
            const res = await fetch('/api/check-thousand-threshold');
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
            const res = await fetch(`/api/eco-actions/user/${encodeURIComponent(userEmail)}`);
            const data = await res.json();
            const actions = data.actions || [];

            if (!assetsList) return;

let totalCreditsAcc = 0;
            let totalCo2Acc = 0;
            let totalSpentValue = 0; // Valore economico reale accumulato per le tranche

            actions.forEach(act => {
                totalCreditsAcc += Number(act.credits_earned || 0);
                totalCo2Acc += Number(act.co2_saved_kg || 0);
                
// Prende solo il valore economico reale dello scontrino/bene, senza fallback sui crediti
                const itemValue = Number(act.amount || act.price || act.total_amount || act.value || 0);
                totalSpentValue += itemValue;
            });

            const treesAcc = Math.floor(totalCo2Acc / 25);

            if (userCreditsEl) userCreditsEl.textContent = `${totalCreditsAcc.toFixed(1)} CC`;
            if (totalCo2El) totalCo2El.textContent = `${totalCo2Acc.toFixed(1)} kg`;
            if (totalTreesEl) totalTreesEl.textContent = `${treesAcc} 🌳`;
            if (treeBannerTextEl) treeBannerTextEl.textContent = `${treesAcc} Tree Equivalent`;

renderTranchesProgress({
    ...data,
    totalCreditAccumulated: totalSpentValue
});

            if (actions.length === 0) {
                assetsList.innerHTML = `
                    <p class="empty-msg" style="text-align: center; color: var(--text-muted); padding: 24px; background: var(--card-bg); border-radius: 12px; border: 1px dashed var(--border-color);">
                        No green assets or receipts registered yet. Click the button above to register your first dMRV action!
                    </p>`;
                return;
            }

            assetsList.innerHTML = '';
            actions.forEach(action => {
                const co2Kg = action.co2_saved_kg || 0;
                const isB2B = action.tier === 'B2B_INSTITUTIONAL';
                const statusBadge = action.status === 'in_review_batch' ? '⏳ Under Batch Review' : '✓ Active';

                const card = document.createElement('div');
                card.className = 'asset-item';
                card.style.cssText = 'display: flex; flex-direction: column; padding: 16px; border: 1px solid var(--accent-green-bright); margin-bottom: 14px; background: var(--card-bg); border-radius: 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);';

                card.innerHTML = `
                    <div class="asset-info" style="width: 100%;">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                            <h4 style="margin: 0; color: var(--accent-green-bright); font-size: 1.1em;">${action.title}</h4>
                            <span style="font-size: 0.7em; padding: 3px 8px; border-radius: 4px; font-weight: bold; background: ${isB2B ? 'rgba(56, 189, 248, 0.15)' : 'rgba(234, 179, 8, 0.15)'}; color: ${isB2B ? 'var(--accent-blue)' : 'var(--accent-yellow)'}; border: 1px solid ${isB2B ? 'var(--accent-blue)' : 'var(--accent-yellow)'};">
                                ${isB2B ? 'TIER 2 B2B' : 'TIER 1 COMMUNITY'}
                            </span>
                        </div>
                        <p style="margin: 0 0 8px 0; font-size: 0.85em; color: var(--text-muted);">
                            Category: <strong>${action.category}</strong> | Source: ${action.source || 'Manual Input'} | Status: <em style="color: var(--accent-green-bright);">${statusBadge}</em>
                        </p>
                        <p style="margin: 6px 0; font-size: 0.95em; color: #f8fafc;">
                            🌱 Avoided CO₂: <strong>${co2Kg} kg</strong> &nbsp;|&nbsp; <span style="font-size: 1.3em; animation: blink 1.5s infinite; display: inline-block;">🪙</span> Credits: <strong style="color: var(--accent-yellow);">+${action.credits_earned} CC</strong>
                        </p>
                        <p style="margin: 6px 0 0 0; font-size: 0.85em; color: var(--accent-green-bright); font-weight: 500;">
                            <span style="font-size: 1.3em; animation: blink 1.5s infinite; display: inline-block;">💰</span> Cash Value & Social Credits based on pool market fluctuation
                        </p>
                    </div>
                    ${action.photo_url ? `<div style="margin: 12px 0;"><img src="${action.photo_url}" class="asset-thumb" alt="Attachment" style="width: 100%; max-height: 140px; object-fit: cover; border-radius: 8px; border: 1px solid var(--accent-green-bright);"></div>` : ''}
                    <div style="margin-top: 14px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.08); display: flex; flex-direction: column; gap: 8px; width: 100%; box-sizing: border-box;">
                        <a href="/verify/${action.id}" target="_blank" style="background: rgba(132, 204, 22, 0.15); color: var(--accent-green-bright); border: 1px solid var(--accent-green-bright); padding: 12px 14px; border-radius: 8px; font-size: 0.9em; font-weight: bold; text-decoration: none; display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; box-sizing: border-box; text-align: center;">
                            🔍 dMRV Certified Audit
                        </a>
                        <button class="btn-delete-asset" data-id="${action.id}" style="background: rgba(239, 68, 68, 0.15); border: 1px solid var(--danger-red); color: var(--danger-red); font-size: 0.9em; font-weight: bold; cursor: pointer; padding: 12px 14px; border-radius: 8px; width: 100%; box-sizing: border-box; text-align: center;">
                            🗑 Remove Asset
                        </button>
                    </div>
                `;

const deleteBtn = card.querySelector(`button[data-id="${action.id}"]`);
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async () => {
        if (confirm("Are you sure you want to remove this registered asset? Earned credits will be deducted.")) {
          await deleteEcoAction(action.id);
        }
      });
    }

                assetsList.appendChild(card);
            });
        } catch (err) {
            console.error("Error loading eco actions:", err);
        }
    }

    /* =====================================================
        5. ELIMINAZIONE AZIONE ECO / BENE
    ===================================================== */
async function deleteEcoAction(actionId) {
  try {
    const res = await fetch(`/api/eco-actions/${actionId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ user_email: userEmail })
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
        7. CONTROL EVENTI MODALE TRANCHE
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