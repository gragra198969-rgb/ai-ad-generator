import { auth } from "@clerk/nextjs/server";
import { sql } from "@/app/lib/db";
import { getPayPalAccessToken, PAYPAL_API_BASE } from "@/app/lib/paypal";

export async function POST() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Sign in to subscribe." }, { status: 401 });

  const origin = process.env.NEXT_PUBLIC_URL;
  if (!origin) return Response.json({ error: "Checkout is not configured." }, { status: 503 });

  try {
    const [account] = await sql`
      SELECT ads_limit FROM users WHERE clerk_user_id = ${userId} LIMIT 1
    `;
    if (Number(account?.ads_limit ?? 10) >= 1000) {
      return Response.json({ error: "This account already has Pro access." }, { status: 409 });
    }

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
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS paypal_one_pending_subscription_per_user
      ON paypal_subscriptions (clerk_user_id)
      WHERE status = 'APPROVAL_PENDING'
    `;
    await sql`
      UPDATE paypal_subscriptions SET status = 'EXPIRED', updated_at = NOW()
      WHERE clerk_user_id = ${userId}
        AND status = 'APPROVAL_PENDING'
        AND updated_at < NOW() - INTERVAL '30 minutes'
    `;
    const [pending] = await sql`
      SELECT approval_url FROM paypal_subscriptions
      WHERE clerk_user_id = ${userId}
        AND status = 'APPROVAL_PENDING'
        AND updated_at >= NOW() - INTERVAL '30 minutes'
      ORDER BY updated_at DESC LIMIT 1
    `;
    if (pending?.approval_url) return Response.json({ url: pending.approval_url });

    const token = await getPayPalAccessToken();
    const response = await fetch(`${PAYPAL_API_BASE}/v1/billing/subscriptions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": crypto.randomUUID(),
      },
      body: JSON.stringify({
        plan_id: process.env.PAYPAL_PLAN_ID,
        custom_id: userId,
        application_context: {
          brand_name: "AdSurvey Studio",
          user_action: "SUBSCRIBE_NOW",
          shipping_preference: "NO_SHIPPING",
          return_url: `${origin}/paypal/return`,
          cancel_url: `${origin}/paypal/cancel`,
        },
      }),
      cache: "no-store",
    });

    const subscription = (await response.json()) as {
      links?: Array<{ rel: string; href: string }>;
      message?: string;
    };
    if (!response.ok) {
      console.error("PayPal subscription create failed:", response.status, subscription.message);
      return Response.json({ error: "PayPal couldn’t start checkout. Please try again." }, { status: 502 });
    }

    const approvalUrl = subscription.links?.find((link) => link.rel === "approve")?.href;
    const subscriptionId = (subscription as { id?: string }).id;
    if (!approvalUrl || !subscriptionId) {
      return Response.json({ error: "PayPal did not return an approval link." }, { status: 502 });
    }

    try {
      await sql`
        INSERT INTO paypal_subscriptions
          (subscription_id, clerk_user_id, plan_id, approval_url, status)
        VALUES
          (${subscriptionId}, ${userId}, ${process.env.PAYPAL_PLAN_ID!}, ${approvalUrl}, 'APPROVAL_PENDING')
      `;
    } catch (error) {
      const [existing] = await sql`
        SELECT approval_url FROM paypal_subscriptions
        WHERE clerk_user_id = ${userId} AND status = 'APPROVAL_PENDING'
        ORDER BY updated_at DESC LIMIT 1
      `;
      if (existing?.approval_url) return Response.json({ url: existing.approval_url });
      throw error;
    }

    return Response.json({ url: approvalUrl });
  } catch (error) {
    console.error("PayPal checkout failed:", error instanceof Error ? error.message : "Unknown error");
    return Response.json(
      { error: error instanceof Error && error.message.includes("not configured") ? error.message : "PayPal checkout is temporarily unavailable." },
      { status: 503 }
    );
  }
}

