const express = require("express");
const path = require("path");
const cors = require("cors");
require("dotenv").config(); // 1. Carica le variabili .env per prima cosa

const app = express(); // 2. Inizializza Express PRIMA di qualsiasi app.use()

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const db = require("./db");

/* =====================================================
   CORS, MIDDLEWARE & CARTELLA PUBLIC (FRONTEND)
===================================================== */

app.use(cors());
app.use(express.json()); // Mantiene attivo il parsing del body JSON per le chiamate API

// Serviamo i file statici dalla cartella public (index.html, checkout.html, style.css...)
app.use(express.static(path.join(__dirname, "public")));

// Serviamo i file della cartella protected (dashboard.html, emergency.html, scenarios...)
app.use("/protected", express.static(path.join(__dirname, "protected")));

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
   MIDDLEWARE PARSER JSON PER LE ALTRE ROTTE
===================================================== */

app.use(express.json());

/* =====================================================
   ROTTE PAGINE FRONTEND
===================================================== */

// Home page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Scorciatoia per la Dashboard
app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "protected", "dashboard.html"));
});

// Scorciatoia per la Red Mode / Emergenza
app.get("/emergency", (req, res) => {
  res.sendFile(path.join(__dirname, "protected", "emergency.html"));
});

/* =====================================================
   HEALTH CHECK
===================================================== */

app.get("/api", (req, res) => {
  res.json({ status: "ok" });
});

/* =====================================================
   STRIPE PUBLIC KEY
===================================================== */

app.get("/api/stripe-config", (req, res) => {
  res.json({
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
  });
});

/* =====================================================
   CREA PAGAMENTO INIZIALE (0,69 €)
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
      "INSERT OR IGNORE INTO users (email, premium) VALUES (?, 0)",
      [email],
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

    console.log("INITIAL PAYMENT CREATED:", paymentIntent.id);

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

/* =====================================================
   CREA ABBONAMENTO (7 GG PROVA, POI 35 €/MESE)
===================================================== */

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

    console.log("SUBSCRIPTION CREATED:", subscription.id);

    db.run(
      "UPDATE users SET premium = 1 WHERE email = ?",
      [email],
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
   CHECK USER STATUS
===================================================== */

app.get("/api/user", (req, res) => {
  const email = req.query.email;

  if (!email) {
    return res.status(400).json({ error: "missing_email" });
  }

  db.get(
    "SELECT premium FROM users WHERE email = ?",
    [email],
    (error, row) => {
      if (error) {
        return res.status(500).json({ error: error.message });
      }

      res.json({
        premium: row ? row.premium === 1 : false,
      });
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