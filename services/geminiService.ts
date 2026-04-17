import { GoogleGenAI, Modality } from "@google/genai";

interface GenerateSpeechParams {
  text: string;
  voiceId: string; // This is the apiId like 'Kore', 'Puck'
  speed: number;
  pitch: number;
  isSSML: boolean;
}

// Function to escape special XML characters for safe inclusion in SSML
function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

export const generateSpeech = async ({ text, voiceId, speed, pitch, isSSML }: GenerateSpeechParams): Promise<string> => {
  if (!process.env.API_KEY) {
    throw new Error("API key is missing. Please ensure it is configured correctly.");
  }
  
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  let promptText = text;

  // If not using custom SSML, wrap the plain text with SSML to apply speed and pitch controls.
  if (!isSSML) {
    const rate = Math.max(0.5, Math.min(2.0, speed));
    const pitchValue = Math.max(-12, Math.min(12, pitch));
    // The rate value for prosody should be a number (1.0 is normal).
    // The pitch value should be in semitones (e.g., "-2st", "+4st").
    promptText = `<speak><prosody rate="${rate}" pitch="${pitchValue}st">${escapeXml(text)}</prosody></speak>`;
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: promptText }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceId },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!base64Audio) {
      console.error("Gemini API Response:", JSON.stringify(response, null, 2));
      throw new Error("No audio data received from the API. The request might have been blocked or resulted in an empty response.");
    }

    return base64Audio;
  } catch (error: any) {
    console.error("Error calling Gemini API:", error);
    throw new Error(`Failed to generate speech: ${error.message || 'An unknown error occurred'}`);
  }
};
