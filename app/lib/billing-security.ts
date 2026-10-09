import { sql } from "@/app/lib/db";

let ready: Promise<void> | undefined;
export async function applyCreditEvent(provider: string, eventId: string, userId: string, paid: boolean, creditLimit = 1000) {
  ready ??= (async () => {
    await sql`CREATE TABLE IF NOT EXISTS billing_credit_events (
      provider TEXT NOT NULL, event_id TEXT NOT NULL,
      processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (provider, event_id)
    )`;
  })().catch((error) => { ready = undefined; throw error; });
  await ready;
  // Receipt and balance change commit together. Concurrent/replayed deliveries
  // cannot refill credits again, and failed database writes remain retryable.
  if (paid) {
    await sql`
      WITH accepted AS (
        INSERT INTO billing_credit_events (provider, event_id)
        VALUES (${provider}, ${eventId}) ON CONFLICT DO NOTHING RETURNING event_id
      )
      INSERT INTO users (clerk_user_id, ads_used, ads_limit)
      SELECT ${userId}, 0, ${creditLimit} FROM accepted
      ON CONFLICT (clerk_user_id) DO UPDATE SET ads_used = 0, ads_limit = ${creditLimit}
    `;
  } else {
    await sql`
      WITH accepted AS (
        INSERT INTO billing_credit_events (provider, event_id)
        VALUES (${provider}, ${eventId}) ON CONFLICT DO NOTHING RETURNING event_id
      )
      UPDATE users SET ads_limit = LEAST(ads_limit, 10)
      WHERE clerk_user_id = ${userId} AND EXISTS (SELECT 1 FROM accepted)
    `;
  }
}
