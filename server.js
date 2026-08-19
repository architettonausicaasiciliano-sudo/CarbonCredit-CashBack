const express = require("express");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const multer = require("multer");
require("dotenv").config();

const app = express();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const db = require("./db");

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
   CORS & CARTELLA PUBLIC / PROTECTED / UPLOADS
===================================================== */

app.use(cors());

// Serviamo i file statici
app.use(express.static(path.join(__dirname, "public")));
app.use("/protected", express.static(path.join(__dirname, "protected")));
app.use("/uploads", express.static(uploadDir));

/* =====================================================
   STRIPE WEBHOOK (DEVE STARE PRIMA DI express.json)
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

    /* =================================================
        PAGAMENTO INIZIALE RIUSCITO
    ================================================= */

    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object;

      if (
        paymentIntent.metadata &&
        paymentIntent.metadata.type === "initial_payment"
      ) {
        const email = paymentIntent.metadata.email;
        if (email) {
          console.log("INITIAL PAYMENT SUCCEEDED:", email);
        }
      }
    }

    /* =================================================
        ABBONAMENTO CREATO / AGGIORNATO
    ================================================= */

    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated"
    ) {
      const subscription = event.data.object;
      let email = subscription.metadata && subscription.metadata.email;

      if (!email && subscription.customer) {
        try {
          const customer = await stripe.customers.retrieve(
            subscription.customer
          );
          if (customer && !customer.deleted) {
            email = customer.email;
          }
        } catch (error) {
          console.error("CUSTOMER LOOKUP ERROR:", error);
        }
      }

      if (
        email &&
        (subscription.status === "trialing" ||
          subscription.status === "active")
      ) {
        db.run(
          "UPDATE users SET premium = 1 WHERE email = ?",
          [email],
          (error) => {
            if (error) {
              console.error("PREMIUM UPDATE ERROR:", error);
            } else {
              console.log("PREMIUM ACTIVE:", email);
            }
          }
        );
      }
    }

    /* =================================================
        INVOICE PAGATA
    ================================================= */

    if (event.type === "invoice.paid") {
      const invoice = event.data.object;
      let email = invoice.customer_email;

      if (!email && invoice.customer) {
        try {
          const customer = await stripe.customers.retrieve(invoice.customer);
          if (customer && !customer.deleted) {
            email = customer.email;
          }
        } catch (error) {
          console.error("CUSTOMER LOOKUP ERROR:", error);
        }
      }

      if (email) {
        console.log("INVOICE PAID:", email);

        db.run(
          "UPDATE users SET premium = 1 WHERE email = ?",
          [email],
          (error) => {
            if (error) {
              console.error("PREMIUM UPDATE ERROR:", error);
            }
          }
        );
      }
    }

    /* =================================================
        INVOICE NON PAGATA
    ================================================= */

    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object;
      let email = invoice.customer_email;

      if (!email && invoice.customer) {
        try {
          const customer = await stripe.customers.retrieve(invoice.customer);
          if (customer && !customer.deleted) {
            email = customer.email;
          }
        } catch (error) {
          console.error("CUSTOMER LOOKUP ERROR:", error);
        }
      }

      if (email) {
        console.log("INVOICE PAYMENT FAILED:", email);

        db.run(
          "UPDATE users SET premium = 0 WHERE email = ?",
          [email],
          (error) => {
            if (error) {
              console.error("PREMIUM DISABLE ERROR:", error);
            }
          }
        );
      }
    }

    /* =================================================
        ABBONAMENTO CANCELLATO
    ================================================= */

    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object;
      let email = subscription.metadata && subscription.metadata.email;

      if (!email && subscription.customer) {
        try {
          const customer = await stripe.customers.retrieve(
            subscription.customer
          );
          if (customer && !customer.deleted) {
            email = customer.email;
          }
        } catch (error) {
          console.error("CUSTOMER LOOKUP ERROR:", error);
        }
      }

      if (email) {
        console.log("SUBSCRIPTION DELETED:", email);

        db.run(
          "UPDATE users SET premium = 0 WHERE email = ?",
          [email],
          (error) => {
            if (error) {
              console.error("PREMIUM DISABLE ERROR:", error);
            }
          }
        );
      }
    }

    res.json({ received: true });
  }
);

