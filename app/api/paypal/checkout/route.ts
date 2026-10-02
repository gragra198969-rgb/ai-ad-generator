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
    if (Number(account?.ads_limit ?? 50) >= 1000) {
      return Response.json({ error: "This account already has Pro access." }, { status: 409 });
    }

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
    if (!approvalUrl) {
      return Response.json({ error: "PayPal did not return an approval link." }, { status: 502 });
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

