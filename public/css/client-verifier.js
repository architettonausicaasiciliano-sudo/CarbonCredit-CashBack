document.addEventListener("DOMContentLoaded", () => {
  const ecoForm = document.getElementById("ecoActionForm");

  if (!ecoForm) return;

  ecoForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const submitBtn = ecoForm.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn ? submitBtn.innerText : "Invia ed Analizza Azione";

    // 1. Individua il file caricato nell'input foto/scontrino
    const fileInput = ecoForm.querySelector('input[type="file"]');
    const file = fileInput && fileInput.files ? fileInput.files[0] : null;

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerText = "⏳ Generazione Impronta dMRV...";
    }

    try {
      const formData = new FormData(ecoForm);

      // 2. Controllo Anti-Duplicato tramite Impronta Digitale SHA-256
      if (file) {
        const fileHash = await generateFileHash(file);
        
        // Verifica con il server se l'hash dello scontrino esiste già
        const checkRes = await fetch(`/api/check-duplicate?hash=${fileHash}`);
        if (checkRes.ok) {
          const checkData = await checkRes.json();
          if (checkData.isDuplicate) {
            throw new Error("⛔ SCONTRINO GIÀ REGISTRATO! Questa prova d'acquisto è già stata caricata ed elaborata nel sistema.");
          }
        }

        // Aggiunge l'hash univoco ai dati inviati al server
        formData.append("fileHash", fileHash);
      }

      if (submitBtn) {
        submitBtn.innerText = "🔍 Analisi IA Forense in corso...";
      }

      // 3. Recupera l'email salvata nel session/localStorage se non inserita direttamente
      const storedEmail = localStorage.getItem("userEmail") || sessionStorage.getItem("userEmail");
      if (storedEmail && !formData.get("email")) {
        formData.set("email", storedEmail);
      }

      // 4. Invio dati per analisi dMRV
      const response = await fetch("/api/eco-actions", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || "Errore nella verifica dell'azione.");
      }

      // Popola ed evidenzia il modale con l'esito dell'audit
      showSuccessModal(data);
      ecoForm.reset();

    } catch (error) {
      alert(`❌ Errore Audit: ${error.message}`);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerText = originalBtnText;
      }
    }
  });
});

/**
 * Genera l'impronta SHA-256 univoca per il file dello scontrino
 */
async function generateFileHash(file) {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

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

  if (co2El) co2El.innerText = `${data.co2SavedKg || 0} kg`;
  if (treesEl) treesEl.innerText = `${data.treesEquivalent || 0} 🌲`;
  if (kmEl) kmEl.innerText = `${data.equivalents?.kmDriven || 0} km`;
  if (b2bValEl && data.estimatedB2bValEur !== undefined) {
    b2bValEl.innerText = `€ ${Number(data.estimatedB2bValEur).toFixed(2)}`;
  }

  // 3. Crediti Aggiunti & ID Batch
  const creditsEl = document.getElementById("modalCreditsEarned");
  const batchEl = document.getElementById("modalBatchId");
  if (creditsEl) creditsEl.innerText = `+${data.creditsAdded || 0} Crediti`;
  if (batchEl) batchEl.innerText = data.batchId || "BATCH-2026";

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