/* =====================================================
   MIDDLEWARE PARSER JSON & FORM-DATA PER LE ALTRE ROTTE
===================================================== */

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* =====================================================
   ROTTE PAGINE FRONTEND
===================================================== */

// Home page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Checkout page
app.get("/checkout", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "checkout.html"));
});

// Dashboard utenti abbonati
app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "protected", "dashboard.html"));
});

// Pagina aggiunta bene / foto scontrino
app.get("/add-asset", (req, res) => {
  res.sendFile(path.join(__dirname, "protected", "add-asset.html"));
});

/* =====================================================
   API CONFIG & HEALTH CHECK
===================================================== */

app.get("/api", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/stripe-config", (req, res) => {
  res.json({
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
  });
});

/* =====================================================
   CREA PAGAMENTO INIZIALE & ABBONAMENTO STRIPE
===================================================== */

app.post("/create-initial-payment", async (req, res) => {
  try {
    const { email, variant, score } = req.body;

    if (!email) {
      return res.status(400).json({ error: "missing_email" });
    }

    const customer = await stripe.customers.create({
      email: email,
      metadata: {
        variant: variant || "A",
        score: score || "0",
      },
    });

    db.run(
      "INSERT OR IGNORE INTO users (email, premium, stripe_customer_id) VALUES (?, 0, ?)",
      [email, customer.id],
      (error) => {
        if (error) {
          console.error("DATABASE INSERT ERROR:", error);
        }
      }
    );

    const paymentIntent = await stripe.paymentIntents.create({
      amount: 69,
      currency: "eur",
      customer: customer.id,
      receipt_email: email,
      setup_future_usage: "off_session",
      automatic_payment_methods: { enabled: true },
      metadata: {
        type: "initial_payment",
        email: email,
        variant: variant || "A",
        score: score || "0",
      },
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

    if (!paymentMethodId) {
      return res.status(400).json({ error: "payment_method_missing" });
    }

    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: process.env.STRIPE_PRICE_ID }],
      trial_period_days: 7,
      default_payment_method: paymentMethodId,
      metadata: {
        email: email,
        variant: variant || "A",
        score: score || "0",
      },
    });

    db.run(
      "UPDATE users SET premium = 1, stripe_customer_id = ? WHERE email = ?",
      [customerId, email],
      (error) => {
        if (error) {
          console.error("PREMIUM TRIAL ERROR:", error);
        } else {
          console.log("PREMIUM TRIAL ACTIVE:", email);
        }
      }
    );

    res.json({
      success: true,
      subscriptionId: subscription.id,
    });
  } catch (error) {
    console.error("SUBSCRIPTION ERROR:", error);
    res.status(500).json({ error: "subscription_error" });
  }
});

/* =====================================================
   CHECK USER STATUS & CREDITS
===================================================== */

app.get("/api/user", (req, res) => {
  const email = req.query.email;

  if (!email) {
    return res.status(400).json({ error: "missing_email" });
  }

  db.get(
    "SELECT email, premium, carbon_credits FROM users WHERE email = ?",
    [email],
    (error, row) => {
      if (error) {
        return res.status(500).json({ error: error.message });
      }

      res.json({
        email: email,
        premium: row ? row.premium === 1 : false,
        carbon_credits: row ? row.carbon_credits : 0.0,
      });
    }
  );
});

/* =====================================================
   GESTIONE AZIONI ECO, UPLOAD FOTO & CREDITI
===================================================== */

// Recupera le azioni eco registrate dall'utente
app.get("/api/eco-actions", (req, res) => {
  const email = req.query.email;
  if (!email) return res.status(400).json({ error: "missing_email" });

  db.all(
    "SELECT * FROM eco_actions WHERE user_email = ? ORDER BY id DESC",
    [email],
    (error, rows) => {
      if (error) return res.status(500).json({ error: error.message });
      res.json({ ecoActions: rows || [] });
    }
  );
});

