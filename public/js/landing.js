document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('quizForm');
    const cashbackVal = document.getElementById('cashbackVal');
    const co2Val = document.getElementById('co2Val');

    function updateCalculations() {
        let totalCashback = 0;
        let totalCo2 = 0;

        const checkedBoxes = form.querySelectorAll('input[type="checkbox"]:checked');
        checkedBoxes.forEach(cb => {
            totalCashback += parseFloat(cb.value || 0);
            totalCo2 += parseFloat(cb.dataset.co2 || 0);
        });

        if (cashbackVal) cashbackVal.textContent = totalCashback.toFixed(2);
        if (co2Val) co2Val.textContent = totalCo2;

        return { totalCashback, totalCo2 };
    }

    form.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('change', updateCalculations);
    });

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const totals = updateCalculations();

        // Salva le stime calcolate per mostrarle nella success page
        localStorage.setItem('userCashback', totals.totalCashback.toFixed(2));
        localStorage.setItem('userCo2', totals.totalCo2);

        // Reindirizza direttamente al checkout per il pagamento
        window.location.href = '/checkout.html';
    });
});