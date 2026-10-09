import { sql } from "@/app/lib/db";

let schemaReady: Promise<void> | undefined;
export function ensureAdOwnership() {
  // Additive migration: never guess ownership of historical rows.
  schemaReady ??= (async () => {
    await sql`ALTER TABLE ads ADD COLUMN IF NOT EXISTS clerk_user_id TEXT`;
    await sql`CREATE INDEX IF NOT EXISTS ads_owner_id_idx ON ads (clerk_user_id, id DESC)`;
  })().catch((error) => { schemaReady = undefined; throw error; });
  return schemaReady;
}

let imageSlotSchemaReady: Promise<void> | undefined;
export function ensureAdImageGenerationSlots() {
  imageSlotSchemaReady ??= (async () => {
    await ensureAdOwnership();
    await sql`CREATE TABLE IF NOT EXISTS ad_image_generation_slots (
      ad_id INTEGER NOT NULL REFERENCES ads(id) ON DELETE CASCADE,
      ad_index INTEGER NOT NULL CHECK (ad_index >= 0 AND ad_index < 20),
      clerk_user_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('generating', 'generated', 'failed')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (ad_id, ad_index)
    )`;
  })().catch((error) => { imageSlotSchemaReady = undefined; throw error; });
  return imageSlotSchemaReady;
}

let rateSchemaReady: Promise<void> | undefined;
export async function allowRequest(userId: string, action: string, limit: number) {
  rateSchemaReady ??= (async () => {
    await sql`CREATE TABLE IF NOT EXISTS request_limits (
      clerk_user_id TEXT NOT NULL, action TEXT NOT NULL,
      window_start TIMESTAMPTZ NOT NULL, requests INTEGER NOT NULL,
      PRIMARY KEY (clerk_user_id, action)
    )`;
  })().catch((error) => { rateSchemaReady = undefined; throw error; });
  await rateSchemaReady;
  const rows = await sql`
    INSERT INTO request_limits (clerk_user_id, action, window_start, requests)
    VALUES (${userId}, ${action}, NOW(), 1)
    ON CONFLICT (clerk_user_id, action) DO UPDATE SET
      window_start = CASE WHEN request_limits.window_start <= NOW() - INTERVAL '1 minute' THEN NOW() ELSE request_limits.window_start END,
      requests = CASE WHEN request_limits.window_start <= NOW() - INTERVAL '1 minute' THEN 1 ELSE request_limits.requests + 1 END
    WHERE request_limits.window_start <= NOW() - INTERVAL '1 minute' OR request_limits.requests < ${limit}
    RETURNING requests
  `;
  return rows.length > 0;
}

