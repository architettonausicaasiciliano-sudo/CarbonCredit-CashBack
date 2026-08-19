async function calculateImageHash(file) {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Integrazione nel form di caricamento
document.getElementById('uploadForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fileInput = document.getElementById('photoInput');
  const file = fileInput.files[0];

  if (file) {
    const fileHash = await calculateImageHash(file);

    // Verifico sul server se l'hash esiste già
    const checkRes = await fetch(`/api/check-duplicate?hash=${fileHash}`);
    const checkData = await checkRes.json();

    if (checkData.isDuplicate) {
      alert("⚠️ Questa foto è già stata utilizzata o registrata nel sistema.");
      return;
    }

    // Aggiungo l'hash al FormData ed eseguo l'invio
    const formData = new FormData(e.target);
    formData.append('imageHash', fileHash);
    
    await submitAssetForm(formData);
  }
});