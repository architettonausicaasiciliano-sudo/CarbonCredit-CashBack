import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI(); // Legge automaticamente GEMINI_API_KEY dal file .env

const verificationSchema = {
  type: Type.OBJECT,
  properties: {
    valid: { type: Type.BOOLEAN },
    confidence_score: { type: Type.INTEGER },
    tier: { 
      type: Type.STRING, 
      enum: ["TIER_0_REJECT", "TIER_1_COMMUNITY", "TIER_2_B2B_INSTITUTIONAL"] 
    },
    estimated_co2_kg: { type: Type.NUMBER },
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
    reasoning: { type: Type.STRING }
  },
  required: ["valid", "confidence_score", "tier", "estimated_co2_kg", "detected_action", "fraud_indicators", "reasoning"]
};

export async function verifyEcoAction(imageBuffer, mimeType, exifData = {}) {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        inlineData: {
          data: imageBuffer.toString('base64'),
          mimeType: mimeType
        }
      },
      {
        text: `Agisci come un auditor forense ESG e di conformità ambientale dMRV.
        Analizza l'immagine caricata considerando anche questi dati EXIF: ${JSON.stringify(exifData)}.

        CRITERI RIGIDI DI CLASSIFICAZIONE:
        - TIER_0_REJECT: Foto di schermi (pattern Moiré), immagini generate da AI, foto da stock, foto sfuocate.
        - TIER_1_COMMUNITY: Azione eco reale (es. borraccia, spesa bio), ma priva di seriali/metadati EXIF per B2B.
        - TIER_2_B2B_INSTITUTIONAL: Azione verificabile ad alta precisione (es. impianti fotovoltaici, contatori energetici, piantumazione geolocalizzata). Confidence >= 90.`
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: verificationSchema,
      temperature: 0.1
    }
  });

  return JSON.parse(response.text);
}