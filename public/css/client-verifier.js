document.addEventListener("DOMContentLoaded", () => {
  const ecoForm = document.getElementById("ecoActionForm");

  if (!ecoForm) return;

  ecoForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const submitBtn = ecoForm.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerText = "Analisi IA in corso...";
    }

    const formData = new FormData(ecoForm);

    // Recupera l'email salvata nel session/localStorage se non inserita direttamente
    const storedEmail = localStorage.getItem("userEmail") || sessionStorage.getItem("userEmail");
    if (storedEmail && !formData.get("email")) {
      formData.set("email", storedEmail);
    }

    try {
      const response = await fetch("/api/eco-actions", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || "Errore nella verifica dell'azione.");
      }

      // Popola ed evidenzia il modale/esito dinamico
      showSuccessModal(data);
      ecoForm.reset();

    } catch (error) {
      alert(`❌ Errore Audit: ${error.message}`);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerText = "Invia ed Analizza Azione";
      }
    }
  });
});

/**
 * Aggiorna gli elementi HTML del modale con i dati restituiti dal server dMRV
 */
function showSuccessModal(data) {
  // 1. Messaggio principale dell'Audit Gemini & Badge Tier
  const msgEl = document.getElementById("modalMessage");
  const tierEl = document.getElementById("modalTierBadge");
  if (msgEl) msgEl.innerText = data.message;
  if (tierEl) {
    const isB2B = data.tier === "B2B_INSTITUTIONAL";
    tierEl.innerText = isB2B ? "Tier 2 — Grado Istituzionale" : "Tier 1 — Impatto Community";
    tierEl.style.color = isB2B ? "#38bdf8" : "#eab308";
  }

  // 2. Metriche Ambientali ed Equivalenti Calcolati
  const co2El = document.getElementById("modalCo2Saved");
  const treesEl = document.getElementById("modalTreesEquiv");
  const kmEl = document.getElementById("modalKmDriven");
  const b2bValEl = document.getElementById("modalB2bValue");

  if (co2El) co2El.innerText = `${data.co2SavedKg} kg`;
  if (treesEl) treesEl.innerText = `${data.treesEquivalent} 🌲`;
  if (kmEl) kmEl.innerText = `${data.equivalents?.kmDriven || 0} km`;
  if (b2bValEl) b2bValEl.innerText = `€ ${data.estimatedB2bValEur.toFixed(2)}`;

  // 3. Crediti Aggiunti & ID Batch
  const creditsEl = document.getElementById("modalCreditsEarned");
  const batchEl = document.getElementById("modalBatchId");
  if (creditsEl) creditsEl.innerText = `+${data.creditsAdded} Crediti`;
  if (batchEl) batchEl.innerText = data.batchId;

  // 4. Anteprima Immagine Caricata (se presente)
  const imgPreview = document.getElementById("modalPhotoPreview");
  if (imgPreview && data.photoUrl) {
    imgPreview.src = data.photoUrl;
    imgPreview.style.display = "block";
  }

  // 5. Visibilità Modale
  const modal = document.getElementById("resultModal");
  if (modal) {
    modal.classList.add("active");
    modal.style.display = "flex";
  }
}

/**
 * Funzione di chiusura modale richiamabile dal bottone "Chiudi" o "Vai alla Dashboard"
 */
function closeModal() {
  const modal = document.getElementById("resultModal");
  if (modal) {
    modal.classList.remove("active");
    modal.style.display = "none";
  }
}