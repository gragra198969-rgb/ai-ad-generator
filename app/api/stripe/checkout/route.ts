import { NextResponse } from "next/server";
import Stripe from "stripe";
import { auth } from "@clerk/nextjs/server";

import { sql } from "@/app/lib/db";
import { allowRequest } from "@/app/lib/ad-security";
import { assertSameOrigin, RequestError } from "@/app/lib/request-security";

export async function POST(req: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    assertSameOrigin(req);
    if (!process.env.STRIPE_SECRET_KEY || !process.env.NEXT_PUBLIC_URL || !process.env.STRIPE_PRICE_ID) {
      return NextResponse.json({ error: "The $9.99 Pro plan is not configured yet." }, { status: 503 });
    }
    if (!await allowRequest(userId, "checkout", 3)) return NextResponse.json({ error: "Please wait a minute before trying checkout again." }, { status: 429, headers: { "Retry-After": "60" } });
    const [account] = await sql`SELECT ads_limit FROM users WHERE clerk_user_id = ${userId} LIMIT 1`;
    if (Number(account?.ads_limit ?? 10) > 10) return NextResponse.json({ error: "This account already has Pro access." }, { status: 409 });
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const price = await stripe.prices.retrieve(process.env.STRIPE_PRICE_ID);
    if (!price.active || price.currency !== "usd" || price.unit_amount !== 999 ||
        price.recurring?.interval !== "month" || price.recurring.interval_count !== 1) {
      return NextResponse.json({ error: "The configured Stripe price must be active USD $9.99 per month." }, { status: 503 });
    }
    const session =
      await stripe.checkout.sessions.create({
        mode: "subscription",

        client_reference_id: userId,
        subscription_data: {
          metadata: { clerk_user_id: userId, credit_limit: "150" },
        },

        line_items: [
          {
            price: price.id,
            quantity: 1,
          },
        ],

        success_url:
          `${process.env.NEXT_PUBLIC_URL}/dashboard?success=true`,

        cancel_url:
          `${process.env.NEXT_PUBLIC_URL}/?canceled=true`,
      });

    return NextResponse.json({
      url: session.url,
    });
  } catch (error: unknown) {

    return NextResponse.json(
      { error: error instanceof RequestError ? error.message : "Unable to create checkout session." },
      { status: error instanceof RequestError ? error.status : 500 }
    );
  }
}
