const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { GoogleGenAI } = require("@google/genai");

// Simpan API Key Anda di sini (aman di sisi server)
const GEMINI_API_KEY = "MASUKKAN_API_KEY_GEMINI_ANDA";
const ai = new GoogleGenAI({ apiKey: AQ.Ab8RN6IatWLYHvJmN5l2Odug7W5BRneNvflt0Fe9wq7VkDLYyg });

exports.generatePerangkat = onCall(async (request) => {
  // 1. Pastikan yang mengakses sudah login di Firebase Auth
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