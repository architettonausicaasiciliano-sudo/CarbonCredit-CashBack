/**
 * Helper per il calcolo delle tranche e dello spillover
 */
function calculateTranches(totalEur) {
  const TRANCHE_SIZE = 1000.0;
  const CASHBACK_PER_TRANCHE = 100.0; // 10% di 1.000 €

  const completedTranches = Math.floor(totalEur / TRANCHE_SIZE);
  const currentTrancheProgress = parseFloat((totalEur % TRANCHE_SIZE).toFixed(2));
  const currentTranchePercentage = parseFloat(((currentTrancheProgress / TRANCHE_SIZE) * 100).toFixed(1));
  const unlockedCashback = completedTranches * CASHBACK_PER_TRANCHE;

  return {
    totalAccumulatedEur: totalEur,
    completedTranches,
    currentTrancheProgress,
    currentTrancheTarget: TRANCHE_SIZE,
    currentTranchePercentage,
    unlockedCashback,
  };
}

module.exports = { calculateTranches };