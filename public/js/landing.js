document.addEventListener('DOMContentLoaded', () => {
    const checkboxes = document.querySelectorAll('#quizForm input[type="checkbox"]');
    const cashbackVal = document.getElementById('cashbackVal');

    function updateCalculations() {
        let total = 0;
        checkboxes.forEach(cb => {
            if (cb.checked) {
                total += parseFloat(cb.value);
            }
        });
        cashbackVal.textContent = total;
    }

    checkboxes.forEach(cb => cb.addEventListener('change', updateCalculations));
});