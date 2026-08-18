/* ==========================================================================
   MySafeHaven Core Application Script
   - Quiz Preparedness Strategy UE (72h)
   - Pitch Demo Mode & Dynamic Data Generator
   - PWA Service Worker Registration
   - KPI & ROI Counter Animations
   ========================================================================== */

// ==========================================
// 1. PWA SERVICE WORKER REGISTRATION
// ==========================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('🟢 PWA Service Worker successfully registered:', reg.scope))
      .catch(err => console.warn('⚠️ Service Worker registration failed:', err));
  });
}

// ==========================================
// 2. DATA MODEL QUIZ (Preparedness Strategy UE)
// ==========================================
const questions = [
  {
    id: 'family',
    question: '1. Household Composition',
    subtitle: 'Calculating the number of people to protect during the first 72 hours',
    options: [
      { text: 'Adults only (1-2 people)', score: 20 },
      { text: 'Family with young children or infants', score: 15 },
      { text: 'Family with elderly or individuals with reduced mobility', score: 15 },
      { text: 'Presence of individuals dependent on life-saving medications / medical devices', score: 10 }
    ]
  },
  {
    id: 'water_food',
    question: '2. Essential Water & Food Reserves',
    subtitle: 'Have you stored at least 2 Liters of water per day per person + non-perishable food?',
    options: [
      { text: 'No specific stock (Total reliance on public grid and daily shopping)', score: 5 },
      { text: 'Sufficient for 24-48 hours (Canned food and a few water bottles)', score: 12 },
      { text: 'Full EU 72h+ (At least 2L water/day per person + energy bars/freeze-dried food)', score: 20 }
    ]
  },
  {
    id: 'energy_comms',
    question: '3. Power, Lighting & Official Communications',
    subtitle: 'How do you handle the loss of power grid or internet connectivity?',
    options: [
      { text: 'No backup devices (Total reliance on power grid and standard smartphone)', score: 5 },
      { text: 'Basic (Charged power bank and battery flashlight)', score: 12 },
      { text: 'Advanced EU (Power bank, hand-crank/battery flashlight, hand-crank radio for official news)', score: 20 }
    ]
  },
  {
    id: 'docs_cash',
    question: '4. Document Protection, Emergency Cash & Tools',
    subtitle: 'Have you organized critical assets for banking freezes or evacuations?',
    options: [
      { text: 'No preparation (Scattered documents and no cash reserve)', score: 5 },
      { text: 'Partial (Copies of documents, but no small-bill cash or tools)', score: 12 },
      { text: 'Standard EU (Documents in waterproof pouch, small-bill cash reserve, multi-tool knife)', score: 20 }
    ]
  },
  {
    id: 'health_safety',
    question: '5. First Aid, Personal Medication & Fire Starter Tools',
    subtitle: 'What is the readiness level of your health and survival kit?',
    options: [
      { text: 'Incomplete (No dedicated first aid medical kit)', score: 5 },
      { text: 'Basic (Bandages, disinfectant, and some OTC medication)', score: 12 },
      { text: 'Full EU (First aid kit, personal medication reserve, waterproof matches)', score: 20 }
    ]
  }
];

let currentQuestionIndex = 0;
let userAnswers = {};
let totalScore = 0;

// Elementi DOM (Inizializzati in modo sicuro)
document.addEventListener('DOMContentLoaded', () => {
  initQuizEvents();
  initPitchDemoUI();
  updateDashboardKPIs();
});

function initQuizEvents() {
  const startBtn = document.getElementById('startBtn');
  const unlockBtn = document.getElementById('unlockBtn');
  const restartBtn = document.getElementById('restartBtn');

  if (startBtn) startBtn.addEventListener('click', startQuiz);

  if (unlockBtn) {
    unlockBtn.addEventListener('click', () => {
      localStorage.setItem('mySafeHaven_score', totalScore);
      localStorage.setItem('mySafeHaven_answers', JSON.stringify(userAnswers));
      window.location.href = 'checkout.html';
    });
  }

  if (restartBtn) restartBtn.addEventListener('click', restartQuiz);
}

