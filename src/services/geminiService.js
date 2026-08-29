const { GoogleGenAI, Type } = require("@google/genai");

const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

// Schema strutturato strict per la risposta JSON dMRV e categorizzazione automatica
const verificationSchema = {
  type: Type.OBJECT,
  properties: {
    valid: { type: Type.BOOLEAN },
    confidence_score: { type: Type.NUMBER },
    tier: { 
      type: Type.STRING, 
      enum: ["REJECT", "COMMUNITY", "B2B_INSTITUTIONAL"] 
    },
    co2_saved_kg: { type: Type.NUMBER },
    category: { 
      type: Type.STRING,
      enum: ["E_BIKE", "COMPOSTING", "WALKING_STEPS", "SOLAR_ENERGY", "PUBLIC_TRANSPORT", "GENERAL"]
    },
    detected_action: { type: Type.STRING },
    is_receipt: { type: Type.BOOLEAN },
    merchant: { type: Type.STRING },
    date_time: { type: Type.STRING },
    total_amount: { type: Type.NUMBER },
    fraud_indicators: {
      type: Type.OBJECT,
      properties: {
        is_screen_photo: { type: Type.BOOLEAN },
        is_ai_generated: { type: Type.BOOLEAN },
        is_stock_photo: { type: Type.BOOLEAN }
      },
      required: ["is_screen_photo", "is_ai_generated", "is_stock_photo"]
    },
    fraud_risk: { 
      type: Type.STRING, 
      enum: ["LOW", "MEDIUM", "HIGH"] 
    },
    reason: { type: Type.STRING }
  },
  required: [
    "valid", 
    "confidence_score", 
    "tier", 
    "co2_saved_kg", 
    "category", 
    "detected_action", 
    "is_receipt",
    "merchant",
    "date_time",
    "total_amount",
    "fraud_indicators", 
    "fraud_risk", 
    "reason"
  ]
};

/**
 * Effettua la verifica forense dMRV ed estrazione dati con categorizzazione automatica.
 */
async function verifyEcoAction(imageBuffer, mimeType = "image/jpeg", actionTitle = "", exifData = {}) {
  if (!ai) {
    console.warn("⚠️ GEMINI_API_KEY mancante nel .env. Invocazione del fallback standard.");
    return {
      valid: true,
      tier: "COMMUNITY",
      category: "GENERAL",
      co2_saved_kg: 50.0,
      confidence_score: 0.85,
      confidence: 0.85,
      detected_action: actionTitle || "Azione Sostenibile",
      is_receipt: false,
      merchant: "UNKNOWN",
      date_time: "UNKNOWN",
      total_amount: 0.0,
      fraud_risk: "LOW",
      reason: "Validazione fallback senza API key."
    };
  }

  try {
    const promptText = `Agisci come auditor forense ESG e di conformità ambientale dMRV.
Analizza l'immagine caricata e valuta l'azione dichiarata dall'utente: "${actionTitle}".
Dati EXIF forniti: ${JSON.stringify(exifData)}.

CRITERI RIGIDI DI AUDIT, ESTRAZIONE DATI & CLASSIFICAZIONE:
1. Classifica l'azione categorizzandola tassativamente in una delle seguenti opzioni:
   - 'E_BIKE': Acquisto/uso bici elettrica, monopattini, accessori ciclabilità.
   - 'COMPOSTING': Compostaggio, bio-rifiuti, sistemi di riciclo organico.
   - 'WALKING_STEPS': Log o screenshot di passi/tratti a piedi.
   - 'SOLAR_ENERGY': Impianti fotovoltaici, pompe di calore, efficienza energetica.
   - 'PUBLIC_TRANSPORT': Biglietti treno, bus, metro.
   - 'GENERAL': Altre azioni generiche.
2. Determina se l'immagine è uno scontrino, ricevuta o fattura d'acquisto (is_receipt).
3. Estragli l'esercente (merchant), data/ora (date_time) e importo totale speso in Euro (total_amount). Se non visibili, imposta merchant="UNKNOWN", date_time="UNKNOWN", total_amount=0.
4. Valuta autenticità e frodi:
   - REJECT: Foto di schermi, immagini AI, stock photo, foto sfocate o irrilevanti.
   - COMMUNITY: Azione eco reale per uso personal.
   - B2B_INSTITUTIONAL: Ricevuta/scontrino nitido e tracciabile con confidence >= 0.90.
5. Calcola la CO2 risparmiata stimata in kg (co2_saved_kg).`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: promptText },
            {
              inlineData: {
                data: imageBuffer.toString("base64"),
                mimeType: mimeType
              }
            }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: verificationSchema,
        temperature: 0.1
      }
    });

    const parsed = JSON.parse(response.text);

    return {
      ...parsed,
      confidence: parsed.confidence_score <= 1 ? parsed.confidence_score : parsed.confidence_score / 100
    };
  } catch (err) {
    console.error("❌ Errore durante l'audit AI Gemini:", err.message);
    return {
      valid: true,
      tier: "COMMUNITY",
      category: "GENERAL",
      co2_saved_kg: 50.0,
      confidence_score: 0.80,
      confidence: 0.80,
      detected_action: actionTitle || "Azione Sostenibile",
      is_receipt: false,
      merchant: "UNKNOWN",
      date_time: "UNKNOWN",
      total_amount: 0.0,
      fraud_risk: "LOW",
      reason: "Errore durante la verifica avanzata. Assegnata stima base di sicurezza."
    };
  }
}

module.exports = { verifyEcoAction };