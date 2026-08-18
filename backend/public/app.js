// Data model per il Quiz basato sulla Preparedness Union Strategy UE (Zaino delle 72h)
const questions = [
  {
    id: 'family',
    question: '1. Composition of the household',
    subtitle: 'Calculation of the number of people to protect during the first 72 hours',
    options: [
      { text: 'Adults only (1–2 people)', score: 20 },
      { text: 'Family with young children or infants', score: 15 },
      { text: 'Family with elderly members or people with reduced mobility', score: 15 },
      { text: 'Presence of individuals dependent on life-saving medication / medical devices', score: 10 }
    ]
  },
  {
    id: 'water_food',
    question: '2. Essential Water and Food Supplies',
    subtitle: 'Have you stocked at least 2 liters of water per person per day, plus non-perishable food?',
    options: [
      { text: 'No specific stockpile (reliance on the public grid and daily purchasing)', score: 5 },
      { text: 'Sufficient for 24-48 hours (Canned food and a few bottles of water)', score: 12 },
      { text: 'Full 72h+ EU (At least 2L of water/day per person + energy bars/freeze-dried food)', score: 20 }
    ]
  },
  {
    id: 'energy_comms',
    question: '3. Power, Lighting, and Official Communications',
    subtitle: 'How do you manage the absence of the power grid or internet connection?',
    options: [
      { text: 'No backup devices (Total reliance on power grid and standard smartphone)', score: 5 },
      { text: 'Basic (Charged power bank and battery-powered flashlight)', score: 12 },
      { text: 'Advanced EU (Power bank, hand-crank/battery flashlight, hand-crank radio for official updates)', score: 20 }
    ]
  },
  {
id: 'docs_cash',
    question: '4. Document Protection, Cash, and Tools',
    subtitle: 'Have you organized critical assets for banking outages or evacuations?',
    options: [
      { text: 'No preparation (Scattered documents and no cash reserve)', score: 5 },
      { text: 'Partial (I have copies of documents but no small bills or multi-tool)', score: 12 },
      { text: 'EU Standard (Documents in waterproof pouch, small-denomination cash, multi-tool knife)', score: 20 }
    ]
  },
  {
    id: 'health_safety',
    question: '5. First Aid, Personal Medications, and Fire Starters',
    subtitle: 'What is the readiness level of your health and survival kit?',
    options: [
      { text: 'Incomplete (No dedicated first aid medical kit)', score: 5 },
      { text: 'Basic (Bandages, disinfectant, and a few OTC medications)', score: 12 },
      { text: 'Full EU (First aid kit, supply of personal medications, waterproof matches)', score: 20 }    ]
  }
];

let currentQuestionIndex = 0;
let userAnswers = {};
let totalScore = 0;

// Elementi DOM
const landingScreen = document.getElementById('landing');
const quizScreen = document.getElementById('quiz');
const resultScreen = document.getElementById('result');

const startBtn = document.getElementById('startBtn');
const questionEl = document.getElementById('question');
const optionsEl = document.getElementById('options');
const progressBar = document.getElementById('progressBar');
const currentStepEl = document.getElementById('currentStep');

const scoreEl = document.getElementById('score');
const breakdownEl = document.getElementById('breakdown');
const planEl = document.getElementById('plan');
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

function startQuiz() {
  landingScreen.classList.remove('active');
  landingScreen.style.display = 'none';
  quizScreen.classList.add('active');
  quizScreen.style.display = 'block';
  
  currentQuestionIndex = 0;
  totalScore = 0;
  userAnswers = {};
  
  showQuestion();
}

function showQuestion() {
  const q = questions[currentQuestionIndex];
  questionEl.innerText = q.question;
  
  currentStepEl.innerText = `${currentQuestionIndex + 1} di ${questions.length}`;
  const progressPercent = ((currentQuestionIndex + 1) / questions.length) * 100;
  if (progressBar) {
    progressBar.style.width = `${progressPercent}%`;
    progressBar.style.height = '8px';
    progressBar.style.backgroundColor = '#38bdf8';
    progressBar.style.borderRadius = '4px';
    progressBar.style.transition = 'width 0.3s ease';
  }

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
  quizScreen.classList.remove('active');
  quizScreen.style.display = 'none';
  resultScreen.classList.add('active');
  resultScreen.style.display = 'block';

  scoreEl.innerText = `${totalScore}%`;

  let statusTitle = '';
  let statusDesc = '';

if (totalScore < 50) {
    statusTitle = '⚠️ High Vulnerability Compared to EU Standard';
    statusDesc = 'Your household has critical gaps in water (2L/day/person), waterproof document pouch, small-denomination cash, and emergency communications.';
  } else if (totalScore < 80) {
    statusTitle = '⚡ Moderate Resilience (Room for Improvement)';
    statusDesc = 'You have a solid base for 24-48 hours, but key items are missing, such as a hand-crank radio, cash reserve, or waterproof matches.';
  } else {
    statusTitle = '🛡️ Full Compliance with EU Preparedness Strategy';
    statusDesc = 'Excellent preparation! Your household is ready to independently manage the first 72 hours in any unforeseen scenario.';
  }

  breakdownEl.innerHTML = `
    <h3 style="color: #38bdf8; margin-top: 20px; font-size: 1.1rem;">${statusTitle}</h3>
    <p style="color: #94a3b8; font-size: 0.95rem; line-height: 1.5;">${statusDesc}</p>
  `;

planEl.innerHTML = `
    <div style="background: rgba(56, 189, 248, 0.05); border: 1px dashed #38bdf8; padding: 16px; border-radius: 8px; margin: 20px 0; font-size: 0.9rem; color: #cbd5e1; line-height: 1.5;">
      📌 <strong>Customized 72h Bug-Out Bag Preview:</strong><br/>
      • Calculation matrix for water liters and non-perishable food for each household member.<br/>
      • Guide to document waterproofing and cash reserve management.<br/>
      • Tactical accessories list (Hand-crank radio, multi-tool, dynamo flashlight).
    </div>
  `;
}

function restartQuiz() {
  resultScreen.classList.remove('active');
  resultScreen.style.display = 'none';
  landingScreen.classList.add('active');
  landingScreen.style.display = 'block';
}