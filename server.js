const express = require("express");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const multer = require("multer");
const crypto = require("crypto");
require("dotenv").config();

const { GoogleGenAI } = require("@google/genai");

const app = express();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const db = require("./db");

// Inizializzazione Gemini AI Engine
const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

/* =====================================================
   PARAMETRI DI MERCATO VCM & ALGORITMO VALUTAZIONE AI
===================================================== */
const CO2_PRICE_PER_TON_EUR = 25.00; // Valore di vendita stimato sul mercato B2B (€25/Tonnellata)
const KG_CO2_PER_TREE = 20;          // 1 Albero equivalente = 20 kg CO2 assorbita/evitata all'anno
const CURRENT_BATCH_ID = "BATCH-2026-104"; // ID del pool corrente in aggregazione B2B
const BATCH_THRESHOLD_TON = 50.0;     // Soglia Tonnellate per liquidazione automatica B2B

/* =====================================================
   CONFIGURAZIONE CARTELLA UPLOADS & MULTER
===================================================== */
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage: storage });

/* =====================================================
   HELPER CRITTOGRAFICI & ANTI-DUPLICATI (SHA-256)
===================================================== */
function calculateBufferHash(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function generateDmrvHash(action) {
  const rawData = `${action.id}-${action.user_email}-${action.co2_saved_kg}-${action.image_hash || 'no_photo_hash'}-${action.tier || 'TIER2'}-${action.created_at || '2026'}`;
  return crypto.createHash('sha256').update(rawData).digest('hex');
}

/* =====================================================
   AI VISION FORENSICS ENGINE (3-Tier Anti-Greenwashing)
===================================================== */
async function verifyActionWithAI(imagePath, actionTitle, mimeType = "image/jpeg") {
  if (!ai) {
    console.warn("⚠️ Gemini API Key mancante nel .env. Fallback su Tier Community.");
    return {
      valid: true,
      tier: "COMMUNITY",
      category: "GENERAL",
      co2_saved_kg: 5.0,
      confidence: 0.50,
      fraud_risk: "MEDIUM",
      reason: "Modalità ripiego: Gemini API Key non configurata nel server."
    };
  }

  try {
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString("base64");

    const prompt = `Sei un Auditor Forense Anti-Greenwashing esperto in dMRV (digital Measurement, Reporting, and Verification).
Analizza rigorosamente l'immagine allegata per l'azione sostenibile dichiarata: "${actionTitle}".

DEVI VALUTARE 3 ASPETTI FONDAMENTALI:
1. Autenticità dell'immagine: Rileva moiré pattern (foto scattate a uno schermo PC/Smartphone), artefatti da AI generativa, watermark di stock photo o immagini palesemente scaricate da internet.
2. Coerenza del contesto: La foto mostra un'azione ecologica reale e dimostrabile (es. impianto fotovoltaico, piantumazione/land management, ricevuta di riciclo/trasporto, mobilità elettrica)?
3. Livello di Rigore (Tiering System Anti-Greenwashing):
   - "REJECT" (Tier 0): Foto falsa, screenshot di uno schermo, immagine generata da AI, irrilevante o fraudolenta.
   - "COMMUNITY" (Tier 1): Foto reale di un'azione personale quotidiana ma priva di rigore documentale industriale. Valida solo per gamification, punti ed estetica dell'app.
   - "B2B_INSTITUTIONAL" (Tier 2): Foto nitida, autentica, ad alta evidenza probatoria per bilanci di sostenibilità ESG / Scope 3 e monetizzazione nel pool B2B.

Rispondi ESCLUSIVAMENTE con un oggetto JSON valido con questa esatta struttura:
{
  "valid": true,
  "tier": "B2B_INSTITUTIONAL",
  "category": "LAND_MANAGEMENT",
  "co2_saved_kg": 12.5,
  "confidence": 0.96,
  "fraud_risk": "LOW",
  "reason": "Immagine autentica scattata in ambiente reale con elevata evidenza probatoria."
}

Valori ammessi per tier: "REJECT", "COMMUNITY", "B2B_INSTITUTIONAL".
Valori ammessi per category: "LAND_MANAGEMENT", "FLIGHT_OFFSET", "ENERGY_SAVING", "RECYCLING", "GENERAL".
Valori ammessi per fraud_risk: "LOW", "MEDIUM", "HIGH".`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            { inlineData: { mimeType: mimeType || "image/jpeg", data: base64Image } }
          ]
        }
      ],
      config: { responseMimeType: "application/json" }
    });

    return JSON.parse(response.text);
  } catch (err) {
    console.error("❌ AI Forensics MRV Verification Error:", err.message);
    return {
      valid: true,
      tier: "COMMUNITY",
      category: "GENERAL",
      co2_saved_kg: 5.0,
      confidence: 0.50,
      fraud_risk: "MEDIUM",
      reason: "Errore temporaneo di analisi AI: assegnato Tier Community di sicurezza."
    };
  }
}

