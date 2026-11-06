document.addEventListener('DOMContentLoaded', async () => {
    // 1. Recupero credenziali utente con fallback sicuro
    let userEmail = localStorage.getItem('email') || localStorage.getItem('userEmail') || sessionStorage.getItem('userEmail') || 'nausicaa.siciliano@virgilio.it';
    
    // 2. Elementi DOM - Statistiche Principali
    const userCreditsEl = document.getElementById('userCredits');
    const pendingCcValEl = document.getElementById('pendingCcVal');
    const totalCo2El = document.getElementById('totalCo2');
    const totalTreesEl = document.getElementById('totalTrees');
    const treeBannerTextEl = document.getElementById('treeBannerText');
    const batchIdEl = document.getElementById('batchId');
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
        console.warn("User email not found in localStorage.");
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
                if (totalTreesEl) totalTreesEl.innerHTML = `${trees} <span class="blink-slow" style="font-size: 1.3em;">🌳</span>`;
                if (treeBannerTextEl) treeBannerTextEl.textContent = `${trees} Tree Equivalent`;
                if (batchIdEl) batchIdEl.textContent = data.batchId || "BATCH-2026-104";
                if (batchStatusEl) batchStatusEl.textContent = data.batchStatus || "Aggregating for Cashback Payout";

                await checkThousandThreshold();
            }
        } catch (err) {
            console.error("Error fetching user data:", err);
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
                item.style.cssText = 'position: relative; background: rgba(15, 23, 42, 0.6); padding: 14px; border-radius: 10px; border: 1px solid var(--border-color); margin-bottom: 12px;';
                
                item.innerHTML = `
                    ${isCompleted ? `
                        <!-- Logo raddoppiato (64px) in alto a sinistra fuori dal QR code -->
                        <img src="/images/logo.png" alt="Logo" style="position: absolute; top: 12px; left: 12px; width: 64px; height: 64px; object-fit: contain;" />
                    ` : ''}
                    
                    <div style="${isCompleted ? 'margin-left: 70px;' : ''}">
                        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.95rem; font-weight: bold; margin-bottom: 6px;">
                            <span style="color: var(--accent-green-bright);">Tranche #${i + 1} ${isCompleted ? '✅ Unlocked' : '⏳ In Progress'}</span>
                            <span style="color: ${isCompleted ? 'var(--accent-yellow)' : 'var(--text-muted)'};">
                                ${isCompleted ? '🎉 Milestone €1,000.00 Reached!' : 'Target: €1,000.00'}
                            </span>
                        </div>
                        <div class="progress-track" style="height: 10px; margin: 8px 0; background: rgba(255,255,255,0.08); border-radius: 5px; overflow: hidden;">
                            <div class="progress-fill" style="width: ${pct}%; background: ${isCompleted ? 'var(--accent-yellow)' : 'var(--accent-green-bright)'}; height: 100%;"></div>
                        </div>
                        <div style="font-size: 0.8rem; color: var(--text-muted); display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
                            <span>Progress: €${trancheVal.toFixed(2)} / €1,000.00</span>
                            <span>${pct}%</span>
                        </div>
                        ${isCompleted ? `
                            <div style="margin-top: 12px; padding: 12px; background: rgba(234, 179, 8, 0.1); border: 1px solid var(--accent-yellow); border-radius: 8px; text-align: center;">
                                <p style="margin: 0 0 8px 0; font-size: 0.85em; color: var(--accent-yellow); font-weight: bold;">
                                    <span style="font-size: 1.6em;" class="blink-slow">🪙</span> TRANCHE #${i + 1} REWARD TICKET & QR CODE READY
                                </p>
                                <div style="display: flex; justify-content: center; margin: 8px 0;">
                                    <img src="https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=TRANCHE-${i+1}-${encodeURIComponent(userEmail)}" alt="Tranche QR Code" style="width: 90px; height: 90px; border-radius: 6px; border: 1px solid var(--accent-yellow); padding: 4px; background: white;" />
                                </div>
                                <p style="margin: 4px 0 0 0; font-size: 0.75em; color: var(--text-muted); font-style: italic;">
                                    * Present QR code for B2B pool payout validation
                                </p>
                            </div>
                        ` : ''}
                    </div>
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
                console.log(`🎯 Milestone €1,000 reached! Ticket generated: ${data.ticketCode}`);
            }
        } catch (err) {
            console.error("Error checking €1,000 threshold:", err);
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
            let totalSpentValue = 0;

            actions.forEach(act => {
                totalCreditsAcc += Number(act.credits_earned || 0);
                totalCo2Acc += Number(act.co2_saved_kg || 0);
                const itemValue = Number(act.amount || act.price || act.total_amount || act.value || 0);
                totalSpentValue += itemValue;
            });

            const treesAcc = Math.floor(totalCo2Acc / 25);
            if (userCreditsEl) userCreditsEl.textContent = `${totalCreditsAcc.toFixed(1)} CC`;
            if (totalCo2El) totalCo2El.textContent = `${totalCo2Acc.toFixed(1)} kg`;
            if (totalTreesEl) totalTreesEl.innerHTML = `${treesAcc} <span class="blink-slow" style="font-size: 1.3em;">🌳</span>`;
            if (treeBannerTextEl) treeBannerTextEl.textContent = `${treesAcc} Tree Equivalent`;

            renderTranchesProgress({
                ...data,
                totalCreditAccumulated: totalSpentValue
            });

            if (actions.length === 0) {
                assetsList.innerHTML = `
                    <p class="empty-msg" style="text-align: center; color: var(--text-muted); padding: 24px; background: var(--card-bg); border-radius: 12px; border: 1px dashed var(--border-color);">
                        No green assets or receipt proofs registered yet. Click the button above to register your first dMRV action!
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
                card.style.cssText = 'display: flex; flex-direction: column; padding: 18px; border: 1px solid var(--accent-green-bright); margin-bottom: 16px; background: var(--card-bg); border-radius: 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);';
                
                card.innerHTML = `
                    <div class="asset-info" style="width: 100%;">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                            <h4 style="margin: 0; color: var(--accent-green-bright); font-size: 1.15em;">${action.title}</h4>
                            <span style="font-size: 0.75em; padding: 4px 10px; border-radius: 6px; font-weight: bold; background: ${isB2B ? 'rgba(56, 189, 248, 0.15)' : 'rgba(234, 179, 8, 0.15)'}; color: ${isB2B ? 'var(--accent-blue)' : 'var(--accent-yellow)'}; border: 1px solid ${isB2B ? 'var(--accent-blue)' : 'var(--accent-yellow)'};">
                                ${isB2B ? 'TIER 2 B2B' : 'TIER 1 COMMUNITY'}
                            </span>
                        </div>
                        <p style="margin: 0 0 8px 0; font-size: 0.85em; color: var(--text-muted);">
                            Category: <strong>${action.category}</strong> | Source: ${action.source || 'Manual Input'} | Status: <em style="color: var(--accent-green-bright);">${statusBadge}</em>
                        </p>
                        <p style="margin: 8px 0; font-size: 1em; color: #f8fafc;">
                            <span class="blink-slow" style="font-size: 1.4em;">🌱</span> Avoided CO₂: <strong>${co2Kg} kg</strong> &nbsp;|&nbsp; <span class="blink-slow" style="font-size: 1.4em;">🪙</span> Credits: <strong style="color: var(--accent-yellow);">+${action.credits_earned} CC</strong>
                        </p>
                        <p style="margin: 8px 0 0 0; font-size: 0.9em; color: var(--accent-green-bright); font-weight: 500;">
                            <span class="blink-slow" style="font-size: 1.4em;">💰</span> Cash Value & Social Credits based on pool market fluctuation
                        </p>
                    </div>
                    ${action.photo_url ? `<div style="margin: 14px 0;"><img src="${action.photo_url}" class="asset-thumb" alt="Attachment" style="width: 100%; max-height: 160px; object-fit: cover; border-radius: 8px; border: 1px solid var(--accent-green-bright);"></div>` : ''}
                    <div style="margin-top: 14px; padding-top: 14px; border-top: 1px solid rgba(255,255,255,0.08); display: flex; flex-direction: column; gap: 10px; width: 100%; box-sizing: border-box;">
                        <a href="/verify/${action.id}" target="_blank" class="blink-slow" style="background: rgba(132, 204, 22, 0.15); color: var(--accent-green-bright); border: 1px solid var(--accent-green-bright); padding: 12px 14px; border-radius: 8px; font-size: 0.95em; font-weight: bold; text-decoration: none; display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; box-sizing: border-box; text-align: center;">
                            <span style="font-size: 1.4em;">🔍</span> dMRV Certified Audit <span style="font-size: 1.4em;">✨</span>
                        </a>
                        <button class="btn-delete-asset" data-id="${action.id}" style="background: rgba(239, 68, 68, 0.15); border: 1px solid var(--danger-red); color: var(--danger-red); font-size: 0.9em; font-weight: bold; cursor: pointer; padding: 12px 14px; border-radius: 8px; width: 100%; box-sizing: border-box; text-align: center;">
                            <span style="font-size: 1.3em;">🗑️</span> Remove Asset
                        </button>
                    </div>
                `;

                const deleteBtn = card.querySelector('.btn-delete-asset');
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
                alert(`Error removing asset: ${result.message || result.error}`);
            }
        } catch (err) {
            console.error("Error deleting asset:", err);
            alert("An error occurred while removing the asset.");
        }
    }

    /* =====================================================
        6. GESTIONE RICHIESTA CASHBACK (MONETIZZAZIONE)
    ===================================================== */
    if (btnRedeem) {
        btnRedeem.addEventListener('click', async () => {
            if (!userEmail) {
                alert("Please log in with your email address first.");
                return;
            }
            const creditsInput = prompt("Enter the amount of Carbon Credits (CC) to convert to B2B Cashback:");
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
                    alert(`Cashback redemption request registered!\n\nAmount: €${amountEur}\nStatus: Payout request queued in the active B2B Batch.`);
                    await loadUserData();
                    await loadEcoActions();
                } else {
                    alert(`Request error: ${result.error || 'Insufficient credit balance.'}`);
                }
            } catch (err) {
                console.error("Error redeeming cashback:", err);
                alert("An error occurred while submitting the redemption request.");
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