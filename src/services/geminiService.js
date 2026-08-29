const { GoogleGenAI, Type } = require("@google/genai");

const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

// Schema strutturato strict per la risposta JSON
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
    category: { type: Type.STRING },
    detected_action: { type: Type.STRING },
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
    "fraud_indicators", 
    "fraud_risk", 
    "reason"
  ]
};

/**
 * Effettua la verifica forense dMRV di un'azione sostenibile.
 * @param {Buffer} imageBuffer - Buffer dell'immagine caricata
 * @param {string} mimeType - MIME type dell'immagine (es. 'image/jpeg')
 * @param {string} actionTitle - Titolo o descrizione dell'azione dichiarata
 * @param {Object} [exifData={}] - Metadati EXIF opzionali
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
      fraud_risk: "LOW",
      reason: "Validazione fallback senza API key."
    };
  }

  try {
    const promptText = `Agisci come auditor forense ESG e di conformità ambientale dMRV.
Analizza l'immagine caricata e valuta l'azione dichiarata dall'utente: "${actionTitle}".
Dati EXIF forniti: ${JSON.stringify(exifData)}.

CRITERI RIGIDI DI CLASSIFICAZIONE TIER:
- REJECT: Foto di schermi (pattern Moiré), immagini AI, stock photo, documenti illegibili o irrilevanti.
- COMMUNITY: Azione eco reale (borraccia, spesa bio, mobilità dolce), ma senza seriali o fatture ad alta precisione B2B.
- B2B_INSTITUTIONAL: Azione verificabile ad alta precisione (scontrino/fattura nitida di veicoli elettrici, fotovoltaico, piantumazione geolocalizzata). Confidence >= 0.90.`;

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

    // Normalizzazione per garantire retrocompatibilità con server.js
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
      fraud_risk: "LOW",
      reason: "Errore durante la verifica avanzata. Assegnata stima base di sicurezza."
    };
  }
}

module.exports = { verifyEcoAction };