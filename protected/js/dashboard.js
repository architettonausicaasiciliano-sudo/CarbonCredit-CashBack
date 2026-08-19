document.addEventListener('DOMContentLoaded', async () => {
    const res = await fetch('/api/assets');
    const assets = await res.json();

    const assetsList = document.getElementById('assetsList');
    const totalCashbackEl = document.getElementById('totalCashback');
    const totalCo2El = document.getElementById('totalCo2');

    if (!assets || assets.length === 0) return;

    assetsList.innerHTML = '';
    let totalCashback = 0;

    assets.forEach(asset => {
        const cashback = (asset.estimatedValue * 0.15).toFixed(2); // Stima 15% cashback
        totalCashback += parseFloat(cashback);

        const card = document.createElement('div');
        card.className = 'asset-item';
        card.innerHTML = `
            <div class="asset-info">
                <h4>${asset.title}</h4>
                <p>Data: ${asset.date} | Tipo: ${asset.type}</p>
                <p>Valore dichiarato: € ${asset.estimatedValue} → <strong>Cashback: € ${cashback}</strong></p>
            </div>
            ${asset.photoUrl ? `<img src="${asset.photoUrl}" class="asset-thumb" alt="Allegato">` : ''}
        `;
        assetsList.appendChild(card);
    });

    totalCashbackEl.textContent = `€ ${totalCashback.toFixed(2)}`;
    totalCo2El.textContent = `${(totalCashback * 0.05).toFixed(2)} Ton`;
});