// ==========================================
// 3. LOGICA QUIZ
// ==========================================
function startQuiz() {
  const landingScreen = document.getElementById('landing');
  const quizScreen = document.getElementById('quiz');
  
  if (landingScreen) {
    landingScreen.classList.remove('active');
    landingScreen.style.display = 'none';
  }
  if (quizScreen) {
    quizScreen.classList.add('active');
    quizScreen.style.display = 'block';
  }
  
  currentQuestionIndex = 0;
  totalScore = 0;
  userAnswers = {};
  
  showQuestion();
}

function showQuestion() {
  const questionEl = document.getElementById('question');
  const currentStepEl = document.getElementById('currentStep');
  const progressBar = document.getElementById('progressBar');
  const optionsEl = document.getElementById('options');

  const q = questions[currentQuestionIndex];
  if (questionEl) questionEl.innerText = q.question;
  
  if (currentStepEl) currentStepEl.innerText = `${currentQuestionIndex + 1} di ${questions.length}`;
  
  const progressPercent = ((currentQuestionIndex + 1) / questions.length) * 100;
  if (progressBar) {
    progressBar.style.width = `${progressPercent}%`;
    progressBar.style.height = '8px';
    progressBar.style.backgroundColor = '#38bdf8';
    progressBar.style.borderRadius = '4px';
    progressBar.style.transition = 'width 0.3s ease';
  }

  if (!optionsEl) return;
  optionsEl.innerHTML = '';

  q.options.forEach((opt) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.style.cssText = `
      display: block;
      width: 100%;
      padding: 14px 18px;
      margin: 12px 0;
      background: #1e293b;
      color: #f8fafc;
      border: 1px solid #334155;
      border-radius: 8px;
      text-align: left;
      cursor: pointer;
      font-size: 0.95rem;
      transition: all 0.2s ease;
    `;
    btn.innerText = opt.text;
    
    btn.addEventListener('mouseover', () => {
      btn.style.borderColor = '#38bdf8';
      btn.style.background = '#0f172a';
    });
    btn.addEventListener('mouseout', () => {
      btn.style.borderColor = '#334155';
      btn.style.background = '#1e293b';
    });

    btn.addEventListener('click', () => handleOptionSelect(q.id, opt));
    optionsEl.appendChild(btn);
  });
}

function handleOptionSelect(qId, selectedOption) {
  userAnswers[qId] = selectedOption.text;
  totalScore += selectedOption.score;

  currentQuestionIndex++;
  if (currentQuestionIndex < questions.length) {
    showQuestion();
  } else {
    showResults();
  }
}

function showResults() {
  const quizScreen = document.getElementById('quiz');
  const resultScreen = document.getElementById('result');
  const scoreEl = document.getElementById('score');
  const breakdownEl = document.getElementById('breakdown');
  const planEl = document.getElementById('plan');

  if (quizScreen) {
    quizScreen.classList.remove('active');
    quizScreen.style.display = 'none';
  }
  if (resultScreen) {
    resultScreen.classList.add('active');
    resultScreen.style.display = 'block';
  }

  if (scoreEl) scoreEl.innerText = `${totalScore}%`;

  let statusTitle = '';
  let statusDesc = '';

  if (totalScore < 50) {
    statusTitle = '⚠️ High Vulnerability regarding EU Standards';
    statusDesc = 'Your household has critical gaps in water reserves (2L/day/person), waterproof document protection, small denomination cash, and emergency communications.';
  } else if (totalScore < 80) {
    statusTitle = '⚡ Moderate Resilience (Room for Improvement)';
    statusDesc = 'You have a solid foundation for 24-48 hours, but key items are missing, such as a hand-crank radio, emergency cash reserves, or waterproof matches.';
  } else {
    statusTitle = '🛡️ Full Compliance with EU Preparedness Strategy';
    statusDesc = 'Excellent preparation! Your household is ready to manage the first 72 hours in total autonomy during any unexpected crisis.';
  }

  if (breakdownEl) {
    breakdownEl.innerHTML = `
      <h3 style="color: #38bdf8; margin-top: 20px; font-size: 1.1rem;">${statusTitle}</h3>
      <p style="color: #94a3b8; font-size: 0.95rem; line-height: 1.5;">${statusDesc}</p>
    `;
  }

  if (planEl) {
    planEl.innerHTML = `
      <div style="background: rgba(56, 189, 248, 0.05); border: 1px dashed #38bdf8; padding: 16px; border-radius: 8px; margin: 20px 0; font-size: 0.9rem; color: #cbd5e1; line-height: 1.5;">
        📌 <strong>Anteprima dello Zaino delle 72h Personalizzato:</strong><br/>
        • Calculation matrix for water liters and non-perishable food per family member.<br/>
        • Document waterproofing guide and emergency cash management plan.<br/>
        • Tactical accessories list (Hand-crank radio, multi-tool, dynamo flashlight).
      </div>
    `;
  }
}