// Registra una nuova azione sostenibile / upload foto scontrino
app.post("/api/eco-actions", upload.single("photo"), (req, res) => {
  const { email, title, category, creditsEarned, co2SavedKg, source } = req.body;

  if (!email || !title || !category) {
    return res.status(400).json({ error: "missing_fields" });
  }

  const credits = parseFloat(creditsEarned) || 1.0;
  const co2 = parseFloat(co2SavedKg) || 0.0;
  const actionSource = source || "manual";
  const photoUrl = req.file ? `/uploads/${req.file.filename}` : null;

  // 1. Inserisce l'azione nella tabella eco_actions
  db.run(
    "INSERT INTO eco_actions (user_email, title, category, credits_earned, co2_saved_kg, source) VALUES (?, ?, ?, ?, ?, ?)",
    [email, title, category, credits, co2, actionSource],
    function (error) {
      if (error) return res.status(500).json({ error: error.message });

      const actionId = this.lastID;

      // 2. Incrementa il saldo crediti dell'utente
      db.run(
        "UPDATE users SET carbon_credits = carbon_credits + ? WHERE email = ?",
        [credits, email],
        (updateError) => {
          if (updateError) console.error("CREDITS UPDATE ERROR:", updateError);

          // 3. Registra la transazione di guadagno crediti
          db.run(
            "INSERT INTO transactions (user_email, type, credits, amount_eur, status) VALUES (?, 'earn', ?, 0.0, 'completed')",
            [email, credits]
          );

          res.json({
            success: true,
            id: actionId,
            creditsAdded: credits,
            photoUrl: photoUrl,
          });
        }
      );
    }
  );
});

/* =====================================================
   TRANSAZIONI & CASHBACK / MONETIZZAZIONE
===================================================== */

// Recupera le transazioni dell'utente (guadagni e riscatti cashback)
app.get("/api/transactions", (req, res) => {
  const email = req.query.email;
  if (!email) return res.status(400).json({ error: "missing_email" });

  db.all(
    "SELECT * FROM transactions WHERE user_email = ? ORDER BY id DESC",
    [email],
    (error, rows) => {
      if (error) return res.status(500).json({ error: error.message });
      res.json({ transactions: rows || [] });
    }
  );
});

// Richiesta di riscatto cashback in € scambiando crediti di carbonio
app.post("/api/redeem-cashback", (req, res) => {
  const { email, creditsToRedeem, amountEur } = req.body;

  if (!email || !creditsToRedeem || !amountEur) {
    return res.status(400).json({ error: "missing_fields" });
  }

  const credits = parseFloat(creditsToRedeem);
  const amount = parseFloat(amountEur);

  // Verifica se l'utente ha abbastanza crediti
  db.get(
    "SELECT carbon_credits FROM users WHERE email = ?",
    [email],
    (error, row) => {
      if (error) return res.status(500).json({ error: error.message });
      if (!row || row.carbon_credits < credits) {
        return res.status(400).json({ error: "insufficient_credits" });
      }

      // Detrae i crediti e registra la transazione cashback
      db.run(
        "UPDATE users SET carbon_credits = carbon_credits - ? WHERE email = ?",
        [credits, email],
        (updateError) => {
          if (updateError) return res.status(500).json({ error: updateError.message });

          db.run(
            "INSERT INTO transactions (user_email, type, credits, amount_eur, status) VALUES (?, 'cashback', ?, ?, 'pending')",
            [email, credits, amount],
            function (txError) {
              if (txError) return res.status(500).json({ error: txError.message });

              res.json({
                success: true,
                transactionId: this.lastID,
                redeemedCredits: credits,
                cashbackEur: amount,
              });
            }
          );
        }
      );
    }
  );
});

/* =====================================================
   START SERVER
===================================================== */

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});