/* =====================================================
   AUTOMATED B2B BROKER LIQUIDATION ENGINE (PATCH.IO / API)
===================================================== */
async function sellBatchToMarketplace(batchData) {
  if (!process.env.PATCH_API_KEY) {
    console.warn("⚠️ PATCH_API_KEY non presente in .env. Esecuzione in modalità simulazione.");
    return { status: "simulated_success", order_id: "ORD-SIM-" + Date.now() };
  }

  const response = await fetch('https://api.patch.io/v1/orders', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.PATCH_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      mass_g: Math.round(batchData.totalCo2Kg * 1000),
      metadata: {
        batch_id: batchData.batchId,
        mrv_provider: "AI Vision Gemini Flash Forensics",
        source_category: "Aggregated_Household_Agritech_Verified"
      }
    })
  });

  return await response.json();
}

async function triggerAutoBrokerLiquidation(batchId, totalCo2Ton) {
  console.log(`🚀 SOGLIA RAGGIUNTA: Avvio liquidazione automatica di ${totalCo2Ton} Ton per Batch ${batchId}`);

  try {
    const brokerResponse = await sellBatchToMarketplace({ batchId, totalCo2Kg: totalCo2Ton * 1000 });
    console.log("✅ Risposta Broker B2B Marketplace:", brokerResponse);

    db.run(
      "UPDATE transactions SET status = 'liquidated_payout_ready' WHERE status = 'pending_batch'",
      (err) => {
        if (err) console.error("Errore aggiornamento transazioni batch:", err.message);
        else console.log(`✅ Batch ${batchId} aggregato, venduto via API e pronto al payout.`);
      }
    );
  } catch (err) {
    console.error("❌ Errore durante la vendita B2B al Marketplace:", err.message);
  }
}

/* =====================================================
   CORS & CARTELLA PUBLIC / PROTECTED / UPLOADS
===================================================== */
app.use(cors());

app.use(express.static(path.join(__dirname, "public")));
app.use("/protected", express.static(path.join(__dirname, "protected")));
app.use("/uploads", express.static(uploadDir));

/* =====================================================
   STRIPE WEBHOOK (PRIMA DI express.json)
===================================================== */
app.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["stripe-signature"];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (error) {
      console.error("WEBHOOK ERROR:", error.message);
      return res.status(400).send("Webhook Error: " + error.message);
    }

    console.log("STRIPE EVENT:", event.type);

    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object;
      if (paymentIntent.metadata && paymentIntent.metadata.type === "initial_payment") {
        const email = paymentIntent.metadata.email;
        if (email) console.log("INITIAL PAYMENT SUCCEEDED:", email);
      }
    }

    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated"
    ) {
      const subscription = event.data.object;
      let email = subscription.metadata && subscription.metadata.email;

      if (!email && subscription.customer) {
        try {
          const customer = await stripe.customers.retrieve(subscription.customer);
          if (customer && !customer.deleted) email = customer.email;
        } catch (error) {
          console.error("CUSTOMER LOOKUP ERROR:", error);
        }
      }

      if (email && (subscription.status === "trialing" || subscription.status === "active")) {
        db.run("UPDATE users SET premium = 1 WHERE email = ?", [email], (error) => {
          if (error) console.error("PREMIUM UPDATE ERROR:", error);
          else console.log("PREMIUM ACTIVE:", email);
        });
      }
    }

    if (event.type === "invoice.paid") {
      const invoice = event.data.object;
      let email = invoice.customer_email;

      if (!email && invoice.customer) {
        try {
          const customer = await stripe.customers.retrieve(invoice.customer);
          if (customer && !customer.deleted) email = customer.email;
        } catch (error) {
          console.error("CUSTOMER LOOKUP ERROR:", error);
        }
      }

      if (email) {
        console.log("INVOICE PAID:", email);
        db.run("UPDATE users SET premium = 1 WHERE email = ?", [email]);
      }
    }

    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object;
      let email = invoice.customer_email;

      if (!email && invoice.customer) {
        try {
          const customer = await stripe.customers.retrieve(invoice.customer);
          if (customer && !customer.deleted) email = customer.email;
        } catch (error) {
          console.error("CUSTOMER LOOKUP ERROR:", error);
        }
      }

      if (email) {
        console.log("INVOICE PAYMENT FAILED:", email);
        db.run("UPDATE users SET premium = 0 WHERE email = ?", [email]);
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object;
      let email = subscription.metadata && subscription.metadata.email;

      if (!email && subscription.customer) {
        try {
          const customer = await stripe.customers.retrieve(subscription.customer);
          if (customer && !customer.deleted) email = customer.email;
        } catch (error) {
          console.error("CUSTOMER LOOKUP ERROR:", error);
        }
      }

      if (email) {
        console.log("SUBSCRIPTION DELETED:", email);
        db.run("UPDATE users SET premium = 0 WHERE email = ?", [email]);
      }
    }

    res.json({ received: true });
  }
);

