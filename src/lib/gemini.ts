const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

const GEMINI_MODELS = ["gemini-2.0-flash", "gemini-1.5-flash"];

export const isGeminiConfigured = (): boolean => !!GEMINI_API_KEY;

const callGemini = async (
  model: string,
  prompt: string,
  imageBase64: string,
  imageMimeType: string,
  temperature = 0.1
): Promise<string> => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: prompt },
            { inline_data: { mime_type: imageMimeType, data: imageBase64 } },
          ],
        },
      ],
      generationConfig: { temperature },
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Gemini ${model} error ${response.status}: ${detail.slice(0, 200)}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string" || !text.trim()) {
    throw new Error(`Gemini ${model} returned an empty response`);
  }
  return text.trim();
};

export const chatViaGemini = async (
  prompt: string,
  imageBase64: string,
  imageMimeType: string,
  temperature = 0.1
): Promise<string> => {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY not configured");
  }

  let lastError = "";
  for (const model of GEMINI_MODELS) {
    try {
      return await callGemini(model, prompt, imageBase64, imageMimeType, temperature);
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      console.warn(`Gemini ${model} failed: ${lastError.slice(0, 200)}`);
    }
  }

  throw new Error(`All Gemini models failed. Last error: ${lastError.slice(0, 200)}`);
};
