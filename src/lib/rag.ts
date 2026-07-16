import { embed, embedMany } from "ai";
import { createHash } from "crypto";
import { google } from "./ai-providers";
import { sql } from "./neon";
import { CORPUS } from "./rag-corpus";

// ponytail: 768 dims is plenty for a ~13-chunk corpus and keeps rows small.
// If you change it, the vector(768) column below must change with it.
const EMBEDDING_DIMS = 768;
const EMBEDDING_MODEL = google.textEmbedding("gemini-embedding-001");

// Google embeddings are asymmetric: documents and queries are embedded with
// different task types so "how do I claim my chair?" lands near a chunk that
// never uses the word "claim".
const embedOptions = (taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY") => ({
  google: { outputDimensionality: EMBEDDING_DIMS, taskType },
});

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
 * Creates the pgvector schema and (re-)ingests the corpus when its content
 * hash doesn't match what's stored. First call after a corpus edit pays a
 * few seconds of embedding; every other call is one cheap SELECT.
 */
export const ensureCorpus = async (): Promise<void> => {
  const db = sql();
  const hash = createHash("md5").update(CORPUS).digest("hex");

  await db`CREATE EXTENSION IF NOT EXISTS vector`;
  await db`CREATE TABLE IF NOT EXISTS rag_chunks (
    id serial PRIMARY KEY,
    source text NOT NULL,
    content text NOT NULL,
    corpus_hash text NOT NULL,
    embedding vector(768) NOT NULL
  )`;

  const existing = await db`SELECT corpus_hash FROM rag_chunks LIMIT 1`;
  if (existing[0]?.corpus_hash === hash) return;

  const chunks = chunkCorpus();
  const { embeddings } = await embedMany({
    model: EMBEDDING_MODEL,
    values: chunks.map((c) => c.content),
    providerOptions: embedOptions("RETRIEVAL_DOCUMENT"),
  });

  // ponytail: delete-then-insert without a lock; concurrent first requests
  // could double-ingest. Fine at this scale — wrap in a transaction if it
  // ever matters.
  await db`DELETE FROM rag_chunks`;
  for (let i = 0; i < chunks.length; i++) {
    await db`INSERT INTO rag_chunks (source, content, corpus_hash, embedding)
      VALUES (${chunks[i].source}, ${chunks[i].content}, ${hash},
              ${JSON.stringify(embeddings[i])}::vector)`;
  }
};

export interface RagChunk {
  source: string;
  content: string;
  /** Cosine distance: 0 = identical direction, 1 = unrelated. */
  distance: number;
}

/** Embeds the query and returns the topK nearest corpus chunks. */
export const searchChunks = async (
  query: string,
  topK = 4
): Promise<RagChunk[]> => {
  await ensureCorpus();

  const { embedding } = await embed({
    model: EMBEDDING_MODEL,
    value: query,
    providerOptions: embedOptions("RETRIEVAL_QUERY"),
  });

  // <=> is pgvector's cosine distance operator.
  // ponytail: full scan, no index — instant at ~13 rows. Add an HNSW index
  // (CREATE INDEX ... USING hnsw (embedding vector_cosine_ops)) past ~10k rows.
  const db = sql();
  const rows = await db`
    SELECT source, content, embedding <=> ${JSON.stringify(embedding)}::vector AS distance
    FROM rag_chunks
    ORDER BY distance
    LIMIT ${topK}`;

  return rows.map((r) => ({
    source: r.source as string,
    content: r.content as string,
    distance: Number(r.distance),
  }));
};
