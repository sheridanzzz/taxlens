import { createHash } from "crypto";
import { sql } from "./neon";
import { CORPUS } from "./rag-corpus";

// Retrieval runs entirely in Postgres full-text search — no embedding API,
// so it keeps working with the Gemini spend cap exhausted. At ~13 chunks
// FTS ranking retrieves as well as vectors did; revisit embeddings only if
// the corpus grows past a few hundred sections AND retrieval quality drops.

interface CorpusChunk {
  source: string;
  content: string;
}

// One chunk per "## " section — sections are written to be self-contained,
// so heading-based chunking beats fixed-size windows here.
const chunkCorpus = (): CorpusChunk[] =>
  CORPUS.split(/\n(?=## )/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((section) => ({
      source: section.split("\n")[0].replace(/^#+\s*/, ""),
      content: section,
    }));

/**
 * Creates the schema and (re-)ingests the corpus when its content hash
 * doesn't match what's stored. Pure SQL — cheap enough to run lazily on
 * every first request.
 */
export const ensureCorpus = async (): Promise<void> => {
  const db = sql();
  const hash = createHash("md5").update(CORPUS).digest("hex");

  await db`CREATE TABLE IF NOT EXISTS rag_chunks (
    id serial PRIMARY KEY,
    source text NOT NULL,
    content text NOT NULL,
    corpus_hash text NOT NULL
  )`;
  // migrate away the vector column from the embeddings era; idempotent
  await db`ALTER TABLE rag_chunks DROP COLUMN IF EXISTS embedding`;
  await db`ALTER TABLE rag_chunks ADD COLUMN IF NOT EXISTS tsv tsvector
    GENERATED ALWAYS AS (to_tsvector('english', content)) STORED`;

  const existing = await db`SELECT corpus_hash FROM rag_chunks LIMIT 1`;
  if (existing[0]?.corpus_hash === hash) return;

  await db`DELETE FROM rag_chunks`;
  for (const chunk of chunkCorpus()) {
    await db`INSERT INTO rag_chunks (source, content, corpus_hash)
      VALUES (${chunk.source}, ${chunk.content}, ${hash})`;
  }
};

export interface RagChunk {
  source: string;
  content: string;
}

/** Returns the topK corpus chunks most relevant to the question. */
export const searchChunks = async (
  query: string,
  topK = 4
): Promise<RagChunk[]> => {
  await ensureCorpus();
  const db = sql();

  // OR the meaningful words so chunks rank by how many they match —
  // AND-ing a whole natural-language question would usually match nothing.
  const terms = (query.toLowerCase().match(/[a-z][a-z0-9]{2,}/g) ?? []).join(" | ");
  const rows = terms
    ? await db`
        SELECT source, content
        FROM rag_chunks
        ORDER BY ts_rank(tsv, to_tsquery('english', ${terms})) DESC
        LIMIT ${topK}`
    : await db`SELECT source, content FROM rag_chunks LIMIT ${topK}`;

  return rows.map((r) => ({
    source: r.source as string,
    content: r.content as string,
  }));
};
