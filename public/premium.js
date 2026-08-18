import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabase = createClient(
  "https://yzdmjfpwxqhzfdvoqcai.supabase.co",
  "sb_publishable_TEeZZG6M_RWYvv7jkFe5pQ_biH2qgpY"
);

/* =========================
   🔐 ACCESS CHECK (DEVE STARE QUI)
========================= */

const email = localStorage.getItem("email");

if (!email) {
  window.location.href = "index.html";
}

const { data } = await supabase
  .from("users")
  .select("premium")
  .eq("email", email)
  .single();

if (!data || data.premium !== true) {
  window.location.href = "checkout.html";
} 
const score = Number(localStorage.getItem("riskScore") || 0);
const weakest = localStorage.getItem("weakestArea") || "Unknown";

function getLevel(score) {
  if (score < 40) return "HIGH";
  if (score < 70) return "MEDIUM";
  return "LOW";
}

const level = getLevel(score);

const app = document.getElementById("premiumDashboard");

/* =========================
   CONTENT ENGINE
========================= */

const content = {
  dashboard: `
    <h2>📊 Overview</h2>
    <p><strong>Risk Score:</strong> ${score}%</p>
    <p><strong>Level:</strong> ${level}</p>
    <p><strong>Weakest Area:</strong> ${weakest}</p>

    <div class="card">
      <p>⚠ This plan adapts to your survival readiness level.</p>
    </div>
  `,

  blackout: {
    HIGH: `
      <h2>⚡ Blackout - Critical Plan</h2>
      <ul>
        <li>Secure lighting immediately (torches, phone backup)</li>
        <li>Disconnect non-essential devices</li>
        <li>Preserve battery life aggressively</li>
        <li>Prepare 72h isolation mode</li>
      </ul>
    `,
    MEDIUM: `
      <h2>⚡ Blackout - Preparedness Plan</h2>
      <ul>
        <li>Check all power banks weekly</li>
        <li>Prepare emergency lighting in key rooms</li>
        <li>Reduce consumption during peak risk</li>
      </ul>
    `,
    LOW: `
      <h2>⚡ Blackout - Maintenance Mode</h2>
      <ul>
        <li>Maintain backup systems</li>
        <li>Monthly check of batteries</li>
      </ul>
    `
  },

  water: {
    HIGH: `
      <h2>💧 Water Crisis - Emergency</h2>
      <ul>
        <li>Secure minimum 10L per person immediately</li>
        <li>Identify alternative water sources</li>
        <li>Stop all non-essential usage</li>
      </ul>
    `,
    MEDIUM: `
      <h2>💧 Water - Preparation Phase</h2>
      <ul>
        <li>Build 5–7 day reserve</li>
        <li>Store clean containers</li>
      </ul>
    `,
    LOW: `
      <h2>💧 Water - Stable</h2>
      <ul>
        <li>Maintain 3-day reserve</li>
      </ul>
    `
  },

  food: {
    HIGH: `
      <h2>🍞 Food Crisis</h2>
      <ul>
        <li>Immediate 72h food supply required</li>
        <li>Focus on non-perishable food</li>
      </ul>
    `,
    MEDIUM: `
      <h2>🍞 Food Security</h2>
      <ul>
        <li>Expand to 7-day reserve</li>
        <li>Plan rotation system</li>
      </ul>
    `,
    LOW: `
      <h2>🍞 Food Stable</h2>
      <ul>
        <li>Monthly inventory rotation</li>
      </ul>
    `
  }
};

/* =========================
   UI STATE
========================= */

let currentView = "dashboard";

/* =========================
   RENDER APP
========================= */

function render() {
  app.innerHTML = `
    <div class="saas">

      <div class="sidebar">
        <h3>MySafeHaven</h3>

        <button onclick="navigate('dashboard')">Dashboard</button>
        <button onclick="navigate('blackout')">Blackout</button>
        <button onclick="navigate('water')">Water</button>
        <button onclick="navigate('food')">Food</button>
      </div>

      <div class="main">
        ${renderContent()}
      </div>

    </div>
  `;
}

function renderContent() {
  if (currentView === "dashboard") return content.dashboard;

  return content[currentView][level];
}

window.navigate = (view) => {
  currentView = view;
  render();
};

/* =========================
   INIT
========================= */

render();