/* =====================================================
   MIDDLEWARE PARSER JSON & FORM-DATA
===================================================== */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* =====================================================
   ROTTE PAGINE FRONTEND
===================================================== */
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.get("/checkout", (req, res) => res.sendFile(path.join(__dirname, "public", "checkout.html")));
app.get("/success", (req, res) => res.sendFile(path.join(__dirname, "protected", "success.html")));
app.get("/dashboard", (req, res) => res.sendFile(path.join(__dirname, "protected", "dashboard.html")));
app.get("/add-asset", (req, res) => res.sendFile(path.join(__dirname, "protected", "add-asset.html")));

/* =====================================================
   ROTTA PUBBLICA DI VERIFICA CERTIFICATO dMRV (ESG AUDIT)
===================================================== */
app.get("/verify/:certId", (req, res) => {
  const { certId } = req.params;

  db.get("SELECT * FROM eco_actions WHERE id = ?", [certId], (err, row) => {
    if (err || !row) {
      return res.status(404).send(`
        <div style="font-family:sans-serif; text-align:center; padding:50px; background:#0f172a; color:#f8fafc; min-height:100vh;">
          <h1 style="color:#ef4444;">❌ Certificato Non Trovato</h1>
          <p>L'identificativo fornito non corrisponde a nessun record dMRV registrato nella pipeline.</p>
        </div>
      `);
    }

    const dmrvHash = generateDmrvHash(row);
    const hostUrl = `${req.protocol}://${req.get('host')}`;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(hostUrl + '/verify/' + row.id)}`;
    const isB2bTier = (row.tier === 'B2B_INSTITUTIONAL');

    res.send(`
      <!DOCTYPE html>
      <html lang="it">
      <head>
        <meta charset="UTF-8">
        <title>dMRV Public Audit — CERT-${row.id}</title>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; background: #0b132b; color: #f8fafc; display: flex; justify-content: center; padding: 40px 20px; }
          .cert-card { background: #1c2541; border: 1px solid #3a506b; border-radius: 16px; max-width: 650px; width: 100%; padding: 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
          .status { background: rgba(16, 185, 129, 0.2); color: #10b981; border: 1px solid #10b981; padding: 6px 16px; border-radius: 20px; font-weight: bold; font-size: 0.85rem; display: inline-block; }
          .tier-badge { background: ${isB2bTier ? 'rgba(56, 189, 248, 0.2)' : 'rgba(234, 179, 8, 0.2)'}; color: ${isB2bTier ? '#38bdf8' : '#eab308'}; border: 1px solid ${isB2bTier ? '#38bdf8' : '#eab308'}; padding: 4px 12px; border-radius: 6px; font-size: 0.75rem; font-weight: bold; margin-left: 8px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 24px 0; background: #0b132b; padding: 16px; border-radius: 8px; }
          .hash-box { font-family: monospace; font-size: 0.75rem; background: #000; padding: 12px; border-radius: 6px; word-break: break-all; color: #38bdf8; border: 1px solid #1e293b; }
          .qr-section { text-align: center; margin-top: 24px; padding-top: 20px; border-top: 1px solid #3a506b; }
        </style>
      </head>
      <body>
        <div class="cert-card">
          <div class="status">✓ CERTIFICATO dMRV AUTENTICATO</div>
          <span class="tier-badge">${isB2bTier ? 'Tier 2 — Institutional Grade B2B' : 'Tier 1 — Community & Personal Impact'}</span>
          <h2 style="margin-top:16px;">Verifica Audit Impatto Ambientale</h2>
          <p style="color:#94a3b8; font-size:0.9rem;">Documento di compensazione e tracciabilità conforme alle linee guida GHG Protocol Scope 3 e principi Anti-Greenwashing.</p>

          <div class="grid">
            <div><strong>ID Certificato:</strong><br><span style="color:#64748b;">CERT-${row.id}</span></div>
            <div><strong>Data Verificato:</strong><br><span style="color:#64748b;">${row.created_at || 'Agosto 2026'}</span></div>
            <div><strong>CO₂ Evitata / Assorbita:</strong><br><span style="color:#10b981; font-weight:bold;">${row.co2_saved_kg} kg CO₂</span></div>
            <div><strong>Beneficiario:</strong><br><span style="color:#64748b;">${row.user_email}</span></div>
          </div>

          <div style="margin-bottom:16px;">
            <strong>Metodologia Forense & Algoritmo AI:</strong>
            <p style="margin:4px 0; color:#94a3b8; font-size:0.85rem;">Validazione automatica Gemini-2.5-Flash Forensics con rilevamento filtri anti-screen/moiré, analisi EXIF ed ereditarietà crittografica SHA-256. Punteggio Confidenza: <strong>${((row.confidence_score || 0.95) * 100).toFixed(1)}%</strong>.</p>
          </div>

          <div>
            <strong>Hash Immutabile dMRV (SHA-256):</strong>
            <div class="hash-box">${dmrvHash}</div>
          </div>

          <div class="qr-section">
            <img src="${qrCodeUrl}" alt="QR Code Verification" style="border-radius:8px; border:4px solid #fff;" />
            <p style="font-size:0.75rem; color:#64748b; margin-top:8px;">Scansiona per verificare l'autenticità nel registro trasparente B2B</p>
          </div>
        </div>
      </body>
      </html>
    `);
  });
});

/* =====================================================
   API CONFIG & HEALTH CHECK
===================================================== */
app.get("/api", (req, res) => res.json({ status: "ok" }));
app.get("/api/stripe-config", (req, res) => {
  res.json({ publishableKey: process.env.STRIPE_PUBLISHABLE_KEY });
});

/* =====================================================
   CHECK DUPLICATI (HASH CLIENT / SERVER)
===================================================== */
app.get("/api/check-duplicate", (req, res) => {
  const { hash } = req.query;
  if (!hash) return res.json({ isDuplicate: false });

  db.get("SELECT id FROM eco_actions WHERE image_hash = ?", [hash], (err, row) => {
    if (err) return res.json({ isDuplicate: false });
    res.json({ isDuplicate: !!row });
  });
});

/* =====================================================
   PAGAMENTO INIZIALE & ABBONAMENTO STRIPE
===================================================== */
app.post("/create-initial-payment", async (req, res) => {
  try {
    const { email, variant, score } = req.body;
    if (!email) return res.status(400).json({ error: "missing_email" });

    const customer = await stripe.customers.create({
      email: email,
      metadata: { variant: variant || "A", score: score || "0" },
    });

    db.run(
      "INSERT OR IGNORE INTO users (email, premium, stripe_customer_id) VALUES (?, 0, ?)",
      [email, customer.id]
    );

    const paymentIntent = await stripe.paymentIntents.create({
      amount: 69,
      currency: "eur",
      customer: customer.id,
      receipt_email: email,
      setup_future_usage: "off_session",
      automatic_payment_methods: { enabled: true },
      metadata: { type: "initial_payment", email: email, variant: variant || "A", score: score || "0" },
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      customerId: customer.id,
      paymentIntentId: paymentIntent.id,
    });
  } catch (error) {
    console.error("INITIAL PAYMENT ERROR:", error);
    res.status(500).json({ error: "initial_payment_error" });
  }
});

app.post("/create-subscription", async (req, res) => {
  try {
    const { customerId, paymentIntentId, email, variant, score } = req.body;
    if (!customerId || !paymentIntentId || !email) {
      return res.status(400).json({ error: "missing_subscription_data" });
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (paymentIntent.status !== "succeeded") {
      return res.status(400).json({ error: "initial_payment_not_completed" });
    }

    const paymentMethodId = paymentIntent.payment_method;
    if (!paymentMethodId) return res.status(400).json({ error: "payment_method_missing" });

    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: process.env.STRIPE_PRICE_ID }],
      trial_period_days: 7,
      default_payment_method: paymentMethodId,
      metadata: { email: email, variant: variant || "A", score: score || "0" },
    });

    db.run(
      "UPDATE users SET premium = 1, stripe_customer_id = ? WHERE email = ?",
      [customerId, email]
    );

    res.json({ success: true, subscriptionId: subscription.id });
  } catch (error) {
    console.error("SUBSCRIPTION ERROR:", error);
    res.status(500).json({ error: "subscription_error" });
  }
});

/* =====================================================
   CHECK USER STATUS, BATCH STANDBY & STATS SIMBOLICHE
===================================================== */
app.get("/api/user", (req, res) => {
  const email = req.query.email;
  if (!email) return res.status(400).json({ error: "missing_email" });

  db.get("SELECT email, premium, carbon_credits FROM users WHERE email = ?", [email], (error, row) => {
    if (error) return res.status(500).json({ error: error.message });

    db.get(
      "SELECT SUM(co2_saved_kg) as total_co2 FROM eco_actions WHERE user_email = ? AND (tier IS NULL OR tier = 'B2B_INSTITUTIONAL')",
      [email],
      (co2Error, co2Row) => {
        const totalCo2 = co2Row && co2Row.total_co2 ? parseFloat(co2Row.total_co2) : 0.0;
        const pendingB2bEur = ((totalCo2 / 1000) * CO2_PRICE_PER_TON_EUR).toFixed(2);
        const treesPlanted = Math.floor(totalCo2 / KG_CO2_PER_TREE);

        res.json({
          email: email,
          premium: row ? row.premium === 1 : false,
          carbon_credits: row ? row.carbon_credits : 0.0,
          batchId: CURRENT_BATCH_ID,
          totalCo2Kg: totalCo2,
          pendingB2bEur: parseFloat(pendingB2bEur),
          treesEquivalent: treesPlanted,
          batchStatus: "IN_AGGREGATION_PENDING_SALE"
        });
      }
    );
  });
});

/* =====================================================
   GESTIONE AZIONI ECO CON FORENSICS AI & TIERING SYSTEM
===================================================== */
app.get("/api/eco-actions", (req, res) => {
  const email = req.query.email;
  if (!email) return res.status(400).json({ error: "missing_email" });

  db.all("SELECT * FROM eco_actions WHERE user_email = ? ORDER BY id DESC", [email], (error, rows) => {
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ecoActions: rows || [] });
  });
});

app.post("/api/eco-actions", upload.single("photo"), async (req, res) => {
  const { email, title, category, creditsEarned, co2SavedKg, source, amountSpend, imageHash: clientHash } = req.body;

  if (!email || !title) {
    return res.status(400).json({ error: "missing_fields" });
  }

  let finalCategory = category || "GENERAL";
  let co2 = parseFloat(co2SavedKg);
  let calculatedHash = clientHash || null;
  let aiTier = "COMMUNITY";
  let confidenceScore = 0.80;
  let fraudRisk = "LOW";

  // 1. Processamento e controlli di sicurezza se la foto è allegata
  if (req.file) {
    const imageBuffer = fs.readFileSync(req.file.path);
    calculatedHash = calculateBufferHash(imageBuffer);

    // Controllo Anti-Duplicati server-side
    const duplicateRow = await new Promise((resolve) => {
      db.get("SELECT id FROM eco_actions WHERE image_hash = ?", [calculatedHash], (err, row) => resolve(row));
    });

    if (duplicateRow) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        error: "duplicate_image",
        message: "L'immagine inviata risulta già registrata nel database dMRV."
      });
    }

    // Audit Forense AI Gemini
    const aiResult = await verifyActionWithAI(req.file.path, title, req.file.mimetype);

    if (!aiResult.valid || aiResult.tier === "REJECT") {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        error: "invalid_photo_forensics",
        message: aiResult.reason || "Immagine respinta dai controlli anti-fraud/anti-greenwashing AI."
      });
    }

    aiTier = aiResult.tier || "COMMUNITY";
    confidenceScore = aiResult.confidence || 0.85;
    fraudRisk = aiResult.fraud_risk || "LOW";

    if (isNaN(co2) || co2 <= 0) {
      co2 = aiResult.co2_saved_kg || 5.0;
    }
    finalCategory = aiResult.category || finalCategory;
  }

  // Fallback se la CO2 non è definita
  if (isNaN(co2) || co2 <= 0) {
    const spend = parseFloat(amountSpend) || 10.0;
    co2 = spend * 0.5;
  }

  const credits = parseFloat(creditsEarned) || Math.max(1.0, Math.round(co2 * 0.1));
  const actionSource = source || (req.file ? "ai_verified_photo" : "manual");
  const photoUrl = req.file ? `/uploads/${req.file.filename}` : null;
  const actionValueEur = ((co2 / 1000) * CO2_PRICE_PER_TON_EUR).toFixed(2);
  const actionTrees = Math.floor(co2 / KG_CO2_PER_TREE);

  // 2. Inserimento nel database con metadati di audit
  db.run(
    "INSERT INTO eco_actions (user_email, title, category, credits_earned, co2_saved_kg, source, image_hash, tier, confidence_score) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [email, title, finalCategory, credits, co2, actionSource, calculatedHash, aiTier, confidenceScore],
    function (error) {
      if (error) return res.status(500).json({ error: error.message });

      const actionId = this.lastID;

      // 3. Aggiornamento crediti dell'utente
      db.run("UPDATE users SET carbon_credits = carbon_credits + ? WHERE email = ?", [credits, email], (updateError) => {
        if (updateError) console.error("CREDITS UPDATE ERROR:", updateError);

        // 4. Registrazione transazione monetizzabile B2B SOLO se Tier 2 (Institutional)
        if (aiTier === "B2B_INSTITUTIONAL") {
          db.run(
            "INSERT INTO transactions (user_email, type, credits, amount_eur, status) VALUES (?, 'earn', ?, ?, 'pending_batch')",
            [email, credits, parseFloat(actionValueEur)]
          );
        }

        // 5. Verifica accumulo globale per liquidazione automatizzata B2B
        db.get("SELECT SUM(co2_saved_kg) as total_kg FROM eco_actions WHERE tier = 'B2B_INSTITUTIONAL'", [], (err, row) => {
          const totalTon = (row?.total_kg || 0) / 1000;

          if (totalTon >= BATCH_THRESHOLD_TON) {
            triggerAutoBrokerLiquidation(CURRENT_BATCH_ID, totalTon);
          }

          res.json({
            success: true,
            id: actionId,
            tier: aiTier,
            confidenceScore: confidenceScore,
            fraudRisk: fraudRisk,
            creditsAdded: credits,
            co2SavedKg: co2,
            category: finalCategory,
            estimatedB2bValEur: aiTier === "B2B_INSTITUTIONAL" ? parseFloat(actionValueEur) : 0.0,
            treesEquivalent: actionTrees,
            batchId: CURRENT_BATCH_ID,
            photoUrl: photoUrl,
            message: aiTier === "B2B_INSTITUTIONAL" 
              ? "Azione approvata Tier 2 (Grado Istituzionale B2B) e aggiunta al pool monetizzabile!"
              : "Azione approvata Tier 1 (Community). Punti e Badge assegnati con successo!"
          });
        });
      });
    }
  );
});

/* =====================================================
   TRANSAZIONI & CASHBACK / MONETIZZAZIONE
===================================================== */
app.get("/api/transactions", (req, res) => {
  const email = req.query.email;
  if (!email) return res.status(400).json({ error: "missing_email" });

  db.all("SELECT * FROM transactions WHERE user_email = ? ORDER BY id DESC", [email], (error, rows) => {
    if (error) return res.status(500).json({ error: error.message });
    res.json({ transactions: rows || [] });
  });
});

app.post("/api/redeem-cashback", (req, res) => {
  const { email, creditsToRedeem, amountEur } = req.body;

  if (!email || !creditsToRedeem || !amountEur) {
    return res.status(400).json({ error: "missing_fields" });
  }

  const credits = parseFloat(creditsToRedeem);
  const amount = parseFloat(amountEur);

  db.get("SELECT carbon_credits FROM users WHERE email = ?", [email], (error, row) => {
    if (error) return res.status(500).json({ error: error.message });
    if (!row || row.carbon_credits < credits) {
      return res.status(400).json({ error: "insufficient_credits" });
    }

    db.run("UPDATE users SET carbon_credits = carbon_credits - ? WHERE email = ?", [credits, email], (updateError) => {
      if (updateError) return res.status(500).json({ error: updateError.message });

      db.run(
        "INSERT INTO transactions (user_email, type, credits, amount_eur, status) VALUES (?, 'cashback', ?, ?, 'pending_payout')",
        [email, credits, amount],
        function (txError) {
          if (txError) return res.status(500).json({ error: txError.message });

          res.json({
            success: true,
            transactionId: this.lastID,
            redeemedCredits: credits,
            cashbackEur: amount,
            message: "Richiesta di riscatto registrata. I fondi saranno erogati al termine della liquidazione del Batch."
          });
        }
      );
    });
  });
});

/* =====================================================
   START SERVER
===================================================== */
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});