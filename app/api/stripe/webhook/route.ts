import { NextResponse } from "next/server";
import Stripe from "stripe";
import { sql } from "@/app/lib/db";

const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY!
);

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature")!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Invalid webhook signature.";
    console.error("Webhook Error:", message);

    return NextResponse.json(
      { error: `Webhook Error: ${message}` },
      { status: 400 }
    );
  }

  console.log("EVENT TYPE:", event.type);

  if (event.type === "checkout.session.completed") {
    const session =
      event.data.object as Stripe.Checkout.Session;

    const clerkUserId =
      session.client_reference_id;

    if (!clerkUserId) {
      console.log(
        "No client_reference_id found in checkout session."
      );

      return NextResponse.json({
        received: true,
      });
    }

    try {
      await sql`
        INSERT INTO users (clerk_user_id, ads_used, ads_limit)
        VALUES (${clerkUserId}, 0, 1000)
        ON CONFLICT (clerk_user_id)
        DO UPDATE SET ads_used = 0, ads_limit = 1000
      `;

      console.log(
        "Upgraded user:",
        clerkUserId
      );
    } catch (dbError) {
      console.error(
        "Database update failed:",
        dbError
      );
    }
  }

  if (event.type === "invoice.paid") {
    const invoice = event.data.object as Stripe.Invoice;
    const clerkUserId = invoice.parent?.subscription_details?.metadata?.clerk_user_id;

    if (clerkUserId) {
      await sql`
        INSERT INTO users (clerk_user_id, ads_used, ads_limit)
        VALUES (${clerkUserId}, 0, 1000)
        ON CONFLICT (clerk_user_id)
        DO UPDATE SET ads_used = 0, ads_limit = 1000
      `;
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    const clerkUserId = subscription.metadata.clerk_user_id;

    if (clerkUserId) {
      await sql`
        UPDATE users
        SET ads_used = 0, ads_limit = 10
        WHERE clerk_user_id = ${clerkUserId}
      `;
    }
  }

  return NextResponse.json({
    received: true,
  });
}
