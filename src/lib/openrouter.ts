const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";

const OPENROUTER_MODELS = (
  process.env.OPENROUTER_MODELS ||
  "google/gemma-4-31b-it:free,google/gemma-4-26b-a4b-it:free,nvidia/nemotron-nano-12b-v2-vl:free"
)
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

export const isOpenRouterConfigured = (): boolean => !!OPENROUTER_API_KEY;

const callOpenRouter = async (
  model: string,
  messages: Array<{ role: string; content: string | Array<Record<string, unknown>> }>,
  temperature = 0.1
): Promise<string> => {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://ledgr.app",
      "X-Title": "Ledgr",
    },
    body: JSON.stringify({ model, temperature, messages }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`OpenRouter ${model} error ${response.status}: ${detail.slice(0, 200)}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error(`OpenRouter ${model} returned an empty response`);
  }
  return content.trim();
};

export const chatViaOpenRouter = async (
  messages: Array<{ role: string; content: string | Array<Record<string, unknown>> }>,
  temperature = 0.1
): Promise<string> => {
  if (!OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY not configured");
  }

  let lastError = "";
  for (const model of OPENROUTER_MODELS) {
    try {
      return await callOpenRouter(model, messages, temperature);
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      console.warn(`OpenRouter ${model} failed: ${lastError.slice(0, 200)}`);
    }
  }

  throw new Error(
    `All OpenRouter models failed. Last error: ${lastError.slice(0, 200)}`
  );
};
