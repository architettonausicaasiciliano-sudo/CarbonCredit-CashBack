const express = require("express");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const multer = require("multer");
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
   AI VISION VERIFIER ENGINE (~0,0001€/foto)
===================================================== */
async function verifyActionWithAI(imagePath, actionTitle) {
  if (!ai) {
    console.warn("Gemini API Key mancante nel .env. Uso stima di ripiego.");
    return { valid: true, category: "GENERAL", co2_saved_kg: 5.0, confidence: 0.5 };
  }

  try {
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString("base64");

    const prompt = `Analizza questa immagine relativa all'azione ecologica: "${actionTitle}".
    Rispondi ESCLUSIVAMENTE con un oggetto JSON valido con questa esatta struttura:
    {
      "valid": true,
      "category": "LAND_MANAGEMENT",
      "co2_saved_kg": 12.5,
      "confidence": 0.95
    }
    Valori ammessi per category: "LAND_MANAGEMENT", "FLIGHT_OFFSET", "ENERGY_SAVING", "RECYCLING", "GENERAL".`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            { inlineData: { mimeType: "image/jpeg", data: base64Image } }
          ]
        }
      ],
      config: { responseMimeType: "application/json" }
    });

    return JSON.parse(response.text);
  } catch (err) {
    console.error("AI MRV Verification Error:", err.message);
    return { valid: true, category: "GENERAL", co2_saved_kg: 5.0, confidence: 0.5 };
  }
}

/* =====================================================
   AUTOMATED B2B BROKER LIQUIDATION TRIGGER
===================================================== */
async function triggerAutoBrokerLiquidation(batchId, totalCo2Ton) {
  console.log(`🚀 SOGLIA RAGGIUNTA: Avvio liquidazione automatica di ${totalCo2Ton} Ton per Batch ${batchId}`);

  db.run(
    "UPDATE transactions SET status = 'liquidated_payout_ready' WHERE status = 'pending_batch'",
    (err) => {
      if (err) console.error("Errore aggiornamento transazioni batch:", err.message);
      else console.log(`✅ Batch ${batchId} aggregato e inviato al marketplace B2B.`);
    }
  );
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
   API CONFIG & HEALTH CHECK
===================================================== */
app.get("/api", (req, res) => res.json({ status: "ok" }));
app.get("/api/stripe-config", (req, res) => {
  res.json({ publishableKey: process.env.STRIPE_PUBLISHABLE_KEY });
});

/* =====================================================
   CHECK DUPLICATI (HASH CLIENT)
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
      "SELECT SUM(co2_saved_kg) as total_co2 FROM eco_actions WHERE user_email = ?",
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
   GESTIONE AZIONI ECO CON AI VERIFICATION & AUTO-BROKER
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
  const { email, title, category, creditsEarned, co2SavedKg, source, amountSpend, imageHash } = req.body;

  if (!email || !title) {
    return res.status(400).json({ error: "missing_fields" });
  }

  let finalCategory = category || "GENERAL";
  let co2 = parseFloat(co2SavedKg);

  // 1. Processamento AI se la foto è allegata
  if (req.file) {
    const aiResult = await verifyActionWithAI(req.file.path, title);

    if (!aiResult.valid) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: "Foto non valida o non corrispondente all'azione." });
    }

    if (isNaN(co2) || co2 <= 0) {
      co2 = aiResult.co2_saved_kg;
    }
    finalCategory = aiResult.category;
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

  // 2. Inserimento nel database
  db.run(
    "INSERT INTO eco_actions (user_email, title, category, credits_earned, co2_saved_kg, source, image_hash) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [email, title, finalCategory, credits, co2, actionSource, imageHash || null],
    function (error) {
      if (error) return res.status(500).json({ error: error.message });

      const actionId = this.lastID;

      // 3. Aggiornamento crediti
      db.run("UPDATE users SET carbon_credits = carbon_credits + ? WHERE email = ?", [credits, email], (updateError) => {
        if (updateError) console.error("CREDITS UPDATE ERROR:", updateError);

        // 4. Registrazione transazione pending batch
        db.run(
          "INSERT INTO transactions (user_email, type, credits, amount_eur, status) VALUES (?, 'earn', ?, ?, 'pending_batch')",
          [email, credits, parseFloat(actionValueEur)]
        );

        // 5. Verifica accumulo globale per vendita automatizzata B2B
        db.get("SELECT SUM(co2_saved_kg) as total_kg FROM eco_actions", [], (err, row) => {
          const totalTon = (row?.total_kg || 0) / 1000;

          if (totalTon >= BATCH_THRESHOLD_TON) {
            triggerAutoBrokerLiquidation(CURRENT_BATCH_ID, totalTon);
          }

          res.json({
            success: true,
            id: actionId,
            creditsAdded: credits,
            co2SavedKg: co2,
            category: finalCategory,
            estimatedB2bValEur: parseFloat(actionValueEur),
            treesEquivalent: actionTrees,
            batchId: CURRENT_BATCH_ID,
            photoUrl: photoUrl,
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
            message: "Richiesta ricevuta. I fondi verranno inviati al termine dell'aggregazione del batch corrente."
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
  console.log(`Server running on port ${PORT}`);
});