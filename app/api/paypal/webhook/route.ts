import { sql } from "@/app/lib/db";
import {
  getPayPalAccessToken,
  getPayPalSubscription,
  verifyPayPalWebhook,
} from "@/app/lib/paypal";

type PayPalEvent = {
  id?: string;
  event_type?: string;
  resource?: {
    id?: string;
    billing_agreement_id?: string;
  };
};

export async function POST(request: Request) {
  let eventId: string | undefined;
  let event: PayPalEvent;
  try {
    event = (await request.json()) as PayPalEvent;
    const token = await getPayPalAccessToken();
    const verified = await verifyPayPalWebhook(token, request, event);
    if (!verified) return Response.json({ error: "Invalid webhook signature." }, { status: 400 });

    if (!event.id || !event.event_type) {
      return Response.json({ error: "Invalid webhook event." }, { status: 400 });
    }
    eventId = event.id;

    await sql`
      CREATE TABLE IF NOT EXISTS paypal_webhook_events (
        event_id TEXT PRIMARY KEY,
        received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        processed_at TIMESTAMPTZ
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS paypal_subscriptions (
        subscription_id TEXT PRIMARY KEY,
        clerk_user_id TEXT NOT NULL,
        plan_id TEXT NOT NULL,
        approval_url TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'APPROVAL_PENDING',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    const inserted = await sql`
      INSERT INTO paypal_webhook_events (event_id)
      VALUES (${event.id})
      ON CONFLICT (event_id) DO NOTHING
      RETURNING event_id
    `;
    if (inserted.length === 0) {
      const [existing] = await sql`
        SELECT processed_at FROM paypal_webhook_events WHERE event_id = ${event.id}
      `;
      if (existing?.processed_at) return Response.json({ received: true, duplicate: true });
    }

    const subscriptionId =
      event.resource?.billing_agreement_id ?? event.resource?.id;
    const tokenForLookup = token;

    if (
      subscriptionId &&
      [
        "PAYMENT.SALE.COMPLETED",
        "BILLING.SUBSCRIPTION.CANCELLED",
        "BILLING.SUBSCRIPTION.SUSPENDED",
        "BILLING.SUBSCRIPTION.EXPIRED",
      ].includes(event.event_type)
    ) {
      const subscription = await getPayPalSubscription(tokenForLookup, subscriptionId);
      const userId = subscription.custom_id;
      if (!userId || subscription.plan_id !== process.env.PAYPAL_PLAN_ID) {
        return Response.json({ received: true });
      }

      if (event.event_type === "PAYMENT.SALE.COMPLETED") {
        await sql`
          INSERT INTO paypal_subscriptions
            (subscription_id, clerk_user_id, plan_id, approval_url, status)
          VALUES (${subscriptionId}, ${userId}, ${subscription.plan_id}, '', ${subscription.status})
          ON CONFLICT (subscription_id) DO UPDATE
          SET status = EXCLUDED.status, updated_at = NOW()
        `;
        await sql`
          INSERT INTO users (clerk_user_id, ads_used, ads_limit)
          VALUES (${userId}, 0, 1000)
          ON CONFLICT (clerk_user_id)
          DO UPDATE SET ads_used = 0, ads_limit = 1000
        `;
      } else if (["CANCELLED", "SUSPENDED", "EXPIRED"].includes(subscription.status)) {
        await sql`
          UPDATE paypal_subscriptions SET status = ${subscription.status}, updated_at = NOW()
          WHERE subscription_id = ${subscriptionId} AND clerk_user_id = ${userId}
        `;
        await sql`
          UPDATE users SET ads_used = 0, ads_limit = 10
          WHERE clerk_user_id = ${userId}
        `;
      }
    }

    await sql`
      UPDATE paypal_webhook_events SET processed_at = NOW() WHERE event_id = ${event.id}
    `;
    return Response.json({ received: true });
  } catch (error) {
    if (eventId) {
      try {
        await sql`DELETE FROM paypal_webhook_events WHERE event_id = ${eventId} AND processed_at IS NULL`;
      } catch {
        // Preserve the original error; PayPal can retry after a transient DB failure.
      }
    }
    console.error("PayPal webhook failed:", error instanceof Error ? error.message : "Unknown error");
    return Response.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}

