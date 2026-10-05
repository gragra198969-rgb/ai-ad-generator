import { sql } from "@/app/lib/db";

let schemaReady: Promise<void> | undefined;

export function ensureSurveySchema() {
  schemaReady ??= (async () => {
    await sql`CREATE TABLE IF NOT EXISTS customer_surveys (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id TEXT NOT NULL,
      title TEXT NOT NULL,
      question TEXT NOT NULL,
      options JSONB NOT NULL CHECK (jsonb_typeof(options) = 'array'),
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
    await sql`CREATE INDEX IF NOT EXISTS customer_surveys_owner_created_idx
      ON customer_surveys (owner_id, created_at DESC)`;
    await sql`CREATE TABLE IF NOT EXISTS customer_survey_responses (
      id BIGSERIAL PRIMARY KEY,
      survey_id UUID NOT NULL REFERENCES customer_surveys(id) ON DELETE CASCADE,
      answer TEXT NOT NULL,
      comment TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
    await sql`CREATE INDEX IF NOT EXISTS customer_survey_responses_survey_created_idx
      ON customer_survey_responses (survey_id, created_at DESC)`;
  })().catch((error) => {
    schemaReady = undefined;
    throw error;
  });
  return schemaReady;
}

export function surveyOptions(value: unknown): string[] {
  let parsed = value;
  if (typeof value === "string") {
    try { parsed = JSON.parse(value); } catch { return []; }
  }
  return Array.isArray(parsed) && parsed.every((item) => typeof item === "string")
    ? parsed
    : [];
}

export function isSurveyId(value: unknown): value is string {
  return typeof value === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