function restartQuiz() {
  const resultScreen = document.getElementById('result');
  const landingScreen = document.getElementById('landing');

  if (resultScreen) {
    resultScreen.classList.remove('active');
    resultScreen.style.display = 'none';
  }
  if (landingScreen) {
    landingScreen.classList.add('active');
    landingScreen.style.display = 'block';
  }
}

// ==========================================
// 4. PITCH DEMO MODE & KPI CALCULATOR
// ==========================================

/**
 * Carica dati dimostrativi realistici a valore elevato per la demo
 */
function loadPitchDemoData() {
  const demoInventory = [
    { name: "3kW Portable Solar Power System", category: "Energy", value: 850.00, date: "2030-12-31" },
    { name: "LiFePO4 200Ah Energy Storage Battery", category: "Energy", value: 450.00, date: "2029-06-15" },
    { name: "UV Water Purifier & Ceramic Filter", category: "Water", value: 220.00, date: "2028-01-10" },
    { name: "Trauma & Advanced First Aid Medical Kit", category: "Medical", value: 160.00, date: "2027-09-20" },
    { name: "EU 72h Multi-band Hand-Crank Radio", category: "Comms", value: 85.00, date: "2032-05-01" },
    { name: "72h Freeze-Dried Food Reserve (4 People)", category: "Food", value: 185.00, date: "2031-10-15" }
  ];

  localStorage.setItem('inventoryItems', JSON.stringify(demoInventory));
  localStorage.setItem('mySafeHaven_score', 92); // Punteggio dimostrativo alto

  alert('⚡ Pitch Demo data successfully loaded!');
  location.reload();
}

/**
 * Calcola e anima i valori nei banner KPI della dashboard
 */
function updateDashboardKPIs() {
  const items = JSON.parse(localStorage.getItem('inventoryItems') || '[]');
  const totalValue = items.reduce((sum, item) => sum + (parseFloat(item.value) || 0), 0);
  const estimatedRoi = totalValue * 0.75; // ROI stimato al 75% del valore protetto

  const kpiTotalEl = document.getElementById('kpiTotalValue');
  const kpiRoiEl = document.getElementById('kpiRoiValue');
  const kpiItemsEl = document.getElementById('kpiTotalItems');

  if (kpiTotalEl) animateCounter(kpiTotalEl, 0, totalValue, '€');
  if (kpiRoiEl) animateCounter(kpiRoiEl, 0, estimatedRoi, '+€');
  if (kpiItemsEl) animateCounter(kpiItemsEl, 0, items.length, '');
}

/**
 * Utility per animazione dei numeri (effetto conteggio)
 */
function animateCounter(element, start, end, prefix = '') {
  let current = start;
  const duration = 1000; // 1 secondo
  const stepTime = 30;
  const steps = duration / stepTime;
  const increment = (end - start) / steps;

  const timer = setInterval(() => {
    current += increment;
    if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
      current = end;
      clearInterval(timer);
    }
    element.innerText = `${prefix}${current.toLocaleString('it-IT', { minimumFractionDigits: prefix ? 2 : 0, maximumFractionDigits: 2 })}`;
  }, stepTime);
}

// Esporta le funzioni globali per richiamo da HTML
window.loadPitchDemoData = loadPitchDemoData;
window.updateDashboardKPIs = updateDashboardKPIs;
