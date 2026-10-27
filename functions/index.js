const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { GoogleGenAI } = require("@google/genai");

// File ini tidak lagi memuat kunci rahasia
const GEMINI_API_KEY = "";
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

exports.generatePerangkat = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Anda harus login terlebih dahulu.");
  }

  const { prompt } = request.data;
  if (!prompt) {
    throw new HttpsError("invalid-argument", "Prompt tidak boleh kosong.");
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    return { text: response.text };
  } catch (error) {
    console.error("Gemini Error:", error);
    throw new HttpsError("internal", "Gagal memproses permintaan AI.");
  }
});