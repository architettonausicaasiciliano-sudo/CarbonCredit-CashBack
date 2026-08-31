/**
 * Helper per il calcolo delle tranche e dello spillover con registro dettagliato
 */
function calculateTranches(totalEur) {
  const TRANCHE_SIZE = 1000.0;
  const CASHBACK_PER_TRANCHE = 100.0; // 10% di 1.000 €

  const amount = parseFloat(totalEur) || 0;
  const completedCount = Math.floor(amount / TRANCHE_SIZE);
  const currentProgress = parseFloat((amount % TRANCHE_SIZE).toFixed(2));
  const currentPercentage = parseFloat(((currentProgress / TRANCHE_SIZE) * 100).toFixed(1));
  const totalUnlockedCashback = completedCount * CASHBACK_PER_TRANCHE;

  // Elenco dettagliato di ciascuna tranche per il rendering nel frontend
  const tranchesList = [];

  // 1. Tranche già completate
  for (let i = 1; i <= completedCount; i++) {
    tranchesList.push({
      id: i,
      number: i,
      title: `Tranche #${i}`,
      range: `${(i - 1) * 1000}€ - ${i * 1000}€`,
      targetEur: TRANCHE_SIZE,
      accumulatedEur: TRANCHE_SIZE,
      percentage: 100,
      cashbackEur: CASHBACK_PER_TRANCHE,
      isCompleted: true,
      unlocked: true,
      status: "completed"
    });
  }

  // 2. Tranche in corso (attiva)
  const activeTrancheNumber = completedCount + 1;
  tranchesList.push({
    id: activeTrancheNumber,
    number: activeTrancheNumber,
    title: `Tranche #${activeTrancheNumber}`,
    range: `${completedCount * 1000}€ - ${(completedCount + 1) * 1000}€`,
    targetEur: TRANCHE_SIZE,
    accumulatedEur: currentProgress,
    percentage: currentPercentage,
    cashbackEur: parseFloat((currentProgress * 0.10).toFixed(2)),
    isCompleted: false,
    unlocked: false,
    status: "in_progress"
  });

  return {
    totalAccumulatedEur: amount,
    completedTranches: completedCount,
    currentTrancheProgress: currentProgress,
    currentTrancheTarget: TRANCHE_SIZE,
    currentTranchePercentage: currentPercentage,
    unlockedCashback: totalUnlockedCashback,
    tranches: tranchesList,
    tranchesList
  };
}

module.exports = { calculateTranches };