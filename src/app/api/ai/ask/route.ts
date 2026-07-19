import { NextRequest, NextResponse } from "next/server";
import { generateTextWithFallback } from "@/lib/ai-providers";
import { searchChunks } from "@/lib/rag";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  let body: { question?: string; occupation?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const question = body.question?.trim();
  if (!question) {
    return NextResponse.json(
      { error: "Missing required field: question" },
      { status: 400 }
    );
  }

  try {
    return NextResponse.json(await answer(question, body.occupation?.trim()));
  } catch (error) {
    console.warn("ask failed:", error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: "AI is temporarily unavailable. Please try again later." },
      { status: 503 }
    );
  }
}

const answer = async (question: string, occupation?: string) => {
  const chunks = await searchChunks(question);
  const context = chunks.map((c) => c.content).join("\n\n---\n\n");

  const { text } = await generateTextWithFallback(
    [
      {
        role: "user",
        content: `You are TaxLens, an assistant for Australian work-related tax deductions.${
          occupation ? `\nThe user works as: ${occupation}. Tailor examples and deductibility judgements to that occupation.` : ""
        }
Answer the user's question using ONLY the reference material below. If the
material doesn't cover the question, say so plainly rather than guessing.
Keep the answer concise and practical, and remind the user this is general
information, not personal financial advice, only when the question involves
a judgement call.

Reference material:
${context}

Question: ${question}`,
      },
    ],
    1000
  );

  return {
    answer: text,
    sources: chunks.map(({ source }) => ({ source })),
  };
};
