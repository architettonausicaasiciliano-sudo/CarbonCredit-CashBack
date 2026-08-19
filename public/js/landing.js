document.addEventListener('DOMContentLoaded', () => {
    const quizForm = document.getElementById('quizForm');
    const checkboxes = document.querySelectorAll('#quizForm input[type="checkbox"]');
    const cashbackVal = document.getElementById('cashbackVal');
    const co2Val = document.getElementById('co2Val');

    // Calcolo dinamico di Cashback e CO2
    function updateCalculations() {
        let totalCashback = 0;
        let totalCo2 = 0;

        checkboxes.forEach(cb => {
            if (cb.checked) {
                const val = parseFloat(cb.value) || 0;
                // Prende i kg di CO2 dall'attributo data-co2 se presente, altrimenti calcola una stima
                const co2 = parseFloat(cb.getAttribute('data-co2')) || (val * 15);
                
                totalCashback += val;
                totalCo2 += co2;
            }
        });

        if (cashbackVal) {
            cashbackVal.textContent = totalCashback.toLocaleString('it-IT', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        }
        
        if (co2Val) {
            co2Val.textContent = Math.round(totalCo2).toLocaleString('it-IT');
        }

        return { totalCashback, totalCo2 };
    }

    // Aggiorna il calcolo in tempo reale ad ogni selezione
    checkboxes.forEach(cb => cb.addEventListener('change', updateCalculations));

    // Calcolo iniziale all'avvio
    updateCalculations();

    // Gestione del form quiz per reindirizzare al Checkout salvando la stima
    if (quizForm) {
        quizForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const { totalCashback, totalCo2 } = updateCalculations();

            // Salva la stima calcolata nel localStorage per la schermata di pagamento/dashboard
            localStorage.setItem('estimatedCashback', totalCashback.toFixed(2));
            localStorage.setItem('estimatedCo2', Math.round(totalCo2));

            // Reindirizza al checkout dell'abbonamento
            window.location.href = '/checkout.html';
        });
    }

    // Registrazione opzionale del Service Worker PWA